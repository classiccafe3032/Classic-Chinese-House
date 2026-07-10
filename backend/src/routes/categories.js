const express = require("express");
const router = express.Router();
const pool = require("../db/pool");
const { adminAuth } = require("../middleware/adminAuth");
const redisClient = require("../../config/redis");
const { invalidateCategoryCache } = require("../helpers/cacheHelper");

// ─── Public: Get all categories ───
router.get("/", async (req, res) => {
  const cacheKey = `menu:categories:list:${req.business_id}`;
  try {
    const cachedData = await redisClient.get(cacheKey);
    if (cachedData) {
      return res.json(JSON.parse(cachedData));
    }
    const { rows } = await pool.query(
      "SELECT * FROM menu_categories WHERE business_id = $1 ORDER BY sort_order ASC, name ASC",
      [req.business_id]
    );
    await redisClient.set(cacheKey, JSON.stringify(rows));
    res.json(rows);
  } catch (err) {
    console.error("GET /categories error:", err);
    res.status(500).json({ error: "Failed to fetch categories" });
  }
});

// ─── Admin: Create category ───
router.post("/", adminAuth, async (req, res) => {
  try {
    const { name } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: "Category name is required" });
    }

    const maxOrder = await pool.query(
      "SELECT COALESCE(MAX(sort_order),0)+1 AS next FROM menu_categories WHERE business_id = $1",
      [req.business_id]
    );
    const nextOrder = maxOrder.rows[0].next;

    const { rows } = await pool.query(
      "INSERT INTO menu_categories (name, sort_order, business_id) VALUES ($1, $2, $3) RETURNING *",
      [name.trim(), nextOrder, req.business_id]
    );

    const io = req.app.get("io");
    if (io) io.emit("menu-updated");

    await invalidateCategoryCache(req.business_id);

    res.status(201).json(rows[0]);
  } catch (err) {
    console.error("POST /categories error:", err);
    if (err.code === "23505") {
      return res.status(409).json({ error: "Category already exists" });
    }
    res.status(500).json({ error: "Failed to create category" });
  }
});

// ─── Admin: Update category ───
router.put("/:id", adminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { name } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: "Category name is required" });
    }

    const { rows } = await pool.query(
      "UPDATE menu_categories SET name=$1 WHERE id=$2 AND business_id=$3 RETURNING *",
      [name.trim(), id, req.business_id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: "Category not found" });
    }

    // No need to update menu_items - they reference category_id (FK)

    const io = req.app.get("io");
    if (io) io.emit("menu-updated");

    await invalidateCategoryCache(req.business_id);

    res.json(rows[0]);
  } catch (err) {
    console.error("PUT /categories error:", err);
    if (err.code === "23505") {
      return res.status(409).json({ error: "Category already exists" });
    }
    res.status(500).json({ error: "Failed to update category" });
  }
});

// ─── Admin: Delete category ───
router.delete("/:id", adminAuth, async (req, res) => {
  try {
    const { id } = req.params;

    // Check if any menu items use this category (via FK)
    const itemCount = await pool.query(
      "SELECT COUNT(*) as count FROM menu_items WHERE category_id=$1 AND business_id=$2 AND is_deleted = FALSE",
      [id, req.business_id]
    );

    if (parseInt(itemCount.rows[0].count) > 0) {
      return res.status(400).json({
        error: `Cannot delete: ${itemCount.rows[0].count} menu items use this category. Reassign them first.`,
      });
    }

    // Attempt to physically delete any soft-deleted items in this category.
    // This allows the category to be deleted if the items were never ordered.
    try {
      await pool.query(
        "DELETE FROM menu_items WHERE category_id=$1 AND business_id=$2 AND is_deleted = TRUE",
        [id, req.business_id]
      );
    } catch (dbErr) {
      if (dbErr.code === '23503') { // Foreign key constraint violation
        return res.status(400).json({
          error: "Cannot delete category: some deleted items in this category are part of past orders and must be kept for historical receipts.",
        });
      }
      throw dbErr;
    }

    const result = await pool.query("DELETE FROM menu_categories WHERE id=$1 AND business_id=$2 RETURNING id", [id, req.business_id]);

    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Category not found" });
    }

    const io = req.app.get("io");
    if (io) io.emit("menu-updated");
    await invalidateCategoryCache(req.business_id);
    res.json({ message: "Category deleted" });
  } catch (err) {
    console.error("DELETE /categories error:", err);
    res.status(500).json({ error: "Failed to delete category" });
  }
});

module.exports = router;
