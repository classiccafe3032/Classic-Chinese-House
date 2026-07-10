const express = require("express");
const router = express.Router();
const pool = require("../db/pool");
const { adminAuth, authorizeRole } = require("../middleware/adminAuth");
const uploadMenuImage = require("../middleware/uploadMenuImage");
const deleteCloudinaryImage = require("../utils/cloudinaryDelete");
const redisClient = require("../../config/redis");

const { invalidateMenuItemsCache } = require("../helpers/cacheHelper");

// Helper: Generate SEO friendly slug
function generateSlug(text) {
  return text
    .trim()
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

// Helper: Resolve category name → id
async function resolveCategoryId(db, categoryName, businessId) {
  const { rows } = await db.query(
    "SELECT id FROM menu_categories WHERE name = $1 AND business_id = $2",
    [categoryName.trim(), businessId]
  );
  return rows.length ? rows[0].id : null;
}

router.put("/reorder", adminAuth, authorizeRole(['admin', 'manager']), async (req, res) => {
  try {
    const { orderedIds } = req.body;

    if (!Array.isArray(orderedIds) || orderedIds.length === 0) {
      return res.status(400).json({ error: "Invalid orderedIds array" });
    }

    if (!orderedIds.every(id => Number.isInteger(Number(id)))) {
      return res.status(400).json({ error: "Invalid menu item id" });
    }

    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      const values = orderedIds
        .map((id, index) => `(${Number(id)}, ${index})`)
        .join(",");

      // Safe because we filter where business_id matches
      await client.query(`
        UPDATE menu_items AS m
        SET sort_order = v.sort_order,
            updated_at = NOW()
        FROM (VALUES ${values}) AS v(id, sort_order)
        WHERE m.id = v.id AND m.business_id = $1
      `, [req.business_id]);

      await client.query("COMMIT");

    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }

    await invalidateMenuItemsCache(req.business_id);

    const io = req.app.get("io");
    if (io) io.emit("menu-updated");

    res.json({ message: "Menu reordered successfully" });

  } catch (err) {
    console.error("PUT /menu/reorder error:", err);
    res.status(500).json({ error: "Failed to reorder menu" });
  }
});

