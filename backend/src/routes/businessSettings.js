const express = require("express");
const router = express.Router();
const { ensureBusinessSettings } = require("../utils/businessSettings");

const pool = require("../db/pool");

router.get("/", async (req, res) => {
  if (!req.business_id) {
    return res.status(400).json({ error: "No tenant slug provided. Access this endpoint via /:slug route." });
  }

  try {
    const settings = await ensureBusinessSettings(pool, req.business_id);
    
    // Fetch features and slug from tenant record
    const businessRes = await pool.query(
      "SELECT slug, features, is_active, layout_theme FROM businesses WHERE id = $1", 
      [req.business_id]
    );

    const business = businessRes.rows[0] || { slug: "", features: {}, is_active: true, layout_theme: "classic" };

    res.json({
      businessId: req.business_id,
      slug: business.slug,
      features: business.features,
      isActive: business.is_active,
      restaurantName: settings.restaurantName,
      gstin: settings.gstin,
      address: settings.address,
      phone: settings.phone,
      email: settings.email,
      isGstEnabled: settings.isGstEnabled,
      cgstRate: settings.cgstRate,
      sgstRate: settings.sgstRate,
      theme: settings.theme,
      layoutTheme: business.layout_theme || "classic",
      landingPageContent: settings.landingPageContent,
    });
  } catch (err) {
    console.error("Business settings fetch error:", err);
    res.status(500).json({ error: "Failed to fetch business settings" });
  }
});

module.exports = router;
