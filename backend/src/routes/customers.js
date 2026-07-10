const express = require("express");
const pool = require("../db/pool");

const router = express.Router();

// GET /api/customers/loyalty/:phone
// Fetch loyalty points for a customer
router.get("/loyalty/:phone", async (req, res) => {
  try {
    const { phone } = req.params;
    const businessId = req.business_id;

    if (!phone || phone.length < 10) {
      return res.status(400).json({ error: "Invalid phone number" });
    }

    // Check if loyalty is enabled for this business
    const settingsRes = await pool.query(
      "SELECT loyalty_enabled, loyalty_points_per_100, loyalty_discount_per_point FROM business_settings WHERE business_id = $1",
      [businessId]
    );

    const settings = settingsRes.rows[0];
    if (!settings || !settings.loyalty_enabled) {
      return res.json({ enabled: false });
    }

    // Fetch customer
    const customerRes = await pool.query(
      "SELECT id, name, points_balance, total_spent FROM customers WHERE business_id = $1 AND phone = $2",
      [businessId, phone]
    );

    if (customerRes.rows.length === 0) {
      return res.json({
        enabled: true,
        customerExists: false,
        points: 0,
        settings,
      });
    }

    const customer = customerRes.rows[0];
    return res.json({
      enabled: true,
      customerExists: true,
      points: customer.points_balance,
      name: customer.name,
      totalSpent: customer.total_spent,
      settings,
    });
  } catch (error) {
    console.error("Error fetching loyalty points:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/customers
// Fetch all customers for admin dashboard (paginated/searchable)
router.get("/", async (req, res) => {
  try {
    const businessId = req.business_id;
    const { search = "", limit = 50, offset = 0 } = req.query;

    let query = "SELECT * FROM customers WHERE business_id = $1";
    let countQuery = "SELECT COUNT(*) FROM customers WHERE business_id = $1";
    const queryParams = [businessId];

    if (search) {
      query += " AND (phone ILIKE $2 OR name ILIKE $2)";
      countQuery += " AND (phone ILIKE $2 OR name ILIKE $2)";
      queryParams.push(`%${search}%`);
    }

    query += ` ORDER BY points_balance DESC, total_spent DESC LIMIT $${queryParams.length + 1} OFFSET $${queryParams.length + 2}`;

    const [dataRes, countRes] = await Promise.all([
      pool.query(query, [...queryParams, limit, offset]),
      pool.query(countQuery, queryParams.length > 1 ? [queryParams[0], queryParams[1]] : [queryParams[0]])
    ]);

    res.json({
      customers: dataRes.rows,
      total: parseInt(countRes.rows[0].count),
    });
  } catch (error) {
    console.error("Error fetching customers:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;
