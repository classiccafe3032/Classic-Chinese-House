const express = require("express");
const router = express.Router();
const pool = require("../db/pool");
const redisClient = require("../../config/redis");
const { invalidateReviewCache } = require("../helpers/cacheHelper");
const { adminAuth, authorizeRole } = require("../middleware/adminAuth");
const { Resend } = require("resend");

const resend = new Resend(process.env.RESEND_API_KEY);

// Get reviews for a specific item (paginated, highest rating first)
router.get("/", async (req, res) => {
  const { item, limit = "3", offset = "0" } = req.query;
  const cacheKey = `reviews:${item}:${limit}:${offset}:${req.business_id}`;
  
  if (!item?.trim()) {
    return res.status(400).json({ error: "item query param required" });
  }

  try {
    const cachedReviews = await redisClient.get(cacheKey);
    
    if (cachedReviews) {
      console.log(`Cache hit for ${cacheKey}`);
      return res.json(JSON.parse(cachedReviews));
    }

    const reviewsResult = await pool.query(
      `SELECT id, item_name, reviewer_name, rating, review_text, created_at
       FROM reviews WHERE item_name = $1 AND business_id = $4
       ORDER BY rating DESC, created_at DESC
       LIMIT $2 OFFSET $3`,
      [item.trim(), parseInt(limit), parseInt(offset), req.business_id],
    );

    const countResult = await pool.query(
      "SELECT COUNT(*) as total FROM reviews WHERE item_name = $1 AND business_id = $2",
      [item.trim(), req.business_id],
    );

    const avgResult = await pool.query(
      "SELECT COALESCE(AVG(rating), 0) as avg_rating FROM reviews WHERE item_name = $1 AND business_id = $2",
      [item.trim(), req.business_id],
    );
    const responseData = {
      reviews: reviewsResult.rows.map((r) => ({
        id: r.id,
        itemName: r.item_name,
        reviewerName: r.reviewer_name,
        rating: r.rating,
        reviewText: r.review_text,
        createdAt: r.created_at,
      })),
      total: parseInt(countResult.rows[0].total),
      avgRating: parseFloat(
        parseFloat(avgResult.rows[0].avg_rating).toFixed(1),
      ),
    };
    await redisClient.setEx(cacheKey, 3600, JSON.stringify(responseData));
    res.json(responseData);
  } catch (err) {
    console.error("Reviews fetch error:", err);
    res.status(500).json({ error: "Failed to fetch reviews" });
  }
});

// Get average ratings for all items (for menu display)
router.get("/summary", async (req, res) => {
  try {
    const cacheKey = `reviews:summary:${req.business_id}`;
    const cachedSummary = await redisClient.get(cacheKey);
    if (cachedSummary) {
      console.log("Cache hit for review summary");
      return res.json(JSON.parse(cachedSummary));
    }
    const result = await pool.query(
      `SELECT item_name, COUNT(*) as review_count, ROUND(AVG(rating)::numeric, 1) as avg_rating
       FROM reviews WHERE business_id = $1 GROUP BY item_name`,
      [req.business_id]
    );
    const summary = {};
    for (const row of result.rows) {
      summary[row.item_name] = {
        reviewCount: parseInt(row.review_count),
        avgRating: parseFloat(row.avg_rating),
      };
    }
    await redisClient.setEx(cacheKey, 3600, JSON.stringify(summary));
    res.json(summary);
  } catch (err) {
    console.error("Review summary error:", err);
    res.status(500).json({ error: "Failed to fetch summary" });
  }
});

