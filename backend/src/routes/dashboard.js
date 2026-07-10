const express = require("express");
const router = express.Router();
const pool = require("../db/pool");
const redisClient = require("../../config/redis");
const { invalidateDashboardCache, invalidateActiveOrdersHistoryCache } = require("../helpers/cacheHelper");
const { adminAuth } = require("../middleware/adminAuth");
const { ensureBusinessSettings } = require("../utils/businessSettings");
const { calculateOrderTotals } = require("../utils/gst");

// Auth middleware: supports Bearer token (primary), cookie, or header password (fallback)
function auth(req, res, next) {
  // Try Bearer token or cookie via adminAuth
  const authHeader = req.headers.authorization;
  const cookieToken = req.cookies?.admin_token;
  if ((authHeader && authHeader.startsWith("Bearer ")) || cookieToken) {
    return adminAuth(req, res, next);
  }
  // Fallback to header password
  const password = req.headers["x-dashboard-password"];
  if (password && password === process.env.DASHBOARD_PASSWORD) {
    return next();
  }
  return res.status(401).json({ error: "Unauthorized" });
}

// Helper: format order rows with items from a single JOIN query
function formatOrderRows(rows) {
  const ordersMap = new Map();
  for (const row of rows) {
    if (!ordersMap.has(row.id)) {
      ordersMap.set(row.id, {
        id: row.id,
        token: row.token,
        customerName: row.customer_name,
        customerPhone: row.customer_phone,
        items: [],
        subtotal: parseFloat(row.subtotal || 0),
        discount: parseFloat(row.discount || 0),
        cgst: parseFloat(row.cgst || 0),
        sgst: parseFloat(row.sgst || 0),
        gst: parseFloat(row.gst_total || 0),
        gstRate: parseFloat(row.gst_rate || 0),
        total: parseFloat(row.total),
        paymentMethod: row.payment_method,
        paymentStatus: row.payment_status,
        paidAmount: parseFloat(row.paid_amount || 0),
        status: row.status,
        createdAt: row.created_at,
        orderType: row.order_type || "dine-in",
        specialInstructions: row.special_instructions || "",
        tableNumber: row.table_number || null,
        tableSessionId: row.table_session_id || null,
        orderSource: row.order_source || 'counter',
        waiterId: row.waiter_id || null,
        waiterName: row.waiter_name || null,
      });
    }
    if (row.item_name) {
      ordersMap.get(row.id).items.push({
        id: row.item_menu_item_id,
        name: row.item_name,
        price: parseFloat(row.item_price),
        priceLabel: row.item_price_label,
        quantity: row.item_quantity,
        image: row.item_image,
        note: row.item_note || undefined,
      });
    }
  }
  return Array.from(ordersMap.values());
}

// ======================================================
// ---------------- GET TODAY ORDERS ----------------
// ======================================================
router.get("/orders", auth, async (req, res) => {
  res.set("Cache-Control", "no-store, no-cache, must-revalidate");
  try {
    const { rows } = await pool.query(
      `SELECT o.*, oi.name AS item_name, oi.price AS item_price,
              oi.price_label AS item_price_label, oi.quantity AS item_quantity, oi.image AS item_image, oi.menu_item_id AS item_menu_item_id, oi.note AS item_note,
              t.table_number,
              s.name AS waiter_name
       FROM orders o
       LEFT JOIN order_items oi ON oi.order_id = o.id
       LEFT JOIN table_sessions ts ON o.table_session_id = ts.id
       LEFT JOIN tables t ON ts.table_id = t.id
       LEFT JOIN staff s ON o.waiter_id = s.id
       WHERE (o.created_at AT TIME ZONE 'Asia/Kolkata')::date = (NOW() AT TIME ZONE 'Asia/Kolkata')::date
         AND o.business_id = $1
       ORDER BY o.created_at DESC, o.id`,
      [req.business_id]
    );
    res.json(formatOrderRows(rows));
  } catch (err) {
    console.error("Dashboard orders error:", err);
    res.status(500).json({ error: "Failed to fetch orders" });
  }
});

// ======================================================
// ---------------- GET ALL ORDERS ----------------
// ======================================================
router.get("/orders/all", auth, async (req, res) => {
  res.set("Cache-Control", "no-store, no-cache, must-revalidate");
  try {
    const { rows } = await pool.query(
      `SELECT o.*, oi.name AS item_name, oi.price AS item_price,
              oi.price_label AS item_price_label, oi.quantity AS item_quantity, oi.image AS item_image, oi.menu_item_id AS item_menu_item_id, oi.note AS item_note,
              t.table_number,
              s.name AS waiter_name
       FROM orders o
       LEFT JOIN order_items oi ON oi.order_id = o.id
       LEFT JOIN table_sessions ts ON o.table_session_id = ts.id
       LEFT JOIN tables t ON ts.table_id = t.id
       LEFT JOIN staff s ON o.waiter_id = s.id
       WHERE o.business_id = $1
       ORDER BY o.created_at DESC, o.id
       LIMIT 1000`,
      [req.business_id]
    );
    res.json(formatOrderRows(rows));
  } catch (err) {
    console.error("All orders error:", err);
    res.status(500).json({ error: "Failed to fetch all orders" });
  }
});

