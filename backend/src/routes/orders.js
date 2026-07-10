const express = require("express");
const router = express.Router();
const pool = require("../db/pool");
const redisClient = require("../../config/redis");
const {
  invalidateDashboardCache,
  invalidateOrderHistoryCache,
  invalidateAdminListCache,
  invalidateActiveOrdersHistoryCache,
} = require("../helpers/cacheHelper");
const { sendSMS } = require("../utils/smsSender");
const { ensureBusinessSettings, toBusinessResponse } = require("../utils/businessSettings");
const { calculateOrderTotals, roundCurrency } = require("../utils/gst");

function mapOrderItems(rows) {
  return rows.map((i) => ({
    ...i,
    id: i.menu_item_id || i.id,
    price: parseFloat(i.price),
    note: i.note || undefined,
  }));
}

// ---------------- PLACE NEW ORDER ----------------
router.post("/", async (req, res) => {
  const { customerName, customerPhone, items, paymentMethod, couponCode, orderType, specialInstructions, orderSource, tableSessionId, splitCash = 0, splitUpi = 0, pointsRedeemed = 0 } =
    req.body;

  const name = customerName?.trim() || "Guest";



  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: "Items required" });
  }

  if (!["counter", "online", "split"].includes(paymentMethod)) {
    return res.status(400).json({ error: "Invalid payment method" });
  }


  const phone = customerPhone?.trim() || "0000000000";

  if (name !== "Guest") {
    if (name.length < 2 || name.length > 20 || !/^[A-Za-z\s]+$/.test(name)) {
      return res.status(400).json({ error: "Name must be 2-20 characters long and contain only alphabets." });
    }
  }

  if (phone !== "0000000000") {
    if (!/^[0-9]{10}$/.test(phone)) {
      return res.status(400).json({ error: "Phone number must be exactly 10 digits." });
    }
  }

  const client = await pool.connect();

  let waiterId = null;
  // Try to extract waiter_id from Authorization token if it's a staff request
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.substring(7);
    try {
      const jwt = require("jsonwebtoken");
      const { JWT_SECRET } = require("../middleware/adminAuth");
      const decoded = jwt.verify(token, JWT_SECRET);
      if (decoded && decoded.isStaff) {
        waiterId = decoded.id;
      }
    } catch (e) {
      // ignore invalid token
    }
  }

  try {
    await client.query("BEGIN");

    // Validate that all items exist in the database
    const itemIds = [...new Set(items.map(item => parseInt(String(item.id).split('-')[0], 10)).filter(id => !isNaN(id)))];
    if (itemIds.length > 0) {
      const menuCheckRes = await client.query(
        "SELECT id FROM menu_items WHERE id = ANY($1::int[]) AND business_id = $2",
        [itemIds, req.business_id]
      );
      if (menuCheckRes.rows.length !== itemIds.length) {
        throw new Error("Some items in your cart are no longer available on the menu. Please clear your cart and try again.");
      }
    }

    // Look up table session to inherit waiter_id if it's a QR order
    if (tableSessionId) {
      const tsRes = await client.query(
        "SELECT waiter_id FROM table_sessions WHERE id = $1 AND business_id = $2",
        [tableSessionId, req.business_id]
      );
      if (tsRes.rows.length > 0 && tsRes.rows[0].waiter_id) {
        waiterId = tsRes.rows[0].waiter_id;
      }
    }

    const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());

    const tokenResult = await client.query(
      `INSERT INTO token_counter (date, business_id, last_token)
       VALUES ($1, $2, 1)
       ON CONFLICT (business_id, date)
       DO UPDATE SET last_token = token_counter.last_token + 1
       RETURNING last_token`,
      [today, req.business_id],
    );

    const token = tokenResult.rows[0].last_token;
    const subtotal = roundCurrency(
      items.reduce((sum, i) => sum + Number(i.price) * Number(i.quantity), 0),
    );

    let discount = 0;
    let appliedCoupon = null;

    if (couponCode) {
      const normalizedCode = couponCode.trim().toUpperCase();

      const couponResult = await client.query(
        `SELECT * FROM coupons
         WHERE code = $1 AND business_id = $2
         AND active = true
         AND (expiry_date IS NULL OR expiry_date >= CURRENT_DATE)
         AND used_count < usage_limit
         FOR UPDATE`,
        [normalizedCode, req.business_id],
      );

      if (couponResult.rows.length > 0) {
        const coupon = couponResult.rows[0];

        if (coupon.discount_type === "percent") {
          discount = (subtotal * parseFloat(coupon.value)) / 100;
        } else {
          discount = parseFloat(coupon.value);
        }

        discount = roundCurrency(Math.min(discount, subtotal));
        appliedCoupon = normalizedCode;

        const newUsedCount = coupon.used_count + 1;
        const shouldDeactivate = newUsedCount >= coupon.usage_limit;

        await client.query(
          `UPDATE coupons
           SET used_count = $1, active = $2
           WHERE code = $3 AND business_id = $4`,
          [newUsedCount, !shouldDeactivate, normalizedCode, req.business_id],
        );

        await invalidateAdminListCache(req.business_id);
      }
    }

    const businessSettings = await ensureBusinessSettings(client, req.business_id);
    
    // Loyalty Points Redemption Logic
    let loyaltyDiscount = 0;
    const requestedPoints = parseFloat(pointsRedeemed) || 0;
    let actualPointsRedeemed = 0;
    
    if (requestedPoints > 0 && phone !== "0000000000") {
      const loyaltySettingsRes = await client.query(
        "SELECT loyalty_enabled, loyalty_discount_per_point FROM business_settings WHERE business_id = $1", 
        [req.business_id]
      );
      const loyaltySettings = loyaltySettingsRes.rows[0];
      
      if (loyaltySettings && loyaltySettings.loyalty_enabled) {
        const customerRes = await client.query(
          "SELECT points_balance FROM customers WHERE business_id = $1 AND phone = $2 FOR UPDATE",
          [req.business_id, phone]
        );
        
        if (customerRes.rows.length > 0) {
          const customer = customerRes.rows[0];
          actualPointsRedeemed = Math.min(requestedPoints, customer.points_balance);
          loyaltyDiscount = actualPointsRedeemed * parseFloat(loyaltySettings.loyalty_discount_per_point);
          
          discount += loyaltyDiscount;
          
          await client.query(
            "UPDATE customers SET points_balance = points_balance - $1 WHERE business_id = $2 AND phone = $3",
            [actualPointsRedeemed, req.business_id, phone]
          );
          
          if (discount > subtotal) {
             discount = subtotal;
          }
        }
      }
    }
    const totals = calculateOrderTotals({
      subtotal,
      discount,
      gstEnabled: businessSettings.isGstEnabled,
      cgstRate: businessSettings.cgstRate,
      sgstRate: businessSettings.sgstRate,
    });

    // Use explicitly provided paidAmount (e.g. from POS), otherwise 0
    const providedPaidAmount = req.body.paidAmount !== undefined ? Number(req.body.paidAmount) : 0;
    
    // If table order OR no explicit payment provided, it's pending.
    // Adding 0.01 tolerance to prevent floating point mismatch (e.g. 0.23 < 0.23000000004)
    const paymentStatus = (orderSource === "table" || providedPaidAmount < (totals.total - 0.01)) ? "pending" : "paid";
    const paidAmount = paymentStatus === "paid" ? totals.total : providedPaidAmount;

    const initialStatus = "new";

    const orderResult = await client.query(
      `INSERT INTO orders
        (token, customer_name, customer_phone, subtotal, total, payment_method,
         payment_status, paid_amount, coupon_code, discount, cgst, sgst, gst_total, gst_rate,
         order_type, special_instructions, order_source, table_session_id, status, split_cash, split_upi, points_redeemed, business_id, waiter_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24)
       RETURNING *`,
      [
        token,
        name,
        phone,
        totals.subtotal,
        totals.total,
        paymentMethod,
        paymentStatus,
        paidAmount,
        appliedCoupon,
        totals.discount,
        totals.cgst,
        totals.sgst,
        totals.gstTotal,
        totals.gstRate,
        orderType || "dine-in",
        specialInstructions || "",
        orderSource || "counter",
        tableSessionId || null,
        initialStatus,
        splitCash,
        splitUpi,
        actualPointsRedeemed,
        req.business_id,
        waiterId
      ],
    );

    const order = orderResult.rows[0];

    const values = [];
    const placeholders = [];

    items.forEach((item, index) => {
      if (!item.id) {
        throw new Error(`Missing menu_item_id for item: ${item.name}`);
      }
      const base = index * 9;
      placeholders.push(
        `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6}, $${base + 7}, $${base + 8}, $${base + 9})`,
      );
      values.push(
        order.id, // $1
        parseInt(String(item.id).split('-')[0], 10) || null, // $2 menu_item_id (handle variant IDs like "1-Half")
        item.name, // $3
        Number(item.quantity) || 1, // $4
        Number(item.price) || 0, // $5
        item.priceLabel || "Full", // $6
        item.image || "/placeholder.jpg", // $7
        item.note || null, // $8
        req.business_id // $9
      );
    });

    if (placeholders.length > 0) {
      await client.query(
        `INSERT INTO order_items
          (order_id, menu_item_id, name, quantity, price, price_label, image, note, business_id)
         VALUES ${placeholders.join(",")}`,
        values,
      );
    }

    await client.query("COMMIT");

    const message = `Classic Chinese 🍜

Hello ${name},

Order Confirmed!
Token: ${token}
Subtotal: ₹${totals.subtotal}
GST: ₹${totals.gstTotal}
Total: ₹${totals.total}

Items:
${items.map((i) => `• ${i.quantity}x ${i.name}`).join("\n")}

You'll be notified when ready.
Thank you!`;

    sendSMS(phone, message).catch((err) =>
      console.error("SMS failed:", err.message),
    );

    invalidateOrderHistoryCache(phone).catch(console.error);
    invalidateDashboardCache().catch(console.error);
    invalidateActiveOrdersHistoryCache(phone).catch(console.error);

    const responseItems = items.map((i) => ({
      id: i.id,
      menu_item_id: parseInt(String(i.id).split('-')[0], 10) || null,
      name: i.name,
      price: Number(i.price) || 0,
      priceLabel: i.priceLabel || "Full",
      quantity: Number(i.quantity) || 1,
      image: i.image || "/placeholder.jpg",
      note: i.note || undefined
    }));

    const responseData = {
      id: order.id,
      token: order.token,
      customerName: order.customer_name,
      customerPhone: order.customer_phone,
      items: responseItems,
      subtotal: parseFloat(order.subtotal),
      discount: parseFloat(order.discount || 0),
      cgst: parseFloat(order.cgst || 0),
      sgst: parseFloat(order.sgst || 0),
      gst: parseFloat(order.gst_total || 0),
      gstRate: parseFloat(order.gst_rate || 0),
      couponCode: order.coupon_code || null,
      total: parseFloat(order.total),
      paymentMethod: order.payment_method,
      paymentStatus: order.payment_status,
      paidAmount: parseFloat(order.paid_amount || 0),
      status: order.status,
      createdAt: order.created_at,
      business: toBusinessResponse(businessSettings),
      orderType: order.order_type || "dine-in",
      specialInstructions: order.special_instructions || "",
      orderSource: order.order_source || "counter",
      tableSessionId: order.table_session_id || null,
    };

    const io = req.app.get("io");
    io.emit("new-order", responseData);

    res.status(201).json(responseData);
  } catch (err) {
    if (client) await client.query("ROLLBACK");
    console.error("Order placement error:", err);
    res.status(500).json({ error: err.message || "Failed to place order" });
  } finally {
    client.release();
  }
});