// Post a new review (also sets menu_item_id if item exists)
router.post("/", async (req, res) => {
  const { itemName, reviewerName, rating, reviewText } = req.body;

  if (!itemName?.trim() || !reviewerName?.trim() || !reviewText?.trim()) {
    return res.status(400).json({ error: "Missing required fields" });
  }
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return res.status(400).json({ error: "Rating must be 1-5" });
  }
  if (reviewerName.trim().length > 100) {
    return res.status(400).json({ error: "Name too long" });
  }
  if (reviewText.trim().length > 500) {
    return res.status(400).json({ error: "Review too long (max 500 chars)" });
  }

  try {
    // Resolve menu_item_id from item name
    const itemLookup = await pool.query(
      "SELECT id FROM menu_items WHERE name = $1 AND business_id = $2 AND is_deleted = FALSE",
      [itemName.trim(), req.business_id]
    );
    const menuItemId = itemLookup.rows.length ? itemLookup.rows[0].id : null;

    const result = await pool.query(
      `INSERT INTO reviews (item_name, reviewer_name, rating, review_text, menu_item_id, business_id)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [itemName.trim(), reviewerName.trim(), rating, reviewText.trim(), menuItemId, req.business_id],
    );
    const r = result.rows[0];

    // Trigger instant email alert for bad reviews (1 or 2 stars)
    if (rating <= 2 && process.env.RESEND_API_KEY) {
      try {
        const adminRes = await pool.query("SELECT email FROM admin_account WHERE business_id = $1 AND email IS NOT NULL AND email != ''", [req.business_id]);
        const businessRes = await pool.query("SELECT restaurant_name FROM business_settings WHERE business_id = $1", [req.business_id]);
        
        const adminEmail = adminRes.rows.length ? adminRes.rows[0].email : null;
        const restaurantName = businessRes.rows.length ? businessRes.rows[0].restaurant_name : "Your Restaurant";

        if (adminEmail) {
          await resend.emails.send({
            from: "The Chinese House System <onboarding@resend.dev>",
            to: adminEmail,
            subject: `⚠️ URGENT: Bad Review Received - ${restaurantName}`,
            html: `
              <h2>⚠️ Bad Review Alert</h2>
              <p>A customer just left a low rating. Quick intervention is recommended.</p>
              <p><strong>Customer Name:</strong> ${reviewerName.trim()}</p>
              <p><strong>Item Reviewed:</strong> ${itemName.trim()}</p>
              <p><strong>Rating:</strong> ${rating} / 5</p>
              <p><strong>Comment:</strong></p>
              <blockquote style="border-left: 4px solid #ef4444; padding-left: 10px; color: #555;">
                ${reviewText.trim()}
              </blockquote>
            `,
          });
          console.log(`Bad review alert sent to ${adminEmail}`);
        }
      } catch (emailErr) {
        console.error("Failed to send bad review alert:", emailErr);
      }
    }

    await invalidateReviewCache(req.business_id);
    res.status(201).json({
      id: r.id,
      itemName: r.item_name,
      reviewerName: r.reviewer_name,
      rating: r.rating,
      reviewText: r.review_text,
      createdAt: r.created_at,
    });
  } catch (err) {
    console.error("Review create error:", err);
    res.status(500).json({ error: "Failed to create review" });
  }
});

// Admin: search all reviews (paginated)
router.get("/admin-search",adminAuth, async (req, res) => {
  const { q = "", limit = "20", offset = "0" } = req.query;
  const searchTerm = `%${q.trim()}%`;
  const cacheKey = `adminSearch:${searchTerm}:${limit}:${offset}:${req.business_id}`;
  try {
    const cachedResult = await redisClient.get(cacheKey);
    if (cachedResult) {
      console.log(`Cache hit for ${cacheKey}`);
      return res.json(JSON.parse(cachedResult));
    }
    const reviewsResult = await pool.query(
      `SELECT id, item_name, reviewer_name, rating, review_text, created_at
       FROM reviews
       WHERE ($1 = '%%' OR item_name ILIKE $1 OR reviewer_name ILIKE $1 OR review_text ILIKE $1)
         AND business_id = $4
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      [searchTerm, parseInt(limit), parseInt(offset), req.business_id],
    );

    const countResult = await pool.query(
      `SELECT COUNT(*) as total FROM reviews
       WHERE ($1 = '%%' OR item_name ILIKE $1 OR reviewer_name ILIKE $1 OR review_text ILIKE $1)
         AND business_id = $2`,
      [searchTerm, req.business_id],
    );
    const responseData = {
      reviews: reviewsResult.rows.map((r) => ({
        id: r.id,
        itemName: r.item_name,
        reviewerName: r.reviewer_name,
        rating: r.rating,
        reviewText: r.review_text,
        createdAt: r.created_at,
      })),
      total: parseInt(countResult.rows[0].total),
    };
    await redisClient.setEx(cacheKey, 3600, JSON.stringify(responseData));
    res.json(responseData);
  } catch (err) {
    console.error("Admin review search error:", err);
    res.status(500).json({ error: "Failed to search reviews" });
  }
});

// Admin: delete a review
router.delete("/:id", adminAuth, authorizeRole(['admin', 'manager']), async (req, res) => {
  const { id } = req.params;

  try {
    const result = await pool.query(
      "DELETE FROM reviews WHERE id = $1 AND business_id = $2 RETURNING id",
      [parseInt(id), req.business_id],
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Review not found" });
    }
    await invalidateReviewCache(req.business_id);
    res.json({ message: "Review deleted" });
  } catch (err) {
    console.error("Review delete error:", err);
    res.status(500).json({ error: "Failed to delete review" });
  }
});

// Admin: bulk delete reviews
router.post("/admin-bulk-delete", adminAuth, authorizeRole(['admin', 'manager']), async (req, res) => {
  const { ids } = req.body;
  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: "ids array required" });
  }
  try {
    const result = await pool.query(
      "DELETE FROM reviews WHERE id = ANY($1::int[]) AND business_id = $2 RETURNING id",
      [ids.map((id) => parseInt(id)), req.business_id],
    );
    await invalidateReviewCache(req.business_id);
    res.json({ deleted: result.rows.map((r) => r.id), count: result.rowCount });
  } catch (err) {
    console.error("Bulk delete reviews error:", err);
    res.status(500).json({ error: "Failed to bulk delete reviews" });
  }
});

// Get latest reviews for homepage
router.get("/latest", async (req, res) => {
  const { limit = "5" } = req.query;
  const cacheKey = `reviews:latest:${limit}:${req.business_id}`;
  try {
    const cachedResult = await redisClient.get(cacheKey);
    if (cachedResult) {
      console.log(`Cache hit for ${cacheKey}`);
      return res.json(JSON.parse(cachedResult));
    }
    const result = await pool.query(
      `SELECT id, item_name, reviewer_name, rating, review_text, created_at
       FROM reviews
       WHERE business_id = $2
       ORDER BY created_at DESC
       LIMIT $1`,
      [parseInt(limit), req.business_id],
    );
    const responseData = result.rows.map((r) => ({
      id: r.id,
      itemName: r.item_name,
      reviewerName: r.reviewer_name,
      rating: r.rating,
      reviewText: r.review_text,
      createdAt: r.created_at,
    }));
    await redisClient.setEx(cacheKey, 3600, JSON.stringify(responseData));
    res.json(responseData);
  } catch (err) {
    console.error("Latest reviews fetch error:", err);
    res.status(500).json({ error: "Failed to fetch latest reviews" });
  }
});

module.exports = router;