// ======================================================
// ---------------- UPDATE ORDER STATUS ----------------
// ======================================================
router.patch("/orders/:id/status", auth, async (req, res) => {
  const { status } = req.body;

  if (
    !["approval_pending", "new", "preparing", "ready", "completed", "cancelled"].includes(status)
  ) {
    return res.status(400).json({ error: "Invalid status" });
  }

  try {
    // Block status advancement if there's unpaid due amount (except cancellation AND table orders)
    if (status !== "cancelled") {
      const orderCheck = await pool.query(
        "SELECT total, paid_amount, order_source FROM orders WHERE id = $1 AND business_id = $2",
        [req.params.id, req.business_id],
      );
      if (orderCheck.rows.length) {
        const orderData = orderCheck.rows[0];
        const total = parseFloat(orderData.total);
        const paid = parseFloat(orderData.paid_amount || 0);
        
        // Only enforce payment block for non-table orders
        if (orderData.order_source !== 'table' && paid < total) {
          return res
            .status(400)
            .json({
              error:
                "Cannot advance order with unpaid due amount. Mark payment first.",
            });
        }
      }
    }

    const update = await pool.query(
      "UPDATE orders SET status = $1 WHERE id = $2 AND business_id = $3 RETURNING *",
      [status, req.params.id, req.business_id],
    );

    if (!update.rowCount) {
      return res.status(404).json({ error: "Order not found" });
    }

    const io = req.app.get("io");
    io.emit("order-updated", {
      id: update.rows[0].id,
      token: update.rows[0].token,
      status: update.rows[0].status,
    });
    
    // Loyalty Points Logic (Skip table orders, they are handled in apiSessionClose)
    if (status === "completed" && update.rows[0].customer_phone && update.rows[0].customer_phone !== "0000000000" && !update.rows[0].table_session_id) {
      const order = update.rows[0];
      const settingsRes = await pool.query(
        "SELECT loyalty_enabled, loyalty_points_per_100 FROM business_settings WHERE business_id = $1", 
        [req.business_id]
      );
      const settings = settingsRes.rows[0];
      
      if (settings && settings.loyalty_enabled) {
        const pointsEarned = parseFloat(((parseFloat(order.total) / 100) * settings.loyalty_points_per_100).toFixed(2));
        
        if (pointsEarned > 0) {
          // Record points_earned
          await pool.query("UPDATE orders SET points_earned = $1 WHERE id = $2", [pointsEarned, order.id]);
          
          // Upsert customers table
          await pool.query(`
            INSERT INTO customers (business_id, phone, name, points_balance, total_spent, last_visit)
            VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
            ON CONFLICT (business_id, phone)
            DO UPDATE SET 
              points_balance = customers.points_balance + $4,
              total_spent = customers.total_spent + $5,
              last_visit = CURRENT_TIMESTAMP,
              name = CASE WHEN customers.name = '' OR customers.name = 'Guest' THEN EXCLUDED.name ELSE customers.name END
          `, [req.business_id, order.customer_phone, order.customer_name || 'Guest', pointsEarned, parseFloat(order.total)]);
        }
      }
    }

    await invalidateDashboardCache(req.business_id);
    await invalidateActiveOrdersHistoryCache(update.rows[0].customer_phone, req.business_id);
    res.json({ success: true });
  } catch (err) {
    console.error("Update status error:", err);
    res.status(500).json({ error: "Failed to update status" });
  }
});

// ======================================================
// ---------------- UPDATE PAYMENT STATUS ----------------
// ======================================================
router.patch("/orders/:id/payment", auth, async (req, res) => {
  const { paymentStatus } = req.body;

  if (!["pending", "paid"].includes(paymentStatus)) {
    return res.status(400).json({ error: "Invalid payment status" });
  }

  try {
    const orderRes = await pool.query("SELECT total FROM orders WHERE id=$1 AND business_id=$2", [
      req.params.id, req.business_id,
    ]);

    if (!orderRes.rows.length) {
      return res.status(404).json({ error: "Order not found" });
    }

    const total = parseFloat(orderRes.rows[0].total);
    const paidAmount = paymentStatus === "paid" ? total : 0;

    await pool.query(
      "UPDATE orders SET payment_status=$1, paid_amount=$2 WHERE id=$3 AND business_id=$4",
      [paymentStatus, paidAmount, req.params.id, req.business_id],
    );

    const io = req.app.get("io");
    io.emit("payment-updated", { id: req.params.id });

    await invalidateDashboardCache(req.business_id);
    res.json({ success: true });
  } catch (err) {
    console.error("Update payment error:", err);
    res.status(500).json({ error: "Failed to update payment" });
  }
});

