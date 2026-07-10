const express = require("express");
const pool = require("../db/pool");
const { adminAuth, authorizeRole } = require("../middleware/adminAuth");
const uploadMenuImage = require("../middleware/uploadMenuImage");
const deleteCloudinaryImage = require("../utils/cloudinaryDelete");
const redisClient = require("../../config/redis");
const { invalidateGalleryCache } = require("../helpers/cacheHelper");
const router = express.Router();

// Public: get all gallery images ordered by display_order
router.get("/", async (req, res) => {
  const cacheKey = `gallery:images:${req.business_id}`;

  try {
    // Try to get from Redis cache first
    const cachedData = await redisClient.get(cacheKey);
    if (cachedData) {
      return res.json(JSON.parse(cachedData));
    }

    // If not in cache, fetch from database
    const { rows } = await pool.query(
      "SELECT * FROM gallery_images WHERE business_id = $1 ORDER BY display_order ASC, id ASC",
      [req.business_id]
    );
    // Store in cache until next update (cache invalidated on any change)
    await redisClient.set(cacheKey, JSON.stringify(rows));
    res.json(rows);
  } catch (err) {
    console.error("Gallery fetch error:", err);
    res.status(500).json({ error: "Failed to fetch gallery" });
  }
});

// Admin: upload a new gallery image
router.post(
  "/",
  adminAuth,
  authorizeRole(['admin', 'manager']),
  uploadMenuImage.single("image"),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "Image is required" });
      }

      const imageUrl = req.file.path || req.file.secure_url || req.file.url;
      const altText = req.body.alt_text || "";

      const { rows: maxRows } = await pool.query(
        "SELECT COALESCE(MAX(display_order), 0) AS max_order FROM gallery_images WHERE business_id = $1",
        [req.business_id]
      );
      const nextOrder = maxRows[0].max_order + 1;

      const { rows } = await pool.query(
        `INSERT INTO gallery_images (image_url, alt_text, display_order, business_id)
       VALUES ($1, $2, $3, $4) RETURNING *`,
        [imageUrl, altText, nextOrder, req.business_id],
      );

      
      const io = req.app.get("io");
      if (io) io.emit("gallery-updated");

      await invalidateGalleryCache(req.business_id);

      res.status(201).json(rows[0]);
    } catch (err) {
      console.error("Gallery upload error:", err);
      res.status(500).json({ error: "Failed to upload image" });
    }
  },
);

// Admin: delete a gallery image
router.delete("/:id", adminAuth, authorizeRole(['admin', 'manager']), async (req, res) => {
  try {
    const { rows } = await pool.query(
      "DELETE FROM gallery_images WHERE id = $1 AND business_id = $2 RETURNING *",
      [req.params.id, req.business_id],
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: "Image not found" });
    }

    await deleteCloudinaryImage(rows[0].image_url);

    const io = req.app.get("io");
    if (io) io.emit("gallery-updated");

    await invalidateGalleryCache(req.business_id);

    res.json({ message: "Deleted" });
  } catch (err) {
    console.error("Gallery delete error:", err);
    res.status(500).json({ error: "Failed to delete image" });
  }
});

// Admin: reorder gallery images
router.put("/reorder", adminAuth, authorizeRole(['admin', 'manager']), async (req, res) => {
  const { orderedIds } = req.body;
  if (!Array.isArray(orderedIds)) {
    return res.status(400).json({ error: "orderedIds array required" });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    for (let i = 0; i < orderedIds.length; i++) {
      await client.query(
        "UPDATE gallery_images SET display_order = $1 WHERE id = $2 AND business_id = $3",
        [i + 1, orderedIds[i], req.business_id],
      );
    }
    await client.query("COMMIT");

    const io = req.app.get("io");
    if (io) io.emit("gallery-updated");

    await invalidateGalleryCache(req.business_id);

    res.json({ message: "Reordered" });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Gallery reorder error:", err);
    res.status(500).json({ error: "Failed to reorder" });
  } finally {
    client.release();
  }
});

module.exports = router;
