const express = require("express");
const router = express.Router();
const pool = require("../db/pool");
const { adminAuth, authorizeRole } = require("../middleware/adminAuth");
const uploadMenuImage = require("../middleware/uploadMenuImage");
const deleteCloudinaryImage = require("../utils/cloudinaryDelete");
const redisClient = require("../../config/redis");

// Cache invalidation helper
const { invalidateHeroCache } = require("../helpers/cacheHelper");

// Public: Get hero content
router.get("/", async (req, res) => {
  const cacheKey = `hero:content:${req.business_id}`;

  try {
    // Check Redis cache
    const cachedData = await redisClient.get(cacheKey);
    if (cachedData) {
      return res.json(JSON.parse(cachedData));
    }

    const { rows } = await pool.query(
      "SELECT * FROM hero_content WHERE business_id = $1",
      [req.business_id]
    );

    if (rows.length === 0) {
      const defaultHero = {
        id: 1,
        location_tag: "🍜Pune",
        title: "Authentic <span>Chinese Cuisine</span> in Pune",
        description:
          "Traditional flavors. Sizzling wok dishes. Fresh ingredients. Experience the finest culinary journey at The Chinese House.",
        image_url: null,
      };

      // Cache default hero
      await redisClient.set(cacheKey, JSON.stringify(defaultHero), {
        EX: 3600,
      });

      return res.json(defaultHero);
    }

    const hero = rows[0];

    // Cache result
    await redisClient.set(cacheKey, JSON.stringify(hero), {
      EX: 3600,
    });

    res.json(hero);
  } catch (err) {
    console.error("GET /hero error:", err);
    res.status(500).json({ error: "Failed to fetch hero content" });
  }
});


// Admin: Update hero content
router.put(
  "/",
  adminAuth,
  authorizeRole(['admin', 'manager']),
  uploadMenuImage.single("image"),
  async (req, res) => {
    try {
      const { location_tag, title, description } = req.body;

      const { rows: existing } = await pool.query(
        "SELECT * FROM hero_content WHERE business_id = $1",
        [req.business_id]
      );

      let image_url = existing[0]?.image_url || null;

      // If new image uploaded
      if (req.file) {
        // Delete old image from Cloudinary
        if (image_url) {
          await deleteCloudinaryImage(image_url);
        }

        image_url = req.file.path || req.file.secure_url || req.file.url;
      }

      // Upsert hero content using business_id as the key
      const { rows } = await pool.query(
        `INSERT INTO hero_content (business_id, location_tag, title, description, image_url, updated_at)
         VALUES ($1, $2, $3, $4, $5, NOW())
         ON CONFLICT (business_id) DO UPDATE
         SET location_tag = EXCLUDED.location_tag,
             title = EXCLUDED.title,
             description = EXCLUDED.description,
             image_url = EXCLUDED.image_url,
             updated_at = EXCLUDED.updated_at
         RETURNING *`,
        [req.business_id, location_tag || null, title || null, description || null, image_url]
      );

      // Emit socket update
      const io = req.app.get("io");
      if (io) io.emit("hero-updated", rows[0]);

      // Invalidate Redis cache
      await invalidateHeroCache(req.business_id);

      res.json(rows[0]);
    } catch (err) {
      console.error("PUT /hero error:", err);
      res.status(500).json({ error: "Failed to update hero content" });
    }
  }
);

module.exports = router;