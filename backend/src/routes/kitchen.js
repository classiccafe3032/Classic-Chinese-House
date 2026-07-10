const express = require("express");
const router = express.Router();
const pool = require("../db/pool");
const { invalidateDashboardCache } = require("../helpers/cacheHelper");

// Helper: format order rows with items
function formatOrderRows(rows) {
  const ordersMap = new Map();
  for (const row of rows) {
    if (!ordersMap.has(row.id)) {
      ordersMap.set(row.id, {
        id: row.id,
        token: row.token,
        customerName: row.customer_name,
        items: [],
        status: row.status,
        createdAt: row.created_at,
        orderType: row.order_type || "dine-in",
        specialInstructions: row.special_instructions || "",
        paymentStatus: row.payment_status || "pending",
        paymentMethod: row.payment_method || "counter",
      });
    }
    if (row.item_name) {
      ordersMap.get(row.id).items.push({
        id: row.item_id,
        name: row.item_name,
        quantity: row.item_quantity,
        status: row.item_status || 'pending',
        note: row.item_note || '',
      });
    }
  }
  return Array.from(ordersMap.values());
}

// POST /api/kitchen/verify-pin
router.post("/verify-pin", async (req, res) => {
  const { pin } = req.body;
  if (!pin) return res.status(400).json({ error: "PIN is required" });

  try {
    const { rows } = await pool.query(
      `SELECT kitchen_pin FROM business_settings WHERE business_id = $1`,
      [req.business_id]
    );
    const storedPin = rows[0]?.kitchen_pin;

    if (pin !== storedPin) {
      return res.status(401).json({ error: "Invalid PIN" });
    }

    res.json({ success: true });
  } catch (err) {
    console.error("Kitchen PIN verify error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// GET /api/kitchen/orders — preparing orders only
router.get("/orders", async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT o.id, o.token, o.customer_name, o.status, o.created_at,
             o.order_type, o.special_instructions, o.payment_status, o.payment_method,
             oi.id AS item_id, oi.name AS item_name, oi.quantity AS item_quantity, 
             oi.status AS item_status, oi.note AS item_note
      FROM orders o
      LEFT JOIN order_items oi ON oi.order_id = o.id
      WHERE o.status = 'preparing'
        AND o.created_at::date = CURRENT_DATE
        AND o.business_id = $1
      ORDER BY o.created_at ASC
    `, [req.business_id]);
    console.log("Details of menu item in kitchen orders:", rows);
    res.set("Cache-Control", "no-store, no-cache, must-revalidate");
    res.json(formatOrderRows(rows));
  } catch (err) {
    console.error("Kitchen orders fetch error:", err);
    res.status(500).json({ error: "Failed to fetch orders" });
  }
});

// PATCH /api/kitchen/orders/:id/ready — mark order as ready
router.patch("/orders/:id/ready", async (req, res) => {
  const { id } = req.params;
  try {
    const { rows } = await pool.query(
      `UPDATE orders SET status = 'ready' WHERE id = $1 AND status = 'preparing' AND business_id = $2 RETURNING id, token, status`,
      [id, req.business_id]
    );
    if (rows.length === 0) {
      return res.status(404).json({ error: "Order not found or not in preparing status" });
    }

    // Also mark all associated items as ready
    await pool.query(
      `UPDATE order_items SET status = 'ready' WHERE order_id = $1 AND business_id = $2`,
      [id, req.business_id]
    );

    const io = req.app.get("io");
    if (io) io.emit("order-updated", { orderId: id, status: "ready" });

    await invalidateDashboardCache(req.business_id);

    res.json({ message: "Order marked as ready", order: rows[0] });
  } catch (err) {
    console.error("Kitchen mark ready error:", err);
    res.status(500).json({ error: "Failed to update order" });
  }
});

// PATCH /api/kitchen/order-items/:id/ready — mark an individual item as ready
router.patch("/order-items/:id/ready", async (req, res) => {
  const { id } = req.params;
  try {
    const { rows } = await pool.query(
      `UPDATE order_items SET status = 'ready' WHERE id = $1 AND business_id = $2 RETURNING id, order_id, status`,
      [id, req.business_id]
    );
    if (rows.length === 0) {
      return res.status(404).json({ error: "Order item not found" });
    }

    const io = req.app.get("io");
    if (io) io.emit("order-updated", { orderId: rows[0].order_id, itemId: id, status: "ready" });

    res.json({ message: "Order item marked as ready", item: rows[0] });
  } catch (err) {
    console.error("Kitchen mark item ready error:", err);
    res.status(500).json({ error: "Failed to update item" });
  }
});

module.exports = router;
