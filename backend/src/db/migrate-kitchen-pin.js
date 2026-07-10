require("dotenv").config();
const pool = require("./pool");

async function migrateKitchenPin() {
  try {
    await pool.query(`
      ALTER TABLE business_settings
      ADD COLUMN IF NOT EXISTS kitchen_pin VARCHAR(6) DEFAULT '1234'
    `);
    console.log("✅ kitchen_pin column added to business_settings");
  } catch (err) {
    console.error("❌ Kitchen PIN migration failed:", err);
  }
}

migrateKitchenPin();
