const express = require("express");
const router = express.Router();
const pool = require("../db/pool");
const { adminAuth, authorizeRole } = require("../middleware/adminAuth");
const redisClient = require("../../config/redis");
const { invalidatePromotionsCache } = require("../helpers/cacheHelper");
// Public: Get active promotion 
router.get("/active", async (req, res) => {
  const cacheKey = `active_promotion:${req.business_id}`;
  try {
    const cached = await redisClient.get(cacheKey);
    if (cached) {
      return res.json(JSON.parse(cached));
    }

    const { rows } = await pool.query(
      `SELECT id, message, bg_color, text_color, starts_at, expires_at
       FROM promotions
       WHERE active = true AND business_id = $1
         AND starts_at <= NOW()
         AND expires_at > NOW()
       ORDER BY created_at DESC
       LIMIT 1`,
      [req.business_id]
    );
    await redisClient.set(cacheKey, JSON.stringify(rows[0] || null));
    res.json(rows[0] || null);
  } catch (err) {
    console.error("Get active promotion error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// Admin: List all promotions 
router.get("/", adminAuth, async (req, res) => {
  const cacheKey = `promotions_list:${req.business_id}`;
  try {
    const cached = await redisClient.get(cacheKey);
    if (cached) {
      return res.json(JSON.parse(cached));
    }

    const { rows } = await pool.query(
      `SELECT * FROM promotions WHERE business_id = $1 ORDER BY created_at DESC`,
      [req.business_id]
    );
    await redisClient.set(cacheKey, JSON.stringify(rows));

    res.json(rows);
  } catch (err) {
    console.error("List promotions error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

//Admin: Create promotion
router.post("/", adminAuth, authorizeRole(['admin', 'manager']), async (req, res) => {
  try {
    const { message, bg_color, text_color, starts_at, expires_at } = req.body;

    if (!message || !expires_at) {
      return res.status(400).json({
        error: "Message and expiry are required",
      });
    }

    const { rows } = await pool.query(
      `INSERT INTO promotions (message, bg_color, text_color, starts_at, expires_at, business_id)
       VALUES ($1,$2,$3,$4,$5,$6)
       RETURNING *`,
      [
        message,
        bg_color || "#f59e0b",
        text_color || "#ffffff",
        starts_at || new Date().toISOString(),
        expires_at,
        req.business_id
      ]
    );

    await invalidatePromotionsCache(req.business_id);
    const io = req.app.get("io");
    if (io) io.emit("promotion-updated");

    res.status(201).json(rows[0]);
  } catch (err) {
    console.error("Create promotion error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// Admin: Toggle active 
router.patch("/:id/toggle", adminAuth, authorizeRole(['admin', 'manager']), async (req, res) => {
  try {
    const { rows } = await pool.query(
      `UPDATE promotions
       SET active = NOT active
       WHERE id = $1 AND business_id = $2
       RETURNING *`,
      [req.params.id, req.business_id]
    );

    if (!rows.length) {
      return res.status(404).json({ error: "Promotion not found" });
    }

    await invalidatePromotionsCache(req.business_id);
    const io = req.app.get("io");
    if (io) io.emit("promotion-updated");
    res.json(rows[0]);
  } catch (err) {
    console.error("Toggle promotion error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// Admin: Delete promotion 
router.delete("/:id", adminAuth, authorizeRole(['admin', 'manager']), async (req, res) => {
  try {
    const { rowCount } = await pool.query(
      `DELETE FROM promotions WHERE id = $1 AND business_id = $2`,
      [req.params.id, req.business_id]
    );

    if (!rowCount) {
      return res.status(404).json({ error: "Promotion not found" });
    }
    await invalidatePromotionsCache(req.business_id);
    const io = req.app.get("io");
    if (io) io.emit("promotion-updated");

    res.json({ message: "Deleted" });
  } catch (err) {
    console.error("Delete promotion error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;