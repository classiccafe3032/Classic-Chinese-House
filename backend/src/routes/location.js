const express = require("express");
const router = express.Router();
const pool = require("../db/pool");
const { adminAuth } = require("../middleware/adminAuth");
const redisClient = require("../../config/redis");
const { invalidateLocationCache } = require("../helpers/cacheHelper");

/* ---------------- MAP URL RESOLVER ---------------- */

async function resolveToEmbedUrl(raw) {
  let url = raw.trim();
  if (!url) return "";

  if (url.includes("output=embed") || url.includes("/maps/embed")) return url;

  if (url.includes("maps.app.goo.gl") || url.includes("goo.gl/maps")) {
    try {
      const resp = await fetch(url, { method: "HEAD", redirect: "follow" });
      url = resp.url || url;
    } catch {}
  }

  const coordMatch = url.match(/@(-?\d+\.?\d*),(-?\d+\.?\d*)/);

  if (coordMatch) {
    const [, lat, lng] = coordMatch;
    return `https://www.google.com/maps?q=${lat},${lng}&z=17&output=embed`;
  }

  return `https://www.google.com/maps?q=${encodeURIComponent(url)}&z=17&output=embed`;
}

/* ---------------- DEFAULT DATA ---------------- */

const DEFAULTS = {
  id: 1,
  address: "Vishal Nagar, Pune",
  phone: "+91 7045339273",
  open_time: "19:00",
  close_time: "23:00",
  closed_day: 1,
  opening_hours_display: "Tue - Sun: 7 PM - 11 PM • Mon Closed",
  instagram_handle: "@thechinesehouse",
  instagram_url: "https://instagram.com/thechinesehouse",
  map_embed_url:
    "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3781.7146848788047!2d73.781651!3d18.5868975!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x3bc2b90455ed4a49%3A0xc2b269cc14a380d7!2sThe%20Chinese%20House!5e0!3m2!1sen!2sin!4v1781237428223!5m2!1sen!2sin",
};

/* ---------------- GET LOCATION ---------------- */

router.get("/", async (req, res) => {
  const cacheKey = `location:content:${req.business_id}`;

  try {
    const cached = await redisClient.get(cacheKey);

    if (cached) return res.json(JSON.parse(cached));

    const { rows } = await pool.query(
      "SELECT * FROM location_content WHERE business_id=$1",
      [req.business_id]
    );

    const data = rows.length ? rows[0] : DEFAULTS;

    await redisClient.set(cacheKey, JSON.stringify(data), { EX: 3600 });

    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch location" });
  }
});

/* ---------------- MAP RESOLVE ---------------- */

router.post("/resolve-map", adminAuth, async (req, res) => {
  try {
    const { url } = req.body;
    if (!url) return res.status(400).json({ error: "url required" });

    const embedUrl = await resolveToEmbedUrl(url);

    res.json({ embed_url: embedUrl });
  } catch (err) {
    res.status(500).json({ error: "Resolve failed" });
  }
});

/* ---------------- UPDATE LOCATION ---------------- */

router.put("/", adminAuth, async (req, res) => {
  try {
    let {
      address,
      phone,
      open_time,
      close_time,
      closed_day,
      opening_hours_display,
      instagram_handle,
      instagram_url,
      map_embed_url,
    } = req.body;

    if (phone) {
      const trimmedPhone = phone.trim();
      if (!/^[0-9]{10}$/.test(trimmedPhone)) {
        return res.status(400).json({ error: "Phone number must be exactly 10 digits." });
      }
    }

    if (map_embed_url && !map_embed_url.includes("output=embed")) {
      map_embed_url = await resolveToEmbedUrl(map_embed_url);
    }

    const { rows } = await pool.query(
      `INSERT INTO location_content
       (address, phone, open_time, close_time, closed_day, opening_hours_display,
        instagram_handle, instagram_url, map_embed_url, business_id, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
       ON CONFLICT (business_id) DO UPDATE
       SET address = EXCLUDED.address,
           phone = EXCLUDED.phone,
           open_time = EXCLUDED.open_time,
           close_time = EXCLUDED.close_time,
           closed_day = EXCLUDED.closed_day,
           opening_hours_display = EXCLUDED.opening_hours_display,
           instagram_handle = EXCLUDED.instagram_handle,
           instagram_url = EXCLUDED.instagram_url,
           map_embed_url = EXCLUDED.map_embed_url,
           updated_at = NOW()
       RETURNING *`,
      [
        address,
        phone,
        open_time,
        close_time,
        closed_day,
        opening_hours_display,
        instagram_handle,
        instagram_url,
        map_embed_url,
        req.business_id
      ]
    );

    await invalidateLocationCache(req.business_id);

    const io = req.app.get("io");
    if (io) io.emit("location-updated");

    res.json(rows[0]);
  } catch (err) {
    console.error("Location update failed:", err);
    res.status(500).json({ error: "Update failed" });
  }
});

module.exports = router;