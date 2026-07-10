const express = require("express");
const router = express.Router();
const pool = require("../db/pool");
const { invalidateDashboardCache } = require("../helpers/cacheHelper");
const { adminAuth } = require("../middleware/adminAuth");
const { roundCurrency, calculateOrderTotals } = require("../utils/gst");
const { ensureBusinessSettings } = require("../utils/businessSettings");



// GET /api/tables (Admin)
// List all tables and their active sessions
router.get("/", adminAuth, async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT t.id, t.table_number, t.qr_code, t.status as table_status,
             s.id as session_id, s.customer_name, s.customer_phone, 
             s.otp, s.is_verified, s.status as session_status, s.start_time
      FROM tables t
      LEFT JOIN table_sessions s ON t.id = s.table_id AND s.status != 'completed' AND s.business_id = $1
      WHERE t.business_id = $1
      ORDER BY t.table_number ASC
    `, [req.business_id]);
    
    // Group sessions by table (since we used left join on non-completed)
    const tables = [];
    const map = new Map();
    for (const r of rows) {
      if (!map.has(r.id)) {
        map.set(r.id, {
          id: r.id,
          tableNumber: r.table_number,
          qrCode: r.qr_code,
          status: r.table_status,
          activeSession: null
        });
        tables.push(map.get(r.id));
      }
      if (r.session_id) {
        map.get(r.id).activeSession = {
          id: r.session_id,
          customerName: r.customer_name,
          customerPhone: r.customer_phone,
          otp: r.otp,
          isVerified: r.is_verified,
          status: r.session_status,
          startTime: r.start_time
        };
      }
    }

    res.json(tables);
  } catch (err) {
    console.error("Fetch tables error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// POST /api/tables/:tableId/admin-open (Admin/Staff)
// Admin opens a table instantly (no OTP required)
router.post("/:tableId/admin-open", adminAuth, async (req, res) => {
  const { tableId } = req.params;
  const { customerName = "Guest", customerPhone = "0000000000" } = req.body;
  const finalName = customerName?.trim() || "Guest";
  const finalPhone = customerPhone?.trim() || "0000000000";

  if (finalName !== "Guest") {
    if (finalName.length < 2 || finalName.length > 20 || !/^[A-Za-z\s]+$/.test(finalName)) {
      return res.status(400).json({ error: "Name must be 2-20 characters long and contain only alphabets." });
    }
  }

  if (finalPhone !== "0000000000") {
    if (!/^[0-9]{10}$/.test(finalPhone)) {
      return res.status(400).json({ error: "Phone number must be exactly 10 digits." });
    }
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Check if table exists
    const tableRes = await client.query("SELECT status FROM tables WHERE id = $1 AND business_id = $2 FOR UPDATE", [tableId, req.business_id]);
    if (!tableRes.rows.length) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Table not found" });
    }

    if (tableRes.rows[0].status === "occupied") {
      // If already occupied, return the existing active session
      const existingSession = await client.query(
        "SELECT id FROM table_sessions WHERE table_id = $1 AND status != 'completed' AND business_id = $2 ORDER BY start_time DESC LIMIT 1",
        [tableId, req.business_id]
      );
      await client.query("ROLLBACK");
      if (existingSession.rows.length) {
        return res.json({ id: existingSession.rows[0].id, existing: true });
      }
      return res.status(400).json({ error: "Table is occupied but no session found." });
    }

    // Cancel any unverified active sessions (orphans)
    await client.query(
      "UPDATE table_sessions SET status = 'completed' WHERE table_id = $1 AND is_verified = false AND business_id = $2",
      [tableId, req.business_id]
    );

    // Create a VERIFIED session
    const waiterId = req.admin && req.admin.isStaff ? req.admin.id : null;
    const sessionRes = await client.query(
      `INSERT INTO table_sessions (table_id, customer_name, customer_phone, otp, status, is_verified, business_id, waiter_id)
       VALUES ($1, $2, $3, $4, 'active', true, $5, $6)
       RETURNING id`,
      [tableId, finalName, finalPhone, "123456", req.business_id, waiterId] // Placeholder OTP
    );

    await client.query("UPDATE tables SET status = 'occupied' WHERE id = $1 AND business_id = $2", [tableId, req.business_id]);
    await client.query("COMMIT");

    const io = req.app.get("io");
    if (io) io.emit("tables-updated");
    await invalidateDashboardCache();

    res.status(201).json({ id: sessionRes.rows[0].id, new: true });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Admin open table error:", err);
    res.status(500).json({ error: "Server error" });
  } finally {
    client.release();
  }
});

// POST /api/tables (Admin)
// Create a new table
router.post("/", adminAuth, async (req, res) => {
  const { tableNumber, qrCode } = req.body;
  
  if (!tableNumber) {
    return res.status(400).json({ error: "Table number is required" });
  }

  const generatedQrCode = qrCode || `table-${tableNumber.toLowerCase().replace(/\s+/g, '-')}-${Math.random().toString(36).substr(2, 5)}`;

  try {
    const { rows } = await pool.query(
      "INSERT INTO tables (table_number, qr_code, business_id) VALUES ($1, $2, $3) RETURNING *",
      [String(tableNumber), generatedQrCode, req.business_id]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error("Create table error:", err);
    res.status(500).json({ error: "Failed to create table. It may already exist." });
  }
});

// GET /api/tables/qr/:qrCode (Customer)
// Fetch table details via QR Code
router.get("/qr/:qrCode", async (req, res) => {
  const { qrCode } = req.params;
  try {
    const { rows } = await pool.query(
      `SELECT t.id, t.table_number, t.status, bs.qr_routing_mode 
       FROM tables t
       JOIN business_settings bs ON bs.business_id = t.business_id
       WHERE t.qr_code = $1 AND t.business_id = $2`,
      [qrCode, req.business_id]
    );

    if (!rows.length) return res.status(404).json({ error: "Table not found" });

    // Also fetch the current active/billing session if any
    const tableId = rows[0].id;
    const sessionRes = await pool.query(
      `SELECT id, customer_name, customer_phone, otp, is_verified, status, start_time 
       FROM table_sessions 
       WHERE table_id = $1 AND status != 'completed' AND business_id = $2
       ORDER BY start_time DESC LIMIT 1`,
      [tableId, req.business_id]
    );

    const tableData = rows[0];
    const sessionData = sessionRes.rows.length ? sessionRes.rows[0] : null;

    res.json({
      id: tableData.id,
      tableNumber: tableData.table_number,
      qrCode,
      qrRoutingMode: tableData.qr_routing_mode || 'claim',
      status: tableData.status,
      activeSession: sessionData ? {
        id: sessionData.id,
        customerName: sessionData.customer_name,
        customerPhone: sessionData.customer_phone,
        otp: sessionData.otp,
        isVerified: sessionData.is_verified,
        status: sessionData.status,
        startTime: sessionData.start_time
      } : null
    });
  } catch (err) {
    console.error("Fetch table error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// POST /api/tables/:tableId/reserve (Customer)
// Customer submits name and phone — session is auto-verified (no OTP needed)
router.post("/:tableId/reserve", async (req, res) => {
  const { tableId } = req.params;
  const { customerName, customerPhone } = req.body;

  const finalPhone = customerPhone?.trim() || "0000000000";
  const finalName = customerName?.trim() || "Guest";

  if (finalName !== "Guest") {
    if (finalName.length < 2 || finalName.length > 20 || !/^[A-Za-z\s]+$/.test(finalName)) {
      return res.status(400).json({ error: "Name must be 2-20 characters long and contain only alphabets." });
    }
  }

  if (finalPhone !== "0000000000") {
    if (!/^[0-9]{10}$/.test(finalPhone)) {
      return res.status(400).json({ error: "Phone number must be exactly 10 digits." });
    }
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Check if table exists and is available
    const tableRes = await client.query("SELECT status FROM tables WHERE id = $1 AND business_id = $2 FOR UPDATE", [tableId, req.business_id]);
    if (!tableRes.rows.length) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Table not found" });
    }

    if (tableRes.rows[0].status === "occupied") {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "Table is already occupied" });
    }

    // Cancel any stale sessions for this table
    await client.query(
      "UPDATE table_sessions SET status = 'completed' WHERE table_id = $1 AND status != 'completed' AND business_id = $2",
      [tableId, req.business_id]
    );

    // Create an auto-verified session (no OTP required)
    const sessionRes = await client.query(
      `INSERT INTO table_sessions (table_id, customer_name, customer_phone, otp, status, is_verified, business_id)
       VALUES ($1, $2, $3, '000000', 'active', true, $4)
       RETURNING *`,
      [tableId, finalName, finalPhone, req.business_id]
    );

    // Mark table as occupied immediately
    await client.query("UPDATE tables SET status = 'occupied' WHERE id = $1 AND business_id = $2", [tableId, req.business_id]);

    await client.query("COMMIT");

    const io = req.app.get("io");
    if (io) io.emit("tables-updated");
    await invalidateDashboardCache();

    const sr = sessionRes.rows[0];
    res.status(201).json({
      id: sr.id,
      tableId: sr.table_id,
      customerName: sr.customer_name,
      customerPhone: sr.customer_phone,
      isVerified: true,
      status: sr.status,
      startTime: sr.start_time
    });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Reserve table error:", err);
    res.status(500).json({ error: "Server error" });
  } finally {
    client.release();
  }
});

// POST /api/tables/sessions/:sessionId/transfer (Admin)
// Transfers a session from its current table to a new available table
router.post("/sessions/:sessionId/transfer", adminAuth, async (req, res) => {
  const { sessionId } = req.params;
  const { newTableId } = req.body;

  if (!newTableId) {
    return res.status(400).json({ error: "newTableId is required" });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Check if session exists and get old table
    const sessionRes = await client.query(
      "SELECT table_id FROM table_sessions WHERE id = $1 AND status != 'completed' AND business_id = $2 FOR UPDATE",
      [sessionId, req.business_id]
    );

    if (!sessionRes.rows.length) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Active session not found" });
    }

    const oldTableId = sessionRes.rows[0].table_id;

    if (oldTableId === newTableId) {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "Cannot transfer to the same table" });
    }

    // Check if new table exists and is available
    const newTableRes = await client.query(
      "SELECT status FROM tables WHERE id = $1 AND business_id = $2 FOR UPDATE",
      [newTableId, req.business_id]
    );

    if (!newTableRes.rows.length) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "New table not found" });
    }

    if (newTableRes.rows[0].status === "occupied") {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "New table is already occupied" });
    }

    // Move session to new table
    await client.query(
      "UPDATE table_sessions SET table_id = $1 WHERE id = $2 AND business_id = $3",
      [newTableId, sessionId, req.business_id]
    );

    // Swap table statuses
    await client.query(
      "UPDATE tables SET status = 'available' WHERE id = $1 AND business_id = $2",
      [oldTableId, req.business_id]
    );
    await client.query(
      "UPDATE tables SET status = 'occupied' WHERE id = $1 AND business_id = $2",
      [newTableId, req.business_id]
    );

    await client.query("COMMIT");

    const io = req.app.get("io");
    if (io) io.emit("tables-updated");
    await invalidateDashboardCache();

    res.json({ message: "Table transferred successfully" });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Transfer table error:", err);
    res.status(500).json({ error: "Server error" });
  } finally {
    client.release();
  }
});

// POST /api/tables/sessions/:sessionId/cancel (Customer)
// Customer cancels session (only if no orders placed)
router.post("/sessions/:sessionId/cancel", async (req, res) => {
  const { sessionId } = req.params;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const sessionRes = await client.query("SELECT * FROM table_sessions WHERE id = $1 AND business_id = $2 FOR UPDATE", [sessionId, req.business_id]);
    if (!sessionRes.rows.length) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Session not found" });
    }

    const session = sessionRes.rows[0];

    const ordersRes = await client.query("SELECT COUNT(*) FROM orders WHERE table_session_id = $1 AND business_id = $2", [sessionId, req.business_id]);
    const orderCount = parseInt(ordersRes.rows[0].count);

    if (orderCount > 0) {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "Orders have been placed. Please clear your payment or contact staff." });
    }

    await client.query("UPDATE table_sessions SET status = 'completed' WHERE id = $1 AND business_id = $2", [sessionId, req.business_id]);
    await client.query("UPDATE tables SET status = 'available' WHERE id = $1 AND business_id = $2", [session.table_id, req.business_id]);

    await client.query("COMMIT");

    const io = req.app.get("io");
    if (io) io.emit("tables-updated");
    await invalidateDashboardCache();

    res.json({ success: true, message: "Session cancelled successfully" });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Session cancel error:", err);
    res.status(500).json({ error: "Server error" });
  } finally {
    client.release();
  }
});

// POST /api/tables/sessions/:sessionId/done (Customer)
// Customer clicks "Done Eating"
router.post("/sessions/:sessionId/done", async (req, res) => {
  const { sessionId } = req.params;
  try {
    const { rows } = await pool.query(
      "UPDATE table_sessions SET status = 'billing' WHERE id = $1 AND status = 'active' AND business_id = $2 RETURNING *",
      [sessionId, req.business_id]
    );

    if (!rows.length) return res.status(404).json({ error: "Active session not found" });

    const io = req.app.get("io");
    if (io) io.emit("tables-updated");
    await invalidateDashboardCache();

    res.json(rows[0]);
  } catch (err) {
    console.error("Session done error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// GET /api/tables/sessions/:sessionId/bill (Customer/Admin)
// Aggregates all orders for a session to return the final bill
router.get("/sessions/:sessionId/bill", async (req, res) => {
  const { sessionId } = req.params;
  try {
    // Get session first to get table_id
    const sessionRes = await pool.query(
      "SELECT table_id, coupon_code, discount_amount FROM table_sessions WHERE id = $1 AND business_id = $2",
      [sessionId, req.business_id]
    );
    if (!sessionRes.rows.length) return res.status(404).json({ error: "Session not found" });
    const tableId = sessionRes.rows[0].table_id;

    // Get table number
    const tableRes = await pool.query("SELECT table_number FROM tables WHERE id = $1 AND business_id = $2", [tableId, req.business_id]);
    const tableNumber = tableRes.rows.length ? tableRes.rows[0].table_number : null;

    // Get all non-cancelled orders for this session with their items via JOIN
    const { rows } = await pool.query(
      `SELECT o.id, o.token, o.total, o.paid_amount, o.payment_status, o.status, o.created_at,
              oi.id as item_id, oi.name as item_name, oi.price as item_price, oi.quantity as item_quantity, oi.menu_item_id as item_menu_item_id, oi.status as item_status, oi.note as item_note
       FROM orders o
       LEFT JOIN order_items oi ON oi.order_id = o.id
       WHERE o.table_session_id = $1 AND o.status != 'cancelled' AND o.business_id = $2
       ORDER BY o.created_at ASC, oi.name`,
      [sessionId, req.business_id]
    );

    // Group rows by order id
    const ordersMap = new Map();
    const aggregatedItems = new Map();

    let subtotal = 0;
    let totalPaid = 0;
    let totalDue = 0;

    for (const row of rows) {
      if (!ordersMap.has(row.id)) {
        const orderTotal = parseFloat(row.total) || 0;
        const paid = parseFloat(row.paid_amount) || 0;
        subtotal += orderTotal;
        totalPaid += paid;
        totalDue += (orderTotal - paid);
        ordersMap.set(row.id, {
          id: row.id,
          token: row.token,
          total: row.total,
          paid_amount: row.paid_amount,
          payment_status: row.payment_status,
          status: row.status,
          created_at: row.created_at,
          items: []
        });
      }

      if (row.item_name) {
        const itemPrice = parseFloat(row.item_price);
        const itemQty = parseInt(row.item_quantity);

        ordersMap.get(row.id).items.push({
          id: row.item_id,
          name: row.item_name,
          price: itemPrice,
          quantity: itemQty,
          status: row.item_status || 'pending',
          note: row.item_note || ''
        });

        const key = row.item_name;
        if (aggregatedItems.has(key)) {
          const existing = aggregatedItems.get(key);
          existing.quantity += itemQty;
          existing.totalPrice += (itemPrice * itemQty);
        } else {
          aggregatedItems.set(key, {
            menuItemId: row.item_menu_item_id,
            name: row.item_name,
            price: itemPrice,
            quantity: itemQty,
            totalPrice: (itemPrice * itemQty)
          });
        }
      }
    }

    const itemized = Array.from(aggregatedItems.values());
    const ordersList = Array.from(ordersMap.values());

    let finalTotalAmount = roundCurrency(subtotal);
    let sessionDetails = null;

    const couponCode = sessionRes.rows[0].coupon_code;
    const discountAmount = parseFloat(sessionRes.rows[0].discount_amount || 0);

    // Calculate total from raw items
    let rawSubtotal = 0;
    for (const item of itemized) {
      rawSubtotal += item.totalPrice;
    }
    
    const businessSettings = await ensureBusinessSettings(pool, req.business_id);
    const totals = calculateOrderTotals({
      subtotal: rawSubtotal,
      discount: discountAmount,
      gstEnabled: businessSettings.isGstEnabled,
      cgstRate: businessSettings.cgstRate,
      sgstRate: businessSettings.sgstRate,
    });

    finalTotalAmount = totals.total;
    sessionDetails = {
      subtotal: totals.subtotal,
      discount: totals.discount,
      couponCode: couponCode || undefined,
      cgst: totals.cgst,
      sgst: totals.sgst,
      gstTotal: totals.gstTotal,
    };

    const finalTotalPaid = roundCurrency(totalPaid);
    const finalTotalDue = roundCurrency(Math.max(0, finalTotalAmount - finalTotalPaid));

    res.json({
      sessionId,
      tableNumber,
      orders: ordersList,
      itemized,
      totalAmount: finalTotalAmount,
      totalPaid: finalTotalPaid,
      totalDue: finalTotalDue,
      isFullyPaid: finalTotalDue < 0.01 && ordersList.length > 0,
      sessionDetails
    });
  } catch (err) {
    console.error("Fetch session bill error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// Helper: close a session and free the table (shared between pay and close routes)
async function closeSession(client, sessionId, business_id) {
  const sessionRes = await client.query(
    `UPDATE table_sessions SET status = 'completed', end_time = NOW()
     WHERE id = $1 AND status != 'completed' AND business_id = $2
     RETURNING table_id, customer_phone`,
    [sessionId, business_id]
  );
  if (sessionRes.rows.length) {
    const { table_id } = sessionRes.rows[0];
    await client.query("UPDATE tables SET status = 'available' WHERE id = $1 AND business_id = $2", [table_id, business_id]);
  }
  return sessionRes.rows.length > 0;
}

// POST /api/tables/sessions/:sessionId/pay (Customer)
// Marks all orders as paid and auto closes the session
router.post("/sessions/:sessionId/pay", async (req, res) => {
  const { sessionId } = req.params;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Mark all unpaid orders for this session as paid
    await client.query(
      `UPDATE orders
       SET payment_status = 'paid', paid_amount = total, payment_method = 'online'
       WHERE table_session_id = $1 AND status != 'cancelled' AND payment_status != 'paid'`,
      [sessionId]
    );

    // Auto-close the session after online payment
    await closeSession(client, sessionId, req.business_id);

    await client.query("COMMIT");

    const io = req.app.get("io");
    if (io) { io.emit("orders-updated"); io.emit("tables-updated"); }

    await invalidateDashboardCache();

    res.json({ message: "Payment successful", sessionClosed: true });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Session pay error:", err);
    res.status(500).json({ error: err.message || "Payment failed" });
  } finally {
    client.release();
  }
});

// POST /api/tables/sessions/:sessionId/close (Admin)
// Closes the session, marks outstanding orders as paid, frees the table
router.post("/sessions/:sessionId/close", adminAuth, async (req, res) => {
  const { sessionId } = req.params;
  const { paymentMethod = "counter", splitCash = 0, splitUpi = 0, customerPhone, pointsRedeemed } = req.body;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const sessionRes = await client.query(
      "SELECT sum(total) as session_total FROM orders WHERE table_session_id = $1 AND status != 'cancelled'",
      [sessionId]
    );
    const sessionTotal = parseFloat(sessionRes.rows[0]?.session_total || 0);

    let loyaltyDiscount = 0;
    const requestedPoints = parseFloat(pointsRedeemed) || 0;
    const finalPhone = customerPhone && customerPhone.length === 10 ? customerPhone : null;
    let actualPointsRedeemed = 0;

    if (finalPhone) {
      await client.query("UPDATE table_sessions SET customer_phone = $1 WHERE id = $2", [finalPhone, sessionId]);
      await client.query("UPDATE orders SET customer_phone = $1 WHERE table_session_id = $2", [finalPhone, sessionId]);

      const settingsRes = await client.query(
        "SELECT loyalty_enabled, loyalty_discount_per_point, loyalty_points_per_100 FROM business_settings WHERE business_id = $1",
        [req.business_id]
      );
      const settings = settingsRes.rows[0];

      if (settings && settings.loyalty_enabled) {
        // Redemptions
        if (requestedPoints > 0) {
          const customerRes = await client.query(
            "SELECT points_balance FROM customers WHERE business_id = $1 AND phone = $2 FOR UPDATE",
            [req.business_id, finalPhone]
          );
          if (customerRes.rows.length > 0) {
            actualPointsRedeemed = Math.min(requestedPoints, customerRes.rows[0].points_balance);
            loyaltyDiscount = actualPointsRedeemed * parseFloat(settings.loyalty_discount_per_point);
            if (loyaltyDiscount > sessionTotal) loyaltyDiscount = sessionTotal;

            // Deduct points
            await client.query(
              "UPDATE customers SET points_balance = points_balance - $1 WHERE business_id = $2 AND phone = $3",
              [actualPointsRedeemed, req.business_id, finalPhone]
            );

            // Add discount to session and absorb into the most recent order
            await client.query(
              "UPDATE table_sessions SET discount_amount = COALESCE(discount_amount, 0) + $1 WHERE id = $2",
              [loyaltyDiscount, sessionId]
            );
            
            await client.query(`
              UPDATE orders 
              SET total = GREATEST(0, total - $1),
                  discount = COALESCE(discount, 0) + $1,
                  points_redeemed = $2
              WHERE id = (
                SELECT id FROM orders 
                WHERE table_session_id = $3 AND status != 'cancelled' 
                ORDER BY created_at DESC LIMIT 1
              )
            `, [loyaltyDiscount, actualPointsRedeemed, sessionId]);
          }
        }

        // Earnings
        const totalAfterDiscount = Math.max(0, sessionTotal - loyaltyDiscount);
        const pointsEarned = parseFloat(((totalAfterDiscount / 100) * settings.loyalty_points_per_100).toFixed(2));

        if (pointsEarned > 0) {
          await client.query(`
            UPDATE orders SET points_earned = $1 
            WHERE id = (
              SELECT id FROM orders 
              WHERE table_session_id = $2 AND status != 'cancelled' 
              ORDER BY created_at DESC LIMIT 1
            )
          `, [pointsEarned, sessionId]);

          await client.query(`
            INSERT INTO customers (business_id, phone, name, points_balance, total_spent, last_visit)
            VALUES ($1, $2, 'Guest', $3, $4, CURRENT_TIMESTAMP)
            ON CONFLICT (business_id, phone)
            DO UPDATE SET 
              points_balance = customers.points_balance + $3,
              total_spent = customers.total_spent + $4,
              last_visit = CURRENT_TIMESTAMP
          `, [req.business_id, finalPhone, pointsEarned, totalAfterDiscount]);
        }
      }
    }

    // Mark outstanding orders as settled by the provided payment method
    await client.query(
      `UPDATE orders
       SET payment_status = 'paid', paid_amount = total, payment_method = $2, split_cash = $3, split_upi = $4
       WHERE table_session_id = $1 AND payment_status != 'paid' AND status != 'cancelled'`,
      [sessionId, paymentMethod, splitCash || 0, splitUpi || 0]
    );

    // Close session and free table
    await closeSession(client, sessionId, req.business_id);

    await client.query("COMMIT");

    const io = req.app.get("io");
    if (io) { io.emit("tables-updated"); io.emit("orders-updated"); }

    await invalidateDashboardCache();

    res.json({ success: true });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Close session error:", err);
    res.status(500).json({ error: err.message || "Failed to close session" });
  } finally {
    client.release();
  }
});

// DELETE /api/tables/:id (Admin)
router.delete("/:id", adminAuth, async (req, res) => {
  const { id } = req.params;
  try {
    // Only allow deleting tables that are "available" (not reserved/occupied)
    const tableRes = await pool.query("SELECT * FROM tables WHERE id = $1 AND business_id = $2", [id, req.business_id]);
    if (!tableRes.rows.length) return res.status(404).json({ error: "Table not found" });
    
    if (tableRes.rows[0].status !== "available") {
      return res.status(400).json({ error: "Cannot delete a table that is currently occupied or reserved." });
    }

    await pool.query("DELETE FROM tables WHERE id = $1 AND business_id = $2", [id, req.business_id]);
    
    const io = req.app.get("io");
    if (io) io.emit("tables-updated");
    
    res.json({ success: true, message: "Table deleted successfully" });
  } catch (err) {
    console.error("Delete table error:", err);
    res.status(500).json({ error: "Server error" });
  }
});


// POST /api/tables/sessions/:sessionId/apply-coupon
router.post("/sessions/:sessionId/apply-coupon", async (req, res) => {
  const { sessionId } = req.params;
  const { code } = req.body;
  if (!code) return res.status(400).json({ error: "Coupon code is required" });

  try {
    // Validate session
    const sessionRes = await pool.query("SELECT * FROM table_sessions WHERE id = $1 AND business_id = $2 AND status != 'completed'", [sessionId, req.business_id]);
    if (!sessionRes.rows.length) return res.status(404).json({ error: "Active session not found" });

    // Validate coupon
    const normalizedCode = code.trim().toUpperCase();
    const couponRes = await pool.query("SELECT * FROM coupons WHERE code = $1 AND active = true AND business_id = $2", [normalizedCode, req.business_id]);
    if (!couponRes.rows.length) return res.status(400).json({ error: "Invalid or inactive coupon" });

    const coupon = couponRes.rows[0];

    // Check expiry
    if (coupon.valid_until && new Date(coupon.valid_until) < new Date()) {
      return res.status(400).json({ error: "Coupon has expired" });
    }

    // Calculate raw subtotal for the session to compute discount
    const itemsRes = await pool.query(`
      SELECT oi.price, oi.quantity FROM order_items oi
      JOIN orders o ON oi.order_id = o.id
      WHERE o.table_session_id = $1 AND o.status != 'cancelled' AND o.business_id = $2
    `, [sessionId, req.business_id]);

    let rawSubtotal = 0;
    for (const row of itemsRes.rows) {
      rawSubtotal += (parseFloat(row.price) * parseInt(row.quantity));
    }

    if (coupon.min_order_amount && rawSubtotal < parseFloat(coupon.min_order_amount)) {
      return res.status(400).json({ error: `Minimum order amount is ₹${coupon.min_order_amount}` });
    }

    let discountValue = 0;
    if (coupon.discount_type === "percent") {
      discountValue = rawSubtotal * (parseFloat(coupon.discount_value) / 100);
      if (coupon.max_discount_amount) {
        discountValue = Math.min(discountValue, parseFloat(coupon.max_discount_amount));
      }
    } else {
      discountValue = parseFloat(coupon.discount_value);
    }

    discountValue = Math.min(discountValue, rawSubtotal);

    await pool.query(
      "UPDATE table_sessions SET coupon_code = $1, discount_amount = $2 WHERE id = $3",
      [normalizedCode, discountValue, sessionId]
    );

    res.json({ success: true, message: "Coupon applied successfully" });
  } catch (err) {
    console.error("Apply coupon error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// POST /api/tables/sessions/:sessionId/remove-coupon
router.post("/sessions/:sessionId/remove-coupon", async (req, res) => {
  const { sessionId } = req.params;
  try {
    await pool.query(
      "UPDATE table_sessions SET coupon_code = NULL, discount_amount = 0 WHERE id = $1 AND business_id = $2",
      [sessionId, req.business_id]
    );
    res.json({ success: true, message: "Coupon removed" });
  } catch (err) {
    console.error("Remove coupon error:", err);
    res.status(500).json({ error: "Server error" });
  }
});
// GET /api/tables/sessions/history (Admin)
// Fetch past settled (completed) sessions with pagination
router.get("/sessions/history", adminAuth, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 25;
    const offset = (page - 1) * limit;

    // Get total count
    const countRes = await pool.query(
      `SELECT COUNT(*) FROM table_sessions ts
       WHERE ts.status = 'completed' AND ts.business_id = $1
       AND (
         SELECT COALESCE(SUM(o.total), 0) FROM orders o 
         WHERE o.table_session_id = ts.id AND o.status != 'cancelled'
       ) > 0`,
      [req.business_id]
    );
    const totalCount = parseInt(countRes.rows[0].count);
    const totalPages = Math.ceil(totalCount / limit);

    const { rows } = await pool.query(`
      SELECT ts.id as session_id, ts.customer_name, ts.customer_phone, ts.start_time, ts.end_time, ts.discount_amount,
             t.table_number,
             (SELECT SUM(o.total) FROM orders o WHERE o.table_session_id = ts.id AND o.status != 'cancelled') as raw_total
      FROM table_sessions ts
      LEFT JOIN tables t ON ts.table_id = t.id
      WHERE ts.status = 'completed' AND ts.business_id = $1
        AND (
          SELECT COALESCE(SUM(o.total), 0) FROM orders o 
          WHERE o.table_session_id = ts.id AND o.status != 'cancelled'
        ) > 0
      ORDER BY ts.end_time DESC
      LIMIT $2 OFFSET $3
    `, [req.business_id, limit, offset]);

    res.json({
      data: rows,
      total: totalCount,
      page,
      totalPages,
      limit
    });
  } catch (err) {
    console.error("Fetch history error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;

