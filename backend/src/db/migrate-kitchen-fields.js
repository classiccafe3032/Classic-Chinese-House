const pool = require("./pool");

async function migrateKitchenFields() {
  try {
    await pool.query(`
      ALTER TABLE orders
      ADD COLUMN IF NOT EXISTS order_type VARCHAR(20) DEFAULT 'dine-in',
      ADD COLUMN IF NOT EXISTS special_instructions TEXT DEFAULT ''
    `);
    console.log("✅ order_type and special_instructions columns added to orders");
  } catch (err) {
    console.error("❌ Kitchen fields migration failed:", err);
  }
}

migrateKitchenFields();
