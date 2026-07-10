const express = require("express");
const router = express.Router();
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const pool = require("../db/pool");
const { adminAuth, authorizeRole, JWT_SECRET } = require("../middleware/adminAuth");

const BCRYPT_ROUNDS = 12;

// ======================================================
// STAFF LOGIN (PIN-based)
// ======================================================
router.post("/login", async (req, res) => {
  const { pin } = req.body;

  if (!pin || typeof pin !== "string") {
    return res.status(400).json({ error: "PIN is required" });
  }

  try {
    // Use business_id from the tenant enforcer middleware
    const businessId = req.business_id;

    if (!businessId) {
      return res.status(500).json({ error: "Business not configured" });
    }

    // Get business features
    const businessRes = await pool.query(
      "SELECT features FROM businesses WHERE id = $1 AND is_active = true",
      [businessId]
    );

    if (!businessRes.rows.length) {
      return res.status(404).json({ error: "Business not found or inactive" });
    }

    const features = businessRes.rows[0].features;

    // Find staff for this business
    const result = await pool.query(
      "SELECT * FROM staff WHERE is_active = true AND business_id = $1",
      [businessId]
    );

    let authenticatedStaff = null;

    for (const staff of result.rows) {
      const match = await bcrypt.compare(pin, staff.pin_hash);
      if (match) {
        authenticatedStaff = staff;
        break;
      }
    }

    if (!authenticatedStaff) {
      return res.status(401).json({ error: "Invalid PIN" });
    }

    const token = jwt.sign(
      { 
        id: authenticatedStaff.id, 
        name: authenticatedStaff.name, 
        role: authenticatedStaff.role,
        phone: authenticatedStaff.phone,
        permissions: authenticatedStaff.permissions || {},
        business_id: authenticatedStaff.business_id,
        isStaff: true 
      },
      JWT_SECRET,
      { expiresIn: "12h" } // Longer session for POS staff
    );

    res.json({ 
      message: "Login successful", 
      token, 
      user: { 
        name: authenticatedStaff.name, 
        role: authenticatedStaff.role,
        phone: authenticatedStaff.phone || null,
        permissions: authenticatedStaff.permissions || {}
      },
      features
    });
  } catch (err) {
    console.error("Staff login error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ======================================================
// GET CURRENT STAFF
// ======================================================
router.get("/me", adminAuth, (req, res) => {
  res.json({ 
    authenticated: true, 
    user: req.admin 
  });
});

// ======================================================
// STAFF MANAGEMENT (Owner/Manager only)
// ======================================================

// List all staff
router.get("/", adminAuth, authorizeRole(['admin', 'manager']), async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT id, name, role, phone, is_active, created_at, permissions FROM staff WHERE business_id = $1 ORDER BY created_at DESC",
      [req.business_id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error("Fetch staff error:", err);
    res.status(500).json({ error: "Failed to fetch staff" });
  }
});

// Add new staff
router.post("/", adminAuth, authorizeRole(['admin', 'manager']), async (req, res) => {
  const { name, pin, role, phone, permissions } = req.body;

  if (!name || !pin || !role) {
    return res.status(400).json({ error: "Name, PIN, and role are required" });
  }

  if (!['manager', 'waiter', 'kitchen'].includes(role)) {
    return res.status(400).json({ error: "Invalid role" });
  }

  const trimmedName = name.trim();
  if (trimmedName.length < 2 || trimmedName.length > 20 || !/^[A-Za-z\s]+$/.test(trimmedName)) {
    return res.status(400).json({ error: "Name must be 2-20 characters long and contain only alphabets." });
  }

  if (phone) {
    const trimmedPhone = phone.trim();
    if (!/^[0-9]{10}$/.test(trimmedPhone)) {
      return res.status(400).json({ error: "Phone number must be exactly 10 digits." });
    }
  }

  try {
    const pinHash = await bcrypt.hash(pin, BCRYPT_ROUNDS);
    const result = await pool.query(
      "INSERT INTO staff (name, pin_hash, role, phone, business_id, permissions) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, name, role, phone, permissions",
      [name, pinHash, role, phone || null, req.business_id, permissions || {}]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error("Create staff error:", err);
    res.status(500).json({ error: "Failed to create staff" });
  }
});

// Update staff
router.put("/:id", adminAuth, authorizeRole(['admin', 'manager']), async (req, res) => {
  const { id } = req.params;
  const { name, pin, role, is_active, phone, permissions } = req.body;

  if (name !== undefined) {
    const trimmedName = name.trim();
    if (trimmedName.length < 2 || trimmedName.length > 20 || !/^[A-Za-z\s]+$/.test(trimmedName)) {
      return res.status(400).json({ error: "Name must be 2-20 characters long and contain only alphabets." });
    }
  }

  if (phone !== undefined && phone !== null) {
    const trimmedPhone = phone.trim();
    if (!/^[0-9]{10}$/.test(trimmedPhone)) {
      return res.status(400).json({ error: "Phone number must be exactly 10 digits." });
    }
  }

  try {
    let query = "UPDATE staff SET name = COALESCE($1, name), role = COALESCE($2, role), is_active = COALESCE($3, is_active), phone = COALESCE($4, phone), permissions = COALESCE($5::jsonb, permissions)";
    const params = [name, role, is_active, phone || null, permissions ? JSON.stringify(permissions) : null];

    if (pin) {
      const pinHash = await bcrypt.hash(pin, BCRYPT_ROUNDS);
      query += `, pin_hash = $6 WHERE id = $7 AND business_id = $8`;
      params.push(pinHash, id, req.business_id);
    } else {
      query += ` WHERE id = $6 AND business_id = $7`;
      params.push(id, req.business_id);
    }

    const result = await pool.query(query + " RETURNING id, name, role, phone, is_active, permissions", params);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Staff not found" });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error("Update staff error:", err);
    res.status(500).json({ error: "Failed to update staff" });
  }
});

// Delete staff
router.delete("/:id", adminAuth, authorizeRole(['admin', 'manager']), async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query("DELETE FROM staff WHERE id = $1 AND business_id = $2 RETURNING id", [id, req.business_id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Staff not found" });
    }
    res.json({ message: "Staff deleted successfully" });
  } catch (err) {
    console.error("Delete staff error:", err);
    res.status(500).json({ error: "Failed to delete staff" });
  }
});

module.exports = router;
