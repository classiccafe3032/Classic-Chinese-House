const pool = require("../db/pool");
const { DEFAULT_CGST_RATE, DEFAULT_SGST_RATE } = require("./gst");

const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
const DEFAULT_RESTAURANT_NAME = "Classic Chinese";

function normalizeBusinessSettings(row = {}) {
  // Default dynamic landing page content
  const defaultContent = {
    about_title: "A Taste of <span class='text-primary'>Chinese</span> Tradition",
    about_description: `${row.restaurant_name || DEFAULT_RESTAURANT_NAME} brings authentic Chinese dining culture to you. From classic dim sums to sizzling hot main courses, we serve happiness in every bite.`,
    about_cards: [
      { icon: "Heart", title: "Authentic Recipes", desc: "Crafted with traditional methods and fresh ingredients" },
      { icon: "Coffee", title: "Warm Ambience", desc: "Elegant oriental setup meets modern comfort" },
      { icon: "Users", title: "Family Dining", desc: "Ideal for sharing delicious moments together" },
      { icon: "Sparkles", title: "Wok Hei Flavor", desc: "Served hot and fresh straight from the sizzling wok" }
    ],
    why_choose_us_title: `Why Choose <span class='text-secondary'>${row.restaurant_name || "Classic Chinese"}</span>`,
    why_choose_us_cards: [
      { icon: "ChefHat", title: "Freshly Prepared", desc: "Every dish prepared fresh from the wok" },
      { icon: "Award", title: "Authentic Ingredients", desc: "Traditional Chinese herbs and spices" },
      { icon: "Utensils", title: "Skilled Chefs", desc: "Trained wok masters perfecting the heat" },
      { icon: "Camera", title: "Perfect Ambience", desc: "Elegant and comfortable oriental vibes" }
    ],
    gallery_title: `A Glimpse of <span class='text-primary'>${row.restaurant_name || "Classic Chinese"}</span>`,
    gift_voucher_title: "Gift a Dining Voucher 🧧",
    gift_voucher_description: `Surprise someone special with a ${row.restaurant_name || "Classic Chinese"} gift voucher. Choose any amount starting from ₹100, customize the code, and share it instantly via WhatsApp!`,
    menu_title: "OUR MENU",
    menu_main_title: `Signature <span class='text-primary'>Dishes</span>`,
    menu_description: "From classic starters to sizzling main courses, every dish is a masterpiece. Sorted by highest ratings."
  };

  return {
    id: row.id ?? 1,
    restaurantName: row.restaurant_name || DEFAULT_RESTAURANT_NAME,
    gstin: row.gstin || null,
    address: row.address || "",
    phone: row.phone || "",
    email: row.email || "",
    isGstEnabled: row.is_gst_enabled !== false,
    cgstRate: row.cgst_rate != null ? Number(row.cgst_rate) : DEFAULT_CGST_RATE,
    sgstRate: row.sgst_rate != null ? Number(row.sgst_rate) : DEFAULT_SGST_RATE,
    kitchenPin: row.kitchen_pin || "1234",
    theme: row.theme || "gourmet-royal",
    orderWorkflow: row.order_workflow || "quick-complete",
    printerWidth: row.printer_width || "58mm",
    loyaltyEnabled: row.loyalty_enabled !== false, // Default to true if null, or maybe false? The DB has default true. Let's say row.loyalty_enabled ?? false. Wait, existing DB might have it null? Actually schema has default true.
    loyaltyPointsPer100: row.loyalty_points_per_100 != null ? Number(row.loyalty_points_per_100) : 10,
    loyaltyDiscountPerPoint: row.loyalty_discount_per_point != null ? Number(row.loyalty_discount_per_point) : 1.00,
    qrRoutingMode: row.qr_routing_mode || "claim",
    landingPageContent: row.landing_page_content && Object.keys(row.landing_page_content).length > 0
      ? { ...defaultContent, ...row.landing_page_content }
      : defaultContent
  };
}

async function ensureBusinessSettings(db = pool, businessId) {
  if (!businessId) {
    throw new Error("businessId is required to fetch settings");
  }

  await db.query(
    `INSERT INTO business_settings (restaurant_name, address, phone, email, is_gst_enabled, cgst_rate, sgst_rate, business_id)
     VALUES ($1, '', '', '', true, $2, $3, $4)
     ON CONFLICT (business_id) DO NOTHING`,
    [DEFAULT_RESTAURANT_NAME, DEFAULT_CGST_RATE, DEFAULT_SGST_RATE, businessId],
  );

  const result = await db.query(
    `SELECT bs.*, b.theme
     FROM business_settings bs
     JOIN businesses b ON bs.business_id = b.id
     WHERE bs.business_id = $1`,
    [businessId]
  );

  return normalizeBusinessSettings(result.rows[0]);
}

function toBusinessResponse(settings) {
  return {
    restaurantName: settings.restaurantName,
    gstin: settings.gstin,
    address: settings.address,
    qrRoutingMode: settings.qrRoutingMode
  };
}

module.exports = {
  GSTIN_REGEX,
  DEFAULT_RESTAURANT_NAME,
  normalizeBusinessSettings,
  ensureBusinessSettings,
  toBusinessResponse,
};