// ---------------- TOKEN DISPLAY ----------------
router.get("/tokens", async (req, res) => {
  res.set("Cache-Control", "no-store, no-cache, must-revalidate");
  try {
    const result = await pool.query(
      `SELECT id, token, status, customer_name
       FROM orders
       WHERE created_at::date = CURRENT_DATE AND business_id = $1
       ORDER BY token DESC`,
      [req.business_id]
    );

    res.json(
      result.rows.map((r) => ({
        id: r.id,
        token: r.token,
        status: r.status,
        customerName: r.customer_name,
      })),
    );
  } catch (err) {
    console.error("Token fetch error:", err);
    res.status(500).json({ error: "Failed to fetch tokens" });
  }
});

// ---------------- ORDER HISTORY BY PHONE ----------------
router.get("/history/:phone", async (req, res) => {
  const { phone } = req.params;

  if (!phone?.trim()) {
    return res.status(400).json({ error: "Phone number required" });
  }
  const cacheKey = `order-history:${phone.trim()}:${req.business_id}`;

  try {
    const cached = await redisClient.get(cacheKey);
    if (cached) {
      console.log(`Cache hit for ${cacheKey}`);
      return res.json(JSON.parse(cached));
    }

    const result = await pool.query(
      `SELECT o.id, o.token, o.total, o.status, o.created_at,
              o.subtotal, o.discount, o.cgst, o.sgst, o.gst_total,
         json_agg(json_build_object(
           'id', oi.menu_item_id, 'name', oi.name, 'price', oi.price, 'priceLabel', oi.price_label,
           'quantity', oi.quantity, 'image', oi.image
         )) as items
       FROM orders o
       JOIN order_items oi ON oi.order_id = o.id
       WHERE o.customer_phone = $1 AND o.business_id = $2
       GROUP BY o.id
       ORDER BY o.created_at DESC
       LIMIT 20`,
      [phone.trim(), req.business_id],
    );
    const responseData = result.rows.map((row) => ({
      id: row.id,
      token: row.token,
      total: parseFloat(row.total),
      subtotal: parseFloat(row.subtotal || 0),
      discount: parseFloat(row.discount || 0),
      cgst: parseFloat(row.cgst || 0),
      sgst: parseFloat(row.sgst || 0),
      gst: parseFloat(row.gst_total || 0),
      status: row.status,
      createdAt: row.created_at,
      items: row.items.map((i) => ({ ...i, price: parseFloat(i.price) })),
    }));

    await redisClient.set(cacheKey, JSON.stringify(responseData), { EX: 300 });
    res.json(responseData);
  } catch (err) {
    console.error("Order history error:", err);
    res.status(500).json({ error: "Failed to fetch order history" });
  }
});
// ---------------- ACTIVE ORDERS BY PHONE (for receipt download) ----------------
router.get("/active/:phone", async (req, res) => {
  const { phone } = req.params;
  if (!phone?.trim() || phone.trim().length < 10) {
    return res.status(400).json({ error: "Valid phone number required" });
  }
  const cacheKey = `active-orders:${phone.trim()}:${req.business_id}`;
  try {
    const cached = await redisClient.get(cacheKey);
    if (cached) {
      console.log(`Cache hit for ${cacheKey}`);
      return res.json(JSON.parse(cached));
    }
    const businessSettings = await ensureBusinessSettings(pool, req.business_id);

    const result = await pool.query(
      `SELECT o.id, o.token, o.total, o.subtotal, o.discount, o.cgst, o.sgst,
              o.gst_total, o.gst_rate, o.status, o.payment_method, o.payment_status,
              o.paid_amount, o.coupon_code, o.customer_name, o.customer_phone, o.created_at,
         json_agg(json_build_object(
           'id', oi.menu_item_id, 'name', oi.name, 'price', oi.price, 'priceLabel', oi.price_label,
           'quantity', oi.quantity, 'image', oi.image
         )) as items
       FROM orders o
       JOIN order_items oi ON oi.order_id = o.id
       WHERE o.customer_phone = $1 AND o.business_id = $2
         AND o.status IN ('new', 'preparing', 'ready')
         AND o.created_at::date = CURRENT_DATE
       GROUP BY o.id
       ORDER BY o.created_at DESC`,
      [phone.trim(), req.business_id]
    );

    const orders = result.rows.map((row) => ({
      id: row.id,
      token: row.token,
      customerName: row.customer_name,
      customerPhone: row.customer_phone,
      total: parseFloat(row.total),
      subtotal: parseFloat(row.subtotal || 0),
      discount: parseFloat(row.discount || 0),
      cgst: parseFloat(row.cgst || 0),
      sgst: parseFloat(row.sgst || 0),
      gst: parseFloat(row.gst_total || 0),
      gstRate: parseFloat(row.gst_rate || 0),
      status: row.status,
      paymentMethod: row.payment_method,
      paymentStatus: row.payment_status,
      paidAmount: parseFloat(row.paid_amount || 0),
      couponCode: row.coupon_code,
      createdAt: row.created_at,
      items: row.items.map((i) => ({ ...i, price: parseFloat(i.price) })),
      business: toBusinessResponse(businessSettings),
    }));
    await redisClient.set(cacheKey, JSON.stringify(orders), { EX: 300 });
    res.json(orders);
  } catch (err) {
    console.error("Active orders fetch error:", err);
    res.status(500).json({ error: "Failed to fetch active orders" });
  }
});