// Public: Get all menu items
router.get("/", async (req, res) => {

  const cacheKey = `menu:items:${req.business_id}`;

  try {
    const cachedData = await redisClient.get(cacheKey);

    res.set("Cache-Control", "no-cache, no-store, must-revalidate");
    res.set("Pragma", "no-cache");
    res.set("Expires", "0");

    if (cachedData) {
      return res.json(JSON.parse(cachedData));
    }

    const { rows } = await pool.query(`
      SELECT mi.*, mc.name AS category
      FROM menu_items mi
      JOIN menu_categories mc ON mc.id = mi.category_id
      WHERE mi.business_id = $1 AND mi.is_deleted = FALSE
      ORDER BY mi.sort_order ASC, mi.created_at ASC
    `, [req.business_id]);

    await redisClient.set(cacheKey, JSON.stringify(rows), {
      EX: 3600
    });

    res.json(rows);

  } catch (err) {
    console.error("GET /menu error:", err);
    res.status(500).json({ error: "Failed to fetch menu items" });
  }
});

 
// Create menu item
router.post("/", adminAuth, authorizeRole(['admin', 'manager']), uploadMenuImage.single("image"), async (req, res) => {

  try {

    const { name, description, price, price_label, category, available, variants, diet_type } = req.body;

    if (!name || !price || !price_label || !category) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const categoryId = await resolveCategoryId(pool, category, req.business_id);

    if (!categoryId) {
      return res.status(400).json({ error: `Category "${category}" not found` });
    }

    const image_url = req.file ? req.file.path : null;

    const slug = generateSlug(name);

    let variantsJson = '[]';
    if (variants) {
      try {
        variantsJson = typeof variants === 'string' ? variants : JSON.stringify(variants);
      } catch (e) {}
    }

    const { rows } = await pool.query(
      `INSERT INTO menu_items
      (name, slug, description, price, price_label, category_id, image_url, available, business_id, variants, diet_type)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
      RETURNING *,
      (SELECT name FROM menu_categories WHERE id=$6) AS category`,
      [
        name.trim(),
        slug,
        description ? description.trim() : "",
        parseFloat(price),
        price_label.trim(),
        categoryId,
        image_url,
        available !== false,
        req.business_id,
        variantsJson,
        diet_type || 'none'
      ]
    );

    await invalidateMenuItemsCache(req.business_id);

    const io = req.app.get("io");
    if (io) io.emit("menu-updated");

    res.status(201).json(rows[0]);

  } catch (err) {

    console.error("POST /menu error:", err);

    if (err.code === "23505") {
      return res.status(409).json({
        error: "A menu item with this name already exists"
      });
    }

    res.status(500).json({ error: "Failed to create menu item" });
  }
});

 
// Update menu item
router.put("/:id", adminAuth, authorizeRole(['admin', 'manager']), uploadMenuImage.single("image"), async (req, res) => {

  try {

    const { id } = req.params;
    const { name, description, price, price_label, category, available, variants, diet_type } = req.body;

    let categoryId = null;

    if (category) {
      categoryId = await resolveCategoryId(pool, category, req.business_id);

      if (!categoryId) {
        return res.status(400).json({ error: `Category "${category}" not found` });
      }
    }

    const newImage = req.file ? req.file.path : null;

    let oldImage = null;

    if (newImage) {
      const { rows } = await pool.query(
        "SELECT image_url FROM menu_items WHERE id=$1 AND business_id=$2",
        [id, req.business_id]
      );

      oldImage = rows[0]?.image_url;
    }

    let variantsJson = undefined;
    if (variants !== undefined) {
      try {
        variantsJson = typeof variants === 'string' ? variants : JSON.stringify(variants);
      } catch (e) {}
    }

    const { rows } = await pool.query(
      `UPDATE menu_items
       SET name = COALESCE($1,name),
           slug = COALESCE($2,slug),
           description = COALESCE($3,description),
           price = COALESCE($4,price),
           price_label = COALESCE($5,price_label),
           category_id = COALESCE($6,category_id),
           image_url = COALESCE($7,image_url),
           available = COALESCE($8,available),
           variants = COALESCE($9,variants),
           updated_at = NOW(),
           diet_type = COALESCE($12,diet_type)
       WHERE id = $10 AND business_id = $11 AND is_deleted = FALSE
       RETURNING *,
       (SELECT name FROM menu_categories WHERE id = menu_items.category_id) AS category`,
      [
        name?.trim() || null,
        name ? generateSlug(name) : null,
        description !== undefined ? description.trim() : null,
        price ? parseFloat(price) : null,
        price_label?.trim() || null,
        categoryId,
        newImage,
        available !== undefined ? available : null,
        variantsJson,
        id,
        req.business_id,
        diet_type || null
      ]
    );

    if (newImage && oldImage) {
      await deleteCloudinaryImage(oldImage);
    }

    await invalidateMenuItemsCache(req.business_id);

    const io = req.app.get("io");
    if (io) io.emit("menu-updated");

    res.json(rows[0]);

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to update menu item" });
  }
});

 
// Delete menu item
router.delete("/:id", adminAuth, authorizeRole(['admin', 'manager']), async (req, res) => {

  try {

    const { id } = req.params;

    const { rows } = await pool.query(
      "SELECT image_url FROM menu_items WHERE id=$1 AND business_id=$2",
      [id, req.business_id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: "Menu item not found" });
    }

    const imageUrl = rows[0].image_url;

    await pool.query(
      "UPDATE menu_items SET is_deleted = TRUE, updated_at = NOW() WHERE id=$1 AND business_id=$2",
      [id, req.business_id]
    );

    if (imageUrl) {
      await deleteCloudinaryImage(imageUrl);
    }

    await invalidateMenuItemsCache(req.business_id);

    const io = req.app.get("io");
    if (io) io.emit("menu-updated");

    res.json({ message: "Menu item deleted" });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to delete menu item" });
  }
});

 
// Bulk delete menu items
router.post("/bulk-delete-menu-items", adminAuth, authorizeRole(['admin', 'manager']), async (req, res) => {

  try {

    const { ids } = req.body;

    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: "Invalid IDs array" });
    }

    const { rows } = await pool.query(
      `SELECT id, image_url FROM menu_items WHERE id = ANY($1) AND business_id = $2`,
      [ids, req.business_id]
    );

    // Filter valid IDs that actually belog to the business
    const validIds = rows.map(r => r.id);
    if (validIds.length === 0) return res.json({ message: "No valid menu items to delete" });

    await pool.query(
      `UPDATE menu_items SET is_deleted = TRUE, updated_at = NOW() WHERE id = ANY($1) AND business_id = $2`,
      [validIds, req.business_id]
    );

    for (const row of rows) {
      if (row.image_url) {
        await deleteCloudinaryImage(row.image_url);
      }
    }

    await invalidateMenuItemsCache(req.business_id);

    const io = req.app.get("io");
    if (io) io.emit("menu-updated");

    res.json({ message: "Menu items deleted" });

  } catch (err) {
    console.error("POST /menu/bulk-delete error:", err);
    res.status(500).json({ error: "Failed to bulk delete menu items" });
  }
});

 
// Toggle availability
router.patch("/:id/toggle", adminAuth, authorizeRole(['admin', 'manager']), async (req, res) => {

  try {

    const { id } = req.params;

    const { rows } = await pool.query(
      `UPDATE menu_items
       SET available = NOT available,
           updated_at = NOW()
       WHERE id=$1 AND business_id=$2 AND is_deleted = FALSE
       RETURNING *,
       (SELECT name FROM menu_categories WHERE id = menu_items.category_id) AS category`,
      [parseInt(id), req.business_id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: "Menu item not found" });
    }

    await invalidateMenuItemsCache(req.business_id);

    const io = req.app.get("io");
    if (io) io.emit("menu-updated");

    res.json(rows[0]);

  } catch (err) {
    console.error("PATCH /menu/toggle error:", err);
    res.status(500).json({ error: "Failed to toggle availability" });
  }
});

module.exports = router;