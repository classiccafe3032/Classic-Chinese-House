const express = require("express");
const router = express.Router();
const pool = require("../db/pool");
const crypto = require("crypto");
const redisClient = require("../../config/redis");
const { invalidateAdminListCache } = require("../helpers/cacheHelper");
const { adminAuth } = require("../middleware/adminAuth");
const { sendSMS } = require("../utils/smsSender");
const { ensureBusinessSettings } = require("../utils/businessSettings");
const { calculateOrderTotals } = require("../utils/gst");

// ─── Auth middleware (Bearer token primary, cookie/header fallback) ─
function auth(req, res, next) {
  const authHeader = req.headers.authorization;
  const cookieToken = req.cookies?.admin_token;
  if ((authHeader && authHeader.startsWith("Bearer ")) || cookieToken) {
    return adminAuth(req, res, next);
  }
  const password = req.headers["x-dashboard-password"];
  if (password && password === process.env.DASHBOARD_PASSWORD) {
    return next();
  }
  return res.status(401).json({ error: "Unauthorized" });
}

// ─── Validate Coupon ─────────────────────────────────────
router.post("/validate", async (req, res) => {
  const { code, orderTotal } = req.body;

  if (!code?.trim() || typeof orderTotal !== "number" || orderTotal <= 0) {
    return res.status(400).json({ error: "Invalid request" });
  }

  const normalizedCode = code.trim().toUpperCase();

  try {
    const [couponResult, businessSettings] = await Promise.all([
      pool.query(`SELECT * FROM coupons WHERE code = $1 AND business_id = $2`, [normalizedCode, req.business_id]),
      ensureBusinessSettings(pool, req.business_id),
    ]);

    if (!couponResult.rows.length) {
      return res.status(404).json({ error: "Coupon not found" });
    }

    const coupon = couponResult.rows[0];

    if (!coupon.active)
      return res.status(400).json({ error: "Coupon inactive" });
    if (coupon.expiry_date && new Date(coupon.expiry_date) < new Date())
      return res.status(400).json({ error: "Coupon expired" });
    if (coupon.used_count >= coupon.usage_limit)
      return res.status(400).json({ error: "Usage limit reached" });

    let discount =
      coupon.discount_type === "percent"
        ? (orderTotal * parseFloat(coupon.value)) / 100
        : parseFloat(coupon.value);

    const totals = calculateOrderTotals({
      subtotal: orderTotal,
      discount,
      gstEnabled: businessSettings.isGstEnabled,
      cgstRate: businessSettings.cgstRate,
      sgstRate: businessSettings.sgstRate,
    });

    res.json({
      valid: true,
      code: normalizedCode,
      discountType: coupon.discount_type,
      value: parseFloat(coupon.value),
      discount: totals.discount,
      subtotal: totals.subtotal,
      taxableAmount: totals.taxableAmount,
      cgst: totals.cgst,
      sgst: totals.sgst,
      gst: totals.gstTotal,
      gstRate: totals.gstRate,
      finalTotal: totals.total,
      isGstEnabled: businessSettings.isGstEnabled,
    });
  } catch (err) {
    console.error("Validate error:", err);
    res.status(500).json({ error: "Validation failed" });
  }
});

// ─── Create Paid Voucher ─────────────────────────────────
router.post("/create-paid", async (req, res) => {
  const { amount, phone, customCode } = req.body;

  if (typeof amount !== "number" || amount < 100)
    return res.status(400).json({ error: "Min ₹100" });

  if (!phone || !/^\d{10}$/.test(phone))
    return res.status(400).json({ error: "Invalid phone" });

  let code = customCode?.trim()
    ? customCode
        .trim()
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, "")
    : "HNY" + crypto.randomBytes(4).toString("hex").toUpperCase().slice(0, 5);

  if (code.length < 5) return res.status(400).json({ error: "Code too short" });

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const exists = await client.query(
      "SELECT code FROM coupons WHERE code=$1 AND business_id=$2 FOR UPDATE",
      [code, req.business_id],
    );

    if (exists.rows.length) {
      await client.query("ROLLBACK");
      return res.status(409).json({ error: "Code exists" });
    }

    const result = await client.query(
      `INSERT INTO coupons 
       (code, discount_type, value, usage_limit, used_count, created_by, active, business_id)
       VALUES ($1,'flat',$2,1,0,$3,true,$4)
       RETURNING *`,
      [code, amount, phone, req.business_id],
    );

    await client.query("COMMIT");

    // SEND SMS AFTER COMMIT
    const message = `

      🎉 Classic Chinese Voucher!

      Code: ${code}
      Value: ₹${amount}
      Use it on your next order.

      Thank you! 🍜`;

    try {
      await sendSMS(phone, message);
    } catch (smsError) {
      console.error("SMS sending failed:", smsError.message);
      // Do NOT fail voucher creation if SMS fails
    }

    await invalidateAdminListCache(req.business_id);

    res.status(201).json({
      code: result.rows[0].code,
      value: Number(result.rows[0].value),
    });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Create paid error:", err);
    res.status(500).json({ error: "Voucher failed" });
  } finally {
    client.release();
  }
});