// ---------------- ESTIMATED WAIT TIME ----------------
router.get("/estimate", async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT COUNT(*) FROM orders
       WHERE status IN ('new', 'preparing') AND created_at::date = CURRENT_DATE AND business_id = $1`,
      [req.business_id]
    );

    const activeOrders = parseInt(result.rows[0].count);
    const basePrepTime = 5;
    const estimatedMinutes = activeOrders * basePrepTime;

    res.json({ activeOrders, estimatedMinutes });
  } catch (err) {
    console.error("Estimate error:", err);
    res.status(500).json({ error: "Failed to estimate wait time" });
  }
});

// ---------------- CUSTOMER EDIT ORDER (within 20s window) ----------------
router.patch("/:id/customer-edit", async (req, res) => {
  const { id } = req.params;
  const { items, customerPhone } = req.body;


  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: "Items required" });
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Validate that all items exist in the database
    const itemIds = [...new Set(items.map(item => parseInt(String(item.id).split('-')[0], 10)).filter(id => !isNaN(id)))];
    if (itemIds.length > 0) {
      const menuCheckRes = await client.query(
        "SELECT id FROM menu_items WHERE id = ANY($1::int[]) AND business_id = $2",
        [itemIds, req.business_id]
      );
      if (menuCheckRes.rows.length !== itemIds.length) {
        throw new Error("Some items in your cart are no longer available on the menu. Please clear your cart and try again.");
      }
    }

    const orderCheck = await client.query(
      "SELECT status, customer_phone, created_at, paid_amount, coupon_code, discount FROM orders WHERE id=$1 AND business_id=$2",
      [id, req.business_id],
    );

    if (!orderCheck.rows.length) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Order not found" });
    }

    const order = orderCheck.rows[0];



    // Only allow editing orders in 'new' status
    if (order.status !== 'new') {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "Order can no longer be edited" });
    }

    // No time window check - once the customer clicks Edit within 20s on the frontend,
    // they can take as long as needed. The backend only checks status === 'new'.

    await client.query("DELETE FROM order_items WHERE order_id=$1", [id]);

    let subtotal = 0;
    for (const item of items) {
      if (!item.id) {
        throw new Error(`Missing menu_item_id for item: ${item.name}`);
      }
      subtotal += Number(item.price) * Number(item.quantity);
      await client.query(
        `INSERT INTO order_items (order_id, menu_item_id, name, price, price_label, quantity, image, business_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [id, parseInt(String(item.id).split('-')[0], 10) || null, item.name, item.price, item.priceLabel || "Full", item.quantity, item.image || "/placeholder.jpg", req.business_id],
      );
    }

    subtotal = roundCurrency(subtotal);

    // Recalculate discount if coupon exists
    const couponCode = order.coupon_code;
    let finalDiscount = 0;

    if (couponCode && parseFloat(order.discount || 0) > 0) {
      const couponRes = await client.query(
        "SELECT discount_type, value FROM coupons WHERE code=$1 AND business_id=$2",
        [couponCode, req.business_id],
      );
      if (couponRes.rows.length) {
        const coupon = couponRes.rows[0];
        finalDiscount =
          coupon.discount_type === "percent"
            ? (subtotal * parseFloat(coupon.value)) / 100
            : parseFloat(coupon.value);
        finalDiscount = Math.min(finalDiscount, subtotal);
        finalDiscount = Math.max(finalDiscount, 0);
        finalDiscount = roundCurrency(finalDiscount);
      }
    }

    const businessSettings = await ensureBusinessSettings(client, req.business_id);
    const totals = calculateOrderTotals({
      subtotal,
      discount: finalDiscount,
      gstEnabled: businessSettings.isGstEnabled,
      cgstRate: businessSettings.cgstRate,
      sgstRate: businessSettings.sgstRate,
    });

    const paidAmount = parseFloat(order.paid_amount || 0);
    const due = roundCurrency(totals.total - paidAmount);
    const newPaymentStatus = due <= 0 ? "paid" : "pending";

    // Force payment method to online for edited orders with due amount
    const newPaymentMethod = due > 0 ? "online" : undefined;

    await client.query(
      `UPDATE orders
       SET subtotal=$1, total=$2, discount=$3, cgst=$4, sgst=$5, gst_total=$6, gst_rate=$7,
           payment_status=$8${newPaymentMethod ? ", payment_method='online'" : ""}
       WHERE id=$9 AND business_id=$10`,
      [totals.subtotal, totals.total, totals.discount, totals.cgst, totals.sgst, totals.gstTotal, totals.gstRate, newPaymentStatus, id, req.business_id],
    );

    await client.query("COMMIT");

    const io = req.app.get("io");
    io.emit("order-updated", { id });
    io.emit("order-editing", { id, editing: false });

    await invalidateDashboardCache();

    // Fetch updated order items for response
    const itemsResult = await pool.query(
      `SELECT menu_item_id, name, price, price_label as "priceLabel", quantity, image 
       FROM order_items 
       WHERE order_id = $1 AND business_id = $2`,
      [id, req.business_id],
    );

    res.json({
      message: "Order updated successfully",
      order: {
        id,
        items: mapOrderItems(itemsResult.rows),
        subtotal: totals.subtotal,
        discount: totals.discount,
        cgst: totals.cgst,
        sgst: totals.sgst,
        gst: totals.gstTotal,
        gstRate: totals.gstRate,
        total: totals.total,
        paidAmount,
        due,
        paymentMethod: due > 0 ? "online" : undefined,
        paymentStatus: newPaymentStatus,
        business: toBusinessResponse(businessSettings),
      },
    });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Customer edit error:", err);
    res.status(500).json({ error: "Failed to update order" });
  } finally {
    client.release();
  }
});

