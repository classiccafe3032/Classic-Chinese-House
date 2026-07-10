const pool = require("../db/pool");

/**
 * Single-Tenant Middleware
 * Automatically resolves the single business_id for every request.
 * Caches the ID in-memory after the first DB lookup.
 */
let cachedBusinessId = null;

async function tenantEnforcer(req, res, next) {
  // If already authenticated (admin/staff JWT), use the JWT's business_id
  if (req.admin && req.admin.business_id) {
    req.business_id = req.admin.business_id;
    return next();
  }

  // Use cached business ID if available
  if (cachedBusinessId) {
    req.business_id = cachedBusinessId;
    return next();
  }

  // Fetch the single business from DB and cache it
  try {
    const result = await pool.query("SELECT id FROM businesses WHERE is_active = true LIMIT 1");
    if (result.rows.length) {
      cachedBusinessId = result.rows[0].id;
      req.business_id = cachedBusinessId;
    }
  } catch (err) {
    console.error("Failed to resolve business:", err);
  }

  return next();
}

module.exports = { tenantEnforcer };