// ─── Admin Create Coupon ─────────────────────────────────
router.post("/admin-create", auth, async (req, res) => {
  let { code, discount_type, value, expiry_date, usage_limit, active, is_public } =
    req.body;

  if (!["percent", "flat"].includes(discount_type))
    return res.status(400).json({ error: "Invalid type" });

  if (typeof value !== "number" || value <= 0)
    return res.status(400).json({ error: "Invalid value" });

  if (discount_type === "percent" && value > 100)
    return res.status(400).json({ error: "Percent > 100" });

  code =
    code?.trim().toUpperCase() ||
    "HNY" + crypto.randomBytes(4).toString("hex").toUpperCase().slice(0, 5);

  try {
    const result = await pool.query(
      `INSERT INTO coupons 
       (code,discount_type,value,expiry_date,usage_limit,active,is_public,created_by,business_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,'admin',$8)
       RETURNING *`,
      [
        code,
        discount_type,
        value,
        expiry_date || null,
        usage_limit || 1,
        active ?? true,
        is_public ?? false,
        req.business_id
      ],
    );

    await invalidateAdminListCache(req.business_id);
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error("Admin create error:", err);
    res.status(500).json({ error: "Create failed" });
  }
});
// ─── Admin List Coupons ──────────────────────────────────
router.get("/admin-list", auth, async (req, res) => {
  try {
    const cacheKey = `admin-list:coupons:${req.business_id}`;
    let cached;
    try {
      cached = await redisClient.get(cacheKey);
    } catch (e) {
      console.error("Redis GET failed", e);
    }

    if (cached) {
      console.log(`Cache hit for ${cacheKey}`);
      return res.json(JSON.parse(cached));
    }

    const result = await pool.query(
      "SELECT * FROM coupons WHERE business_id = $1 ORDER BY created_at DESC",
      [req.business_id]
    );

    try {
      await redisClient.set(cacheKey, JSON.stringify(result.rows), {
        EX: 300,
      });
    } catch (e) {
      console.error("Redis SET failed", e);
    }

    res.json(result.rows);
  } catch (err) {
    console.error("Admin list error:", err);
    res.status(500).json({ error: "List failed" });
  }
});

// ─── Toggle Coupon Active ──────────────────────────────────
router.patch("/admin-toggle/:code", auth, async (req, res) => {
  try {
    const result = await pool.query(
      "UPDATE coupons SET active = NOT active WHERE code=$1 AND business_id=$2 RETURNING *",
      [req.params.code.toUpperCase(), req.business_id],
    );

    if (!result.rowCount) return res.status(404).json({ error: "Not found" });

    await invalidateAdminListCache(req.business_id);
    res.json(result.rows[0]);
  } catch (err) {
    console.error("Toggle error:", err);
    res.status(500).json({ error: "Toggle failed" });
  }
});

// ─── Toggle Coupon Public ──────────────────────────────────
router.patch("/admin-toggle-public/:code", auth, async (req, res) => {
  try {
    const result = await pool.query(
      "UPDATE coupons SET is_public = NOT is_public WHERE code=$1 AND business_id=$2 RETURNING *",
      [req.params.code.toUpperCase(), req.business_id],
    );

    if (!result.rowCount) return res.status(404).json({ error: "Not found" });

    await invalidateAdminListCache(req.business_id);
    res.json(result.rows[0]);
  } catch (err) {
    console.error("Toggle public error:", err);
    res.status(500).json({ error: "Toggle failed" });
  }
});

// ─── Share Coupon via SMS ────────────────────────────────
router.post("/admin-share-sms", auth, async (req, res) => {
  const { code, phone } = req.body;

  if (!code?.trim()) return res.status(400).json({ error: "Coupon code required" });
  if (!phone || !/^\d{10}$/.test(phone.trim()))
    return res.status(400).json({ error: "Valid 10-digit phone required" });

  try {
    const result = await pool.query("SELECT * FROM coupons WHERE code = $1 AND business_id = $2", [
      code.trim().toUpperCase(), req.business_id
    ]);

    if (!result.rows.length)
      return res.status(404).json({ error: "Coupon not found" });

    const coupon = result.rows[0];

    const valueText =
      coupon.discount_type === "percent"
        ? `${parseFloat(coupon.value)}% off`
        : `₹${parseFloat(coupon.value)} off`;

    const expiryText = coupon.expiry_date
      ? `\nValid till: ${new Date(coupon.expiry_date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}`
      : "";

    const message = `🍜 Classic Chinese Coupon!\n\nCode: ${coupon.code}\nDiscount: ${valueText}${expiryText}\n\nApply at checkout on your next order. Enjoy! 🎉`;

    await sendSMS(phone.trim(), message);

    res.json({ success: true, message: "Coupon details sent via SMS" });
  } catch (err) {
    console.error("Share SMS error:", err);
    res.status(500).json({ error: "Failed to send SMS" });
  }
});

// ─── Delete Coupon ───────────────────────────────────────
router.delete("/admin-delete/:code", auth, async (req, res) => {
  try {
    const result = await pool.query(
      "DELETE FROM coupons WHERE code=$1 AND business_id=$2 RETURNING code",
      [req.params.code.toUpperCase(), req.business_id],
    );

    if (!result.rowCount) return res.status(404).json({ error: "Not found" });

    await invalidateAdminListCache(req.business_id);
    res.json({ deleted: result.rows[0].code });
  } catch (err) {
    console.error("Delete error:", err);
    res.status(500).json({ error: "Delete failed" });
  }
});

// ─── Bulk Delete Coupons ────────────────────────────────
router.post("/admin-bulk-delete", auth, async (req, res) => {
  const { codes } = req.body;

  if (!Array.isArray(codes) || codes.length === 0) {
    return res.status(400).json({ error: "No codes provided" });
  }

  const normalizedCodes = codes.map((c) => String(c).trim().toUpperCase());

  try {
    const result = await pool.query(
      "DELETE FROM coupons WHERE code = ANY($1) AND business_id = $2 RETURNING code",
      [normalizedCodes, req.business_id],
    );

    await invalidateAdminListCache(req.business_id);
    res.json({ deleted: result.rows.map((r) => r.code), count: result.rowCount });
  } catch (err) {
    console.error("Bulk delete error:", err);
    res.status(500).json({ error: "Bulk delete failed" });
  }
});

module.exports = router;