// ---------------- CUSTOMER PAY DUE (no admin auth) ----------------
router.patch("/:id/pay-due", async (req, res) => {
  const { id } = req.params;
  const { customerPhone } = req.body;



  try {
    const orderRes = await pool.query(
      "SELECT total, paid_amount, customer_phone, payment_status FROM orders WHERE id=$1 AND business_id=$2",
      [id, req.business_id],
    );

    if (!orderRes.rows.length) {
      return res.status(404).json({ error: "Order not found" });
    }

    const order = orderRes.rows[0];



    if (order.payment_status === "paid") {
      return res.json({ message: "Already paid", total: parseFloat(order.total), paidAmount: parseFloat(order.total), due: 0, paymentStatus: "paid" });
    }

    const total = parseFloat(order.total);

    await pool.query(
      "UPDATE orders SET paid_amount=$1, payment_status='paid', payment_method='online' WHERE id=$2 AND business_id=$3",
      [total, id, req.business_id],
    );

    const io = req.app.get("io");
    io.emit("payment-updated", { id });

    await invalidateDashboardCache();

    res.json({
      message: "Due paid successfully",
      total,
      paidAmount: total,
      due: 0,
      paymentStatus: "paid",
    });
  } catch (err) {
    console.error("Customer pay due error:", err);
    res.status(500).json({ error: "Failed to pay due" });
  }
});

// ---------------- CUSTOMER EDITING STATUS ----------------
router.post("/:id/editing-start", async (req, res) => {
  const { id } = req.params;
  const { customerPhone } = req.body;



  try {
    const orderRes = await pool.query(
      "SELECT customer_phone, status FROM orders WHERE id=$1 AND business_id=$2",
      [id, req.business_id],
    );
    if (!orderRes.rows.length) return res.status(404).json({ error: "Order not found" });

    if (orderRes.rows[0].status !== "new") {
      return res.status(400).json({ error: "Order cannot be edited" });
    }

    const io = req.app.get("io");
    io.emit("order-editing", { id, editing: true });

    res.json({ message: "Editing started" });
  } catch (err) {
    console.error("Editing start error:", err);
    res.status(500).json({ error: "Failed" });
  }
});

router.post("/:id/editing-end", async (req, res) => {
  const { id } = req.params;

  const io = req.app.get("io");
  io.emit("order-editing", { id, editing: false });

  res.json({ message: "Editing ended" });
});

module.exports = router;