// ======================================================
// ---------------- UPDATE ORDER ITEMS ----------------
// ======================================================
router.patch("/orders/:id/items", auth, async (req, res) => {
  const { id } = req.params;
  const { items } = req.body;

  if (!items || !Array.isArray(items) || !items.length) {
    return res.status(400).json({ error: "Items are required" });
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const orderCheck = await client.query(
      "SELECT status, paid_amount, coupon_code, discount FROM orders WHERE id=$1 AND business_id=$2",
      [id, req.business_id],
    );

    if (!orderCheck.rows.length) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Order not found" });
    }

    if (orderCheck.rows[0].status !== "new") {
      // Allow admins and managers to override and edit anytime
      if (!req.admin || !["admin", "manager"].includes(req.admin.role)) {
        await client.query("ROLLBACK");
        return res
          .status(400)
          .json({ error: "Order cannot be updated after preparing started" });
      }
    }

    await client.query("DELETE FROM order_items WHERE order_id=$1", [id]);

    let subtotal = 0;
    for (const item of items) {
      if (!item.id) {
        throw new Error(`Missing menu_item_id for item: ${item.name}`);
      }
      subtotal += item.price * item.quantity;
      await client.query(
        `INSERT INTO order_items (order_id, name, price, price_label, quantity, image, menu_item_id, business_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          id,
          item.name,
          item.price,
          item.priceLabel,
          item.quantity,
          item.image,
          parseInt(String(item.id).split('-')[0], 10) || null,
          req.business_id,
        ],
      );
    }

    const existingDiscount = parseFloat(orderCheck.rows[0].discount || 0);
    const couponCode = orderCheck.rows[0].coupon_code;
    let finalDiscount = 0;

    if (couponCode && existingDiscount > 0) {
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
        finalDiscount = Number(finalDiscount.toFixed(2));
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

    const newPaidAmount = totals.total;
    const due = 0;
    const newPaymentStatus = "paid";

    await client.query(
      `UPDATE orders
       SET subtotal=$1, total=$2, discount=$3, cgst=$4, sgst=$5, gst_total=$6, gst_rate=$7, payment_status=$8, paid_amount=$9
       WHERE id=$10 AND business_id=$11`,
      [
        totals.subtotal,
        totals.total,
        totals.discount,
        totals.cgst,
        totals.sgst,
        totals.gstTotal,
        totals.gstRate,
        newPaymentStatus,
        newPaidAmount,
        id,
        req.business_id,
      ],
    );

    await client.query("COMMIT");

    const io = req.app.get("io");
    io.emit("order-updated", { id });

    await invalidateDashboardCache(req.business_id);

    res.json({
      message: "Order updated successfully",
      subtotal: totals.subtotal,
      total: totals.total,
      paidAmount: newPaidAmount,
      due,
      paymentStatus: newPaymentStatus,
    });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Update items error:", err);
    res.status(500).json({ error: "Failed to update order items" });
  } finally {
    client.release();
  }
});

// ======================================================
// ---------------- PAY DUE ----------------
// ======================================================
router.patch("/orders/:id/pay-due", auth, async (req, res) => {
  const { id } = req.params;

  try {
    const orderRes = await pool.query(
      "SELECT total, paid_amount FROM orders WHERE id=$1 AND business_id=$2",
      [id, req.business_id],
    );

    if (!orderRes.rows.length) {
      return res.status(404).json({ error: "Order not found" });
    }

    const total = parseFloat(orderRes.rows[0].total);

    await pool.query(
      "UPDATE orders SET paid_amount=$1, payment_status='paid' WHERE id=$2 AND business_id=$3",
      [total, id, req.business_id],
    );

    const io = req.app.get("io");
    io.emit("payment-updated", { id });

    await invalidateDashboardCache(req.business_id);

    res.json({
      message: "Due paid successfully",
      total,
      paidAmount: total,
      due: 0,
      paymentStatus: "paid",
    });
  } catch (err) {
    console.error("Pay due error:", err);
    res.status(500).json({ error: "Failed to pay due" });
  }
});

// ======================================================
// ---------------- DELETE ORDER ----------------
// ======================================================
router.delete("/orders/:id", auth, async (req, res) => {
  const { id } = req.params;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    // Verify ownership before deleting items
    const checkAuth = await client.query("SELECT id FROM orders WHERE id = $1 AND business_id = $2", [id, req.business_id]);
    if (!checkAuth.rowCount) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Order not found" });
    }

    await client.query("DELETE FROM order_items WHERE order_id = $1", [id]);
    await client.query("DELETE FROM orders WHERE id = $1", [id]);
    await client.query("COMMIT");

    const io = req.app.get("io");
    io.emit("order-updated", { id, deleted: true });
    await invalidateDashboardCache(req.business_id);

    res.json({ message: "Order deleted", id });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Delete order error:", err);
    res.status(500).json({ error: "Failed to delete order" });
  } finally {
    client.release();
  }
});

// ======================================================
// ---------------- DASHBOARD STATS ----------------
// ======================================================
router.get("/stats", auth, async (req, res) => {
  try {
    const cacheKey = `stats:today:${req.business_id}`;

    const cached = await redisClient.get(cacheKey);
    if (cached) return res.json(JSON.parse(cached));

    const today = await pool.query(`
      SELECT 
        COUNT(*) as total_orders,
        COALESCE(SUM(total), 0) as total_revenue,
        COUNT(*) FILTER (WHERE status = 'approval_pending') as approval_pending_orders,
        COUNT(*) FILTER (WHERE status = 'new') as new_orders,
        COUNT(*) FILTER (WHERE status = 'preparing') as preparing_orders,
        COUNT(*) FILTER (WHERE status = 'ready') as ready_orders,
        COUNT(*) FILTER (WHERE status = 'completed') as completed_orders
      FROM orders 
      WHERE (created_at AT TIME ZONE 'Asia/Kolkata')::date =
      (NOW() AT TIME ZONE 'Asia/Kolkata')::date 
      AND business_id = $1
    `, [req.business_id]);

    const popular = await pool.query(`
      SELECT oi.name, SUM(oi.quantity) as total_qty
      FROM order_items oi 
      JOIN orders o ON oi.order_id = o.id
      WHERE (o.created_at AT TIME ZONE 'Asia/Kolkata')::date =
      (NOW() AT TIME ZONE 'Asia/Kolkata')::date
      AND o.business_id = $1
      GROUP BY oi.name 
      ORDER BY total_qty DESC 
      LIMIT 5
    `, [req.business_id]);

    const responseData = { ...today.rows[0], popularItems: popular.rows };

    await redisClient.set(cacheKey, JSON.stringify(responseData), { EX: 60 });
    res.json(responseData);
  } catch (err) {
    console.error("Stats error:", err);
    res.status(500).json({ error: "Failed to fetch stats" });
  }
});

// ======================================================
// ---------------- SALES REPORT ----------------
// ======================================================
router.get("/sales-report", auth, async (req, res) => {
  const { type = "daily", date, year, month, orderType } = req.query;
  
  // Build order type filter clause
  const otFilter = orderType ? ` AND COALESCE(order_type, 'dine-in') = '${orderType.replace(/[^a-z-]/gi, '')}'` : "";

  try {
    // ==================================================
    // ================= DAILY ==========================
    // ==================================================
    if (type === "daily") {
      // Always use stable ISO date
      const reportDate = date || new Date().toISOString().split("T")[0];

      const cacheKey = `sales:daily:${reportDate}:${orderType || 'all'}:${req.business_id}`;

      // ---------------- CACHE ----------------
      const cached = await redisClient.get(cacheKey);
      if (cached) {
        console.log("CACHE HIT:", cacheKey);
        return res.json(JSON.parse(cached));
      }

      console.log("CACHE MISS:", cacheKey);

      // ---------------- MAIN STATS ----------------
      const result = await pool.query(
        `
    SELECT 
      COUNT(*) as total_orders,
      COALESCE(SUM(total), 0) as total_revenue,
      COALESCE(SUM(CASE WHEN payment_status='paid' THEN total ELSE 0 END), 0) as paid_revenue,
      COALESCE(SUM(CASE WHEN payment_status='pending' THEN total ELSE 0 END), 0) as pending_revenue
    FROM orders
    WHERE (created_at AT TIME ZONE 'Asia/Kolkata')::date = $1::date
      AND status != 'cancelled'
      AND business_id = $2${otFilter}
    `,
        [reportDate, req.business_id],
      );

      const row = result.rows[0];

      // ---------------- TOP ITEMS ----------------
      const topItemsResult = await pool.query(
        `
    SELECT oi.name, SUM(oi.quantity)::int as qty
    FROM order_items oi
    JOIN orders o ON oi.order_id = o.id
    WHERE o.status != 'cancelled'
      AND o.business_id = $2
      AND (o.created_at AT TIME ZONE 'Asia/Kolkata')::date = $1::date${otFilter}
    GROUP BY oi.name
    ORDER BY qty DESC
    LIMIT 5
    `,
        [reportDate, req.business_id],
      );

      // ---------------- LEAST ITEMS ----------------
      const leastItemsResult = await pool.query(
        `
    SELECT oi.name, SUM(oi.quantity)::int as qty
    FROM order_items oi
    JOIN orders o ON oi.order_id = o.id
    WHERE o.status != 'cancelled'
      AND o.business_id = $2
      AND (o.created_at AT TIME ZONE 'Asia/Kolkata')::date = $1::date${otFilter}
    GROUP BY oi.name
    ORDER BY qty ASC
    LIMIT 5
    `,
        [reportDate, req.business_id],
      );

      // ---------------- HOURLY DISTRIBUTION ----------------
      const hourlyResult = await pool.query(
        `
    SELECT 
      EXTRACT(HOUR FROM created_at AT TIME ZONE 'Asia/Kolkata')::int as hour,
      COUNT(*)::int as orders,
      COALESCE(SUM(total), 0)::numeric as revenue
    FROM orders
    WHERE (created_at AT TIME ZONE 'Asia/Kolkata')::date = $1::date
      AND status != 'cancelled' AND business_id = $2${otFilter}
    GROUP BY hour
    ORDER BY hour
    `,
        [reportDate, req.business_id],
      );

      // ---------------- PAYMENT SPLIT ----------------
      const paymentSplitResult = await pool.query(
        `
    SELECT 
      payment_method as method,
      COUNT(*)::int as count,
      COALESCE(SUM(total), 0)::numeric as revenue,
      COALESCE(SUM(split_cash), 0)::numeric as split_cash,
      COALESCE(SUM(split_upi), 0)::numeric as split_upi
    FROM orders
    WHERE (created_at AT TIME ZONE 'Asia/Kolkata')::date = $1::date
      AND status != 'cancelled' AND business_id = $2${otFilter}
    GROUP BY payment_method
    `,
        [reportDate, req.business_id],
      );

      // ---------------- RESPONSE ----------------
      const responseData = {
        type: "daily",
        date: reportDate,
        totalOrders: Number(row.total_orders),
        totalRevenue: Number(row.total_revenue),
        paidRevenue: Number(row.paid_revenue),
        pendingRevenue: Number(row.pending_revenue),

        topItems: topItemsResult.rows,
        leastItems: leastItemsResult.rows,

        hourlyDistribution: hourlyResult.rows.map((h) => ({
          hour: h.hour,
          orders: h.orders,
          revenue: Number(h.revenue),
        })),

        paymentSplit: (() => {
          let cashRev = 0, upiRev = 0, onlineRev = 0, cardRev = 0, counterRev = 0;
          let cashCount = 0, upiCount = 0, onlineCount = 0, cardCount = 0, counterCount = 0;
          paymentSplitResult.rows.forEach(p => {
            if (p.method === 'split') {
              cashRev += Number(p.split_cash);
              upiRev += Number(p.split_upi);
              cashCount += p.count; // assign split count to cash by default
            } else if (p.method === 'cash') {
              cashRev += Number(p.revenue); cashCount += p.count;
            } else if (p.method === 'upi') {
              upiRev += Number(p.revenue); upiCount += p.count;
            } else if (p.method === 'online') {
              onlineRev += Number(p.revenue); onlineCount += p.count;
            } else if (p.method === 'card') {
              cardRev += Number(p.revenue); cardCount += p.count;
            } else if (p.method === 'counter') {
              counterRev += Number(p.revenue); counterCount += p.count;
            }
          });
          return [
            { method: 'cash', count: cashCount, revenue: cashRev },
            { method: 'upi', count: upiCount, revenue: upiRev },
            { method: 'online', count: onlineCount, revenue: onlineRev },
            { method: 'card', count: cardCount, revenue: cardRev },
            { method: 'counter', count: counterCount, revenue: counterRev }
          ].filter(p => p.revenue > 0 || p.count > 0);
        })(),
      };

      // ---------------- CACHE SAVE ----------------
      await redisClient.set(cacheKey, JSON.stringify(responseData), {
        EX: 60 * 5, // 5 minutes (better than 60 sec)
      });

      return res.json(responseData);
    }

    // ==================================================
    // ================= WEEKLY =========================
    // ==================================================
    if (type === "weekly") {
      const today = new Date();

      // Always use ISO base (stable)
      const baseDate = new Date(today.toISOString().split("T")[0]);

      const dayOfWeek = baseDate.getDay();

      // Get Monday
      const monday = new Date(baseDate);
      monday.setDate(baseDate.getDate() - ((dayOfWeek + 6) % 7));

      const start = monday.toISOString().split("T")[0];

      const endDate = new Date(monday);
      endDate.setDate(monday.getDate() + 7);

      const end = endDate.toISOString().split("T")[0];

      const cacheKey = `sales:weekly:${start}:${end}:${orderType || 'all'}:${req.business_id}`;

      // ---------------- CACHE ----------------
      const cached = await redisClient.get(cacheKey);
      if (cached) {
        console.log("CACHE HIT:", cacheKey);
        return res.json(JSON.parse(cached));
      }

      console.log("CACHE MISS:", cacheKey);

      // ---------------- DAILY BREAKDOWN ----------------
      const result = await pool.query(
        `
    SELECT 
      (created_at AT TIME ZONE 'Asia/Kolkata')::date as day,
      COUNT(*)::int as total_orders,
      COALESCE(SUM(total), 0)::numeric as total_revenue
    FROM orders
    WHERE (created_at AT TIME ZONE 'Asia/Kolkata')::date >= $1::date
      AND (created_at AT TIME ZONE 'Asia/Kolkata')::date < $2::date
      AND business_id = $3${otFilter}
    GROUP BY day
    ORDER BY day
    `,
        [start, end, req.business_id],
      );

      // ---------------- TOP ITEMS ----------------
      const topItemsResult = await pool.query(
        `
    SELECT oi.name, SUM(oi.quantity)::int as qty
    FROM order_items oi
    JOIN orders o ON oi.order_id = o.id
    WHERE o.status != 'cancelled'
      AND o.business_id = $3
      AND (o.created_at AT TIME ZONE 'Asia/Kolkata')::date >= $1::date
      AND (o.created_at AT TIME ZONE 'Asia/Kolkata')::date < $2::date${otFilter}
    GROUP BY oi.name
    ORDER BY qty DESC
    LIMIT 5
    `,
        [start, end, req.business_id],
      );

      // ---------------- LEAST ITEMS ----------------
      const leastItemsResult = await pool.query(
        `
    SELECT oi.name, SUM(oi.quantity)::int as qty
    FROM order_items oi
    JOIN orders o ON oi.order_id = o.id
    WHERE o.status != 'cancelled'
      AND o.business_id = $3
      AND (o.created_at AT TIME ZONE 'Asia/Kolkata')::date >= $1::date
      AND (o.created_at AT TIME ZONE 'Asia/Kolkata')::date < $2::date${otFilter}
    GROUP BY oi.name
    ORDER BY qty ASC
    LIMIT 5
    `,
        [start, end, req.business_id],
      );

      // ---------------- RESPONSE ----------------
      const responseData = {
        type: "weekly",
        weekStart: start,
        weekEnd: end,

        totalOrders: result.rows.reduce(
          (s, r) => s + Number(r.total_orders),
          0,
        ),

        totalRevenue: result.rows.reduce(
          (s, r) => s + Number(r.total_revenue),
          0,
        ),

        days: result.rows.map((r) => ({
          date: r.day,
          orders: Number(r.total_orders),
          revenue: Number(r.total_revenue),
        })),

        topItems: topItemsResult.rows,
        leastItems: leastItemsResult.rows,
      };

      // ---------------- CACHE SAVE ----------------
      await redisClient.set(cacheKey, JSON.stringify(responseData), {
        EX: 60 * 5, // 5 min cache (better)
      });

      return res.json(responseData);
    }

    // ==================================================
    // ================= MONTHLY ========================
    // ==================================================
    if (type === "monthly") {
      const selectedYear = year ? parseInt(year) : new Date().getFullYear();

      const selectedMonth = month ? parseInt(month) : new Date().getMonth() + 1;

      const cacheKey = `sales:monthly:${selectedYear}:${selectedMonth}:${orderType || 'all'}:${req.business_id}`;

      const cached = await redisClient.get(cacheKey);
      if (cached) {
        console.log("CACHE HIT:", cacheKey);
        return res.json(JSON.parse(cached));
      }

      console.log("CACHE MISS:", cacheKey);

      const result = await pool.query(
        `
        SELECT 
          (created_at AT TIME ZONE 'Asia/Kolkata')::date as day,
          COUNT(*) as total_orders,
          COALESCE(SUM(total), 0) as total_revenue
        FROM orders
        WHERE EXTRACT(YEAR FROM created_at AT TIME ZONE 'Asia/Kolkata') = $1
        AND EXTRACT(MONTH FROM created_at AT TIME ZONE 'Asia/Kolkata') = $2
        AND business_id = $3${otFilter}
        GROUP BY day
        ORDER BY day ASC
        `,
        [selectedYear, selectedMonth, req.business_id],
      );

      const days = result.rows.map((r) => ({
        date: r.day,
        orders: parseInt(r.total_orders),
        revenue: parseFloat(r.total_revenue),
      }));

      const totalOrders = days.reduce((sum, d) => sum + d.orders, 0);
      const totalRevenue = days.reduce((sum, d) => sum + d.revenue, 0);

      // Top & least sold items for the month
      const topItemsResult = await pool.query(
        `
        SELECT oi.name, SUM(oi.quantity)::int as qty
        FROM order_items oi JOIN orders o ON oi.order_id = o.id
        WHERE o.status != 'cancelled'
          AND o.business_id = $3
          AND EXTRACT(YEAR FROM o.created_at AT TIME ZONE 'Asia/Kolkata') = $1
          AND EXTRACT(MONTH FROM o.created_at AT TIME ZONE 'Asia/Kolkata') = $2${otFilter}
        GROUP BY oi.name ORDER BY qty DESC LIMIT 5
      `,
        [selectedYear, selectedMonth, req.business_id],
      );

      const leastItemsResult = await pool.query(
        `
        SELECT oi.name, SUM(oi.quantity)::int as qty
        FROM order_items oi JOIN orders o ON oi.order_id = o.id
        WHERE o.status != 'cancelled'
          AND o.business_id = $3
          AND EXTRACT(YEAR FROM o.created_at AT TIME ZONE 'Asia/Kolkata') = $1
          AND EXTRACT(MONTH FROM o.created_at AT TIME ZONE 'Asia/Kolkata') = $2${otFilter}
        GROUP BY oi.name ORDER BY qty ASC LIMIT 5
      `,
        [selectedYear, selectedMonth, req.business_id],
      );

      const responseData = {
        type: "monthly",
        year: selectedYear,
        month: selectedMonth,
        totalOrders,
        totalRevenue,
        avgOrderValue:
          totalOrders > 0 ? Math.round(totalRevenue / totalOrders) : 0,
        days,
        topItems: topItemsResult.rows,
        leastItems: leastItemsResult.rows,
      };

      await redisClient.set(cacheKey, JSON.stringify(responseData), { EX: 60 });

      return res.json(responseData);
    }

    // ==================================================
    // ================= YEARLY =========================
    // ==================================================
    if (type === "yearly") {
      const selectedYear = year ? parseInt(year) : new Date().getFullYear();

      const cacheKey = `sales:yearly:${selectedYear}:${orderType || 'all'}:${req.business_id}`;

      const cached = await redisClient.get(cacheKey);
      if (cached) {
        console.log("CACHE HIT:", cacheKey);
        return res.json(JSON.parse(cached));
      }

      console.log("CACHE MISS:", cacheKey);

      const result = await pool.query(
        `
        SELECT 
          TO_CHAR(created_at AT TIME ZONE 'Asia/Kolkata', 'Mon') as month,
          EXTRACT(MONTH FROM created_at AT TIME ZONE 'Asia/Kolkata') as month_num,
          COUNT(*) as total_orders,
          COALESCE(SUM(total), 0) as total_revenue
        FROM orders
        WHERE EXTRACT(YEAR FROM created_at AT TIME ZONE 'Asia/Kolkata') = $1
          AND business_id = $2${otFilter}
        GROUP BY month, month_num
        ORDER BY month_num
        `,
        [selectedYear, req.business_id],
      );

      // Top & least sold items for the year
      const topItemsResult = await pool.query(
        `
        SELECT oi.name, SUM(oi.quantity)::int as qty
        FROM order_items oi JOIN orders o ON oi.order_id = o.id
        WHERE o.status != 'cancelled'
          AND o.business_id = $2
          AND EXTRACT(YEAR FROM o.created_at AT TIME ZONE 'Asia/Kolkata') = $1${otFilter}
        GROUP BY oi.name ORDER BY qty DESC LIMIT 5
      `,
        [selectedYear, req.business_id],
      );

      const leastItemsResult = await pool.query(
        `
        SELECT oi.name, SUM(oi.quantity)::int as qty
        FROM order_items oi JOIN orders o ON oi.order_id = o.id
        WHERE o.status != 'cancelled'
          AND o.business_id = $2
          AND EXTRACT(YEAR FROM o.created_at AT TIME ZONE 'Asia/Kolkata') = $1${otFilter}
        GROUP BY oi.name ORDER BY qty ASC LIMIT 5
      `,
        [selectedYear, req.business_id],
      );

      const responseData = {
        type: "yearly",
        year: selectedYear,
        totalOrders: result.rows.reduce(
          (s, r) => s + parseInt(r.total_orders),
          0,
        ),
        totalRevenue: result.rows.reduce(
          (s, r) => s + parseFloat(r.total_revenue),
          0,
        ),
        months: result.rows.map((r) => ({
          month: r.month,
          monthNumber: parseInt(r.month_num),
          orders: parseInt(r.total_orders),
          revenue: parseFloat(r.total_revenue),
        })),
        topItems: topItemsResult.rows,
        leastItems: leastItemsResult.rows,
      };

      await redisClient.set(cacheKey, JSON.stringify(responseData), { EX: 60 });

      return res.json(responseData);
    }

    // ==================================================
    // ================= DAYWISE ========================
    // ==================================================
    if (type === "daywise") {
      const cacheKey = `sales:daywise:${orderType || 'all'}:${req.business_id}`;

      const cached = await redisClient.get(cacheKey);
      if (cached) {
        console.log("CACHE HIT:", cacheKey);
        return res.json(JSON.parse(cached));
      }

      console.log("CACHE MISS:", cacheKey);

      const result = await pool.query(
        `
        SELECT 
          (created_at AT TIME ZONE 'Asia/Kolkata')::date as day,
          COUNT(*) as total_orders,
          COALESCE(SUM(total), 0) as total_revenue
        FROM orders
        WHERE business_id = $1${otFilter}
        GROUP BY day
        ORDER BY day DESC
        `,
        [req.business_id]
      );

      const days = result.rows.map((r) => ({
        date: r.day,
        orders: parseInt(r.total_orders),
        revenue: parseFloat(r.total_revenue),
      }));

      const totalOrders = days.reduce((sum, d) => sum + d.orders, 0);
      const totalRevenue = days.reduce((sum, d) => sum + d.revenue, 0);

      const responseData = {
        type: "daywise",
        totalOrders,
        totalRevenue: Number(totalRevenue.toFixed(2)),
        avgOrderValue:
          totalOrders > 0 ? Math.round(totalRevenue / totalOrders) : 0,
        days,
      };

      await redisClient.set(cacheKey, JSON.stringify(responseData), { EX: 60 });

      return res.json(responseData);
    }

    return res.status(400).json({
      error: "Invalid report type. Use daily, weekly, monthly, yearly, daywise",
    });
  } catch (err) {
    console.error("Sales report error:", err);
    res.status(500).json({ error: "Failed to generate sales report" });
  }
});

// ======================================================
// ------------ MENU PERFORMANCE ANALYTICS -------------
// ======================================================
router.get("/menu-analytics", auth, async (req, res) => {
  try {
    const cacheKey = `menu-analytics:${req.business_id}`;
    const cached = await redisClient.get(cacheKey);
    if (cached) return res.json(JSON.parse(cached));

    // Most ordered item (all time)
    const mostOrdered = await pool.query(`
      SELECT oi.name, SUM(oi.quantity)::int as total_orders
      FROM order_items oi
      JOIN orders o ON oi.order_id = o.id
      WHERE o.status != 'cancelled' AND o.business_id = $1
      GROUP BY oi.name
      ORDER BY total_orders DESC
      LIMIT 1
    `, [req.business_id]);

    // Most profitable item (highest revenue)
    const mostProfitable = await pool.query(`
      SELECT oi.name, SUM(oi.quantity * oi.price)::numeric(10,2) as total_revenue
      FROM order_items oi
      JOIN orders o ON oi.order_id = o.id
      WHERE o.status != 'cancelled' AND o.business_id = $1
      GROUP BY oi.name
      ORDER BY total_revenue DESC
      LIMIT 1
    `, [req.business_id]);

    // Least ordered item
    const leastOrdered = await pool.query(`
      SELECT oi.name, SUM(oi.quantity)::int as total_orders
      FROM order_items oi
      JOIN orders o ON oi.order_id = o.id
      WHERE o.status != 'cancelled' AND o.business_id = $1
      GROUP BY oi.name
      ORDER BY total_orders ASC
      LIMIT 1
    `, [req.business_id]);

    // Top 5 items by quantity
    const topItems = await pool.query(`
      SELECT oi.name, SUM(oi.quantity)::int as total_orders, SUM(oi.quantity * oi.price)::numeric(10,2) as total_revenue
      FROM order_items oi
      JOIN orders o ON oi.order_id = o.id
      WHERE o.status != 'cancelled' AND o.business_id = $1
      GROUP BY oi.name
      ORDER BY total_orders DESC
      LIMIT 5
    `, [req.business_id]);

    // Order status distribution (all time)
    const statusDist = await pool.query(`
      SELECT status, COUNT(*)::int as count
      FROM orders
      WHERE business_id = $1
      GROUP BY status
    `, [req.business_id]);

    // Hourly order distribution (today)
    const hourlyDist = await pool.query(`
      SELECT EXTRACT(HOUR FROM created_at AT TIME ZONE 'Asia/Kolkata')::int as hour, COUNT(*)::int as orders
      FROM orders
      WHERE (created_at AT TIME ZONE 'Asia/Kolkata')::date = (NOW() AT TIME ZONE 'Asia/Kolkata')::date
        AND business_id = $1
      GROUP BY hour
      ORDER BY hour
    `, [req.business_id]);

    // Last 7 days trend
    const weeklyTrend = await pool.query(`
      SELECT (created_at AT TIME ZONE 'Asia/Kolkata')::date as day, COUNT(*)::int as orders, COALESCE(SUM(total),0)::numeric(10,2) as revenue
      FROM orders
      WHERE created_at >= NOW() - INTERVAL '7 days'
        AND business_id = $1
      GROUP BY day
      ORDER BY day
    `, [req.business_id]);

    // Payment method split
    const paymentSplit = await pool.query(`
      SELECT 
        payment_method, 
        COUNT(*)::int as count, 
        COALESCE(SUM(total),0)::numeric(10,2) as revenue,
        COALESCE(SUM(split_cash),0)::numeric(10,2) as split_cash,
        COALESCE(SUM(split_upi),0)::numeric(10,2) as split_upi
      FROM orders
      WHERE status != 'cancelled' AND business_id = $1
      GROUP BY payment_method
    `, [req.business_id]);

    // Order type distribution
    const orderTypeDist = await pool.query(`
      SELECT COALESCE(order_type, 'dine-in') as order_type, COUNT(*)::int as count, COALESCE(SUM(total),0)::numeric(10,2) as revenue
      FROM orders
      WHERE status != 'cancelled' AND business_id = $1
      GROUP BY order_type
    `, [req.business_id]);

    const data = {
      mostOrdered: mostOrdered.rows[0] || null,
      mostProfitable: mostProfitable.rows[0] || null,
      leastOrdered: leastOrdered.rows[0] || null,
      topItems: topItems.rows,
      statusDistribution: statusDist.rows,
      hourlyDistribution: hourlyDist.rows,
      weeklyTrend: weeklyTrend.rows.map((r) => ({
        day: r.day,
        orders: r.orders,
        revenue: parseFloat(r.revenue),
      })),
      paymentSplit: (() => {
        let cashRev = 0, upiRev = 0, onlineRev = 0, cardRev = 0, counterRev = 0;
        let cashCount = 0, upiCount = 0, onlineCount = 0, cardCount = 0, counterCount = 0;
        paymentSplit.rows.forEach(p => {
          if (p.payment_method === 'split') {
            cashRev += parseFloat(p.split_cash);
            upiRev += parseFloat(p.split_upi);
            cashCount += p.count; 
          } else if (p.payment_method === 'cash') {
            cashRev += parseFloat(p.revenue); cashCount += p.count;
          } else if (p.payment_method === 'upi') {
            upiRev += parseFloat(p.revenue); upiCount += p.count;
          } else if (p.payment_method === 'online') {
            onlineRev += parseFloat(p.revenue); onlineCount += p.count;
          } else if (p.payment_method === 'card') {
            cardRev += parseFloat(p.revenue); cardCount += p.count;
          } else if (p.payment_method === 'counter') {
            counterRev += parseFloat(p.revenue); counterCount += p.count;
          }
        });
        return [
          { method: 'cash', count: cashCount, revenue: cashRev },
          { method: 'upi', count: upiCount, revenue: upiRev },
          { method: 'online', count: onlineCount, revenue: onlineRev },
          { method: 'card', count: cardCount, revenue: cardRev },
          { method: 'counter', count: counterCount, revenue: counterRev }
        ].filter(p => p.revenue > 0 || p.count > 0);
      })(),
      orderTypeDistribution: orderTypeDist.rows.map((r) => ({
        type: r.order_type,
        count: r.count,
        revenue: parseFloat(r.revenue),
      })),
    };

    await redisClient.set(cacheKey, JSON.stringify(data), { EX: 60 });
    res.json(data);
  } catch (err) {
    console.error("Menu analytics error:", err);
    res.status(500).json({ error: "Failed to fetch menu analytics" });
  }
});

// ======================================================
// ------------ CUSTOMER ANALYTICS ---------------------
// ======================================================
router.get("/customer-analytics", auth, async (req, res) => {
  try {
    const cacheKey = `customer-analytics:${req.business_id}`;
    const cached = await redisClient.get(cacheKey);
    if (cached) return res.json(JSON.parse(cached));

    // Top 10 customers by order count
    const topByOrders = await pool.query(`
      SELECT MAX(customer_name) AS customer_name, customer_phone,
             COUNT(*)::int AS total_orders,
             COALESCE(SUM(total), 0)::numeric(10,2) AS total_spent
      FROM orders
      WHERE status != 'cancelled' AND business_id = $1
      GROUP BY customer_phone
      ORDER BY total_orders DESC
      LIMIT 10
    `, [req.business_id]);

    // Top 10 customers by total spend
    const topBySpend = await pool.query(`
      SELECT MAX(customer_name) AS customer_name, customer_phone,
             COUNT(*)::int AS total_orders,
             COALESCE(SUM(total), 0)::numeric(10,2) AS total_spent
      FROM orders
      WHERE status != 'cancelled' AND business_id = $1
      GROUP BY customer_phone
      ORDER BY total_spent DESC
      LIMIT 10
    `, [req.business_id]);

    // Top 10 customers by unique items ordered
    const topByVariety = await pool.query(`
      SELECT MAX(o.customer_name) AS customer_name, o.customer_phone,
             COUNT(DISTINCT oi.name)::int AS unique_items,
             COUNT(*)::int AS total_orders
      FROM orders o
      JOIN order_items oi ON oi.order_id = o.id
      WHERE o.status != 'cancelled' AND o.business_id = $1
      GROUP BY o.customer_phone
      ORDER BY unique_items DESC
      LIMIT 10
    `, [req.business_id]);

    // Overall customer stats
    const customerStats = await pool.query(`
      SELECT COUNT(DISTINCT customer_phone)::int AS total_customers,
             ROUND(AVG(order_count))::int AS avg_orders_per_customer
      FROM (
        SELECT customer_phone, COUNT(*) AS order_count
        FROM orders WHERE status != 'cancelled' AND business_id = $1
        GROUP BY customer_phone
      ) sub
    `, [req.business_id]);

    // Repeat vs one-time customers
    const repeatStats = await pool.query(`
      SELECT
        SUM(CASE WHEN order_count > 1 THEN 1 ELSE 0 END)::int AS repeat_customers,
        SUM(CASE WHEN order_count = 1 THEN 1 ELSE 0 END)::int AS one_time_customers
      FROM (
        SELECT customer_phone, COUNT(*) AS order_count
        FROM orders WHERE status != 'cancelled' AND business_id = $1
        GROUP BY customer_phone
      ) sub
    `, [req.business_id]);

    const data = {
      topByOrders: topByOrders.rows.map(r => ({
        name: r.customer_name,
        phone: r.customer_phone,
        totalOrders: r.total_orders,
        totalSpent: parseFloat(r.total_spent),
      })),
      topBySpend: topBySpend.rows.map(r => ({
        name: r.customer_name,
        phone: r.customer_phone,
        totalOrders: r.total_orders,
        totalSpent: parseFloat(r.total_spent),
      })),
      topByVariety: topByVariety.rows.map(r => ({
        name: r.customer_name,
        phone: r.customer_phone,
        uniqueItems: r.unique_items,
        totalOrders: r.total_orders,
      })),
      totalCustomers: customerStats.rows[0]?.total_customers || 0,
      avgOrdersPerCustomer: customerStats.rows[0]?.avg_orders_per_customer || 0,
      repeatCustomers: repeatStats.rows[0]?.repeat_customers || 0,
      oneTimeCustomers: repeatStats.rows[0]?.one_time_customers || 0,
    };

    await redisClient.set(cacheKey, JSON.stringify(data), { EX: 60 });
    res.json(data);
  } catch (err) {
    console.error("Customer analytics error:", err);
    res.status(500).json({ error: "Failed to fetch customer analytics" });
  }
});

// ======================================================
// ------------ TABLE ANALYTICS ------------------------
// ======================================================
router.get("/table-analytics", auth, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    let timeFilter = "";
    const params = [req.business_id];
    let paramIndex = 2;
    
    if (startDate && endDate) {
      // Need timezone handling for accurate daily limits
      timeFilter = ` AND (ts.start_time AT TIME ZONE 'Asia/Kolkata') >= $${paramIndex}::timestamp AND (ts.start_time AT TIME ZONE 'Asia/Kolkata') <= $${paramIndex + 1}::timestamp`;
      params.push(`${startDate} 00:00:00`, `${endDate} 23:59:59`);
    }

    const query = `
      SELECT 
        t.table_number,
        COUNT(DISTINCT ts.id) as total_sessions,
        COUNT(DISTINCT o.id) as total_orders,
        COALESCE(SUM(o.total), 0) as total_revenue
      FROM tables t
      LEFT JOIN table_sessions ts ON t.id = ts.table_id ${timeFilter}
      LEFT JOIN orders o ON ts.id = o.table_session_id AND o.payment_status = 'paid'
      WHERE t.business_id = $1
      GROUP BY t.id, t.table_number
      ORDER BY NULLIF(regexp_replace(t.table_number, '\\D', '', 'g'), '')::int NULLS LAST, t.table_number;
    `;

    const { rows } = await pool.query(query, params);
    
    res.json(rows.map(r => ({
      tableNumber: r.table_number,
      totalSessions: parseInt(r.total_sessions),
      totalOrders: parseInt(r.total_orders),
      totalRevenue: parseFloat(r.total_revenue)
    })));

  } catch (err) {
    console.error("Table Analytics Error:", err);
    res.status(500).json({ error: "Failed to fetch table analytics" });
  }
});

// ======================================================
// ------------ TABLE HISTORY (DRILL-DOWN) -------------
// ======================================================
router.get("/table-analytics/:tableNumber/history", auth, async (req, res) => {
  try {
    const { tableNumber } = req.params;
    const { startDate, endDate } = req.query;
    
    let timeFilter = "";
    const params = [tableNumber, req.business_id];
    let paramIndex = 3;
    
    if (startDate && endDate) {
      timeFilter = ` AND (ts.start_time AT TIME ZONE 'Asia/Kolkata') >= $${paramIndex}::timestamp AND (ts.start_time AT TIME ZONE 'Asia/Kolkata') <= $${paramIndex + 1}::timestamp`;
      params.push(`${startDate} 00:00:00`, `${endDate} 23:59:59`);
    }

    const query = `
      SELECT 
        ts.id as session_id,
        ts.customer_name,
        ts.customer_phone,
        ts.start_time,
        ts.status as session_status,
        COALESCE(SUM(o.total), 0) as total_bill,
        json_agg(
          json_build_object(
            'orderId', o.id,
            'status', o.status,
            'total', o.total,
            'items', (
               SELECT json_agg(json_build_object('name', oi.name, 'quantity', oi.quantity, 'price', oi.price))
               FROM order_items oi
               WHERE oi.order_id = o.id
            )
          )
        ) FILTER (WHERE o.id IS NOT NULL) as orders
      FROM table_sessions ts
      JOIN tables t ON ts.table_id = t.id
      LEFT JOIN orders o ON ts.id = o.table_session_id AND o.payment_status = 'paid'
      WHERE t.table_number = $1 AND t.business_id = $2 ${timeFilter}
      GROUP BY ts.id
      ORDER BY ts.start_time DESC;
    `;

    const { rows } = await pool.query(query, params);
    
    res.json(rows.map(r => ({
      id: r.session_id,
      customerName: r.customer_name,
      customerPhone: r.customer_phone,
      startTime: r.start_time,
      status: r.session_status,
      totalBill: parseFloat(r.total_bill),
      orders: r.orders || []
    })));

  } catch (err) {
    console.error("Table History Error:", err);
    res.status(500).json({ error: "Failed to fetch table history" });
  }
});

// ======================================================
// ---------------- CLAIM ORDER (Staff) ----------------
// ======================================================
router.patch("/orders/:id/claim", auth, async (req, res) => {
  try {
    // Only staff should be claiming orders
    if (!req.admin || !req.admin.isStaff) {
      return res.status(403).json({ error: "Only staff members can claim orders." });
    }

    const orderId = req.params.id;
    const waiterId = req.admin.id;

    const result = await pool.query(
      "UPDATE orders SET waiter_id = $1 WHERE id = $2 AND business_id = $3 AND waiter_id IS NULL RETURNING id",
      [waiterId, orderId, req.business_id]
    );

    if (result.rows.length === 0) {
      return res.status(400).json({ error: "Order not found or already claimed." });
    }

    const io = req.app.get("io");
    if (io) io.emit("orders-updated");
    await invalidateDashboardCache();

    res.json({ message: "Order claimed successfully", orderId });
  } catch (err) {
    console.error("Claim Order Error:", err);
    res.status(500).json({ error: "Failed to claim order" });
  }
});

// ======================================================
// ---------------- STAFF PERFORMANCE ----------------
// ======================================================
router.get("/staff/performance", auth, async (req, res) => {
  try {
    // Determine current month range
    const startOfMonth = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Kolkata",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date(new Date().getFullYear(), new Date().getMonth(), 1));

    const endOfMonth = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Kolkata",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0));

    const query = `
      SELECT 
        s.id,
        s.name,
        COALESCE(SUM(o.total), 0) as total_sales,
        COUNT(o.id) as total_orders
      FROM staff s
      LEFT JOIN orders o ON o.waiter_id = s.id 
         AND o.business_id = s.business_id
         AND o.status = 'completed'
         AND (o.created_at AT TIME ZONE 'Asia/Kolkata') >= $2::timestamp 
         AND (o.created_at AT TIME ZONE 'Asia/Kolkata') <= $3::timestamp
      WHERE s.business_id = $1 AND s.role = 'waiter'
      GROUP BY s.id, s.name
      ORDER BY total_sales DESC;
    `;
    const { rows } = await pool.query(query, [req.business_id, `${startOfMonth} 00:00:00`, `${endOfMonth} 23:59:59`]);

    res.json(rows.map(r => ({
      id: r.id,
      name: r.name,
      totalSales: parseFloat(r.total_sales),
      totalOrders: parseInt(r.total_orders, 10)
    })));

  } catch (err) {
    console.error("Staff Performance Error:", err);
    res.status(500).json({ error: "Failed to fetch staff performance" });
  }
});

module.exports = router;
