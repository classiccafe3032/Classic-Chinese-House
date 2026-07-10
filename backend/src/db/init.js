require("dotenv").config();
const { Pool } = require("pg");
const fs = require("fs");
const path = require("path");

const GST_SQL = `
CREATE TABLE IF NOT EXISTS business_settings (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  restaurant_name TEXT NOT NULL,
  gstin VARCHAR(20),
  address TEXT,
  phone VARCHAR(15),
  email TEXT,
  is_gst_enabled BOOLEAN DEFAULT true NOT NULL,
  cgst_rate NUMERIC(5,2) NOT NULL DEFAULT 2.5,
  sgst_rate NUMERIC(5,2) NOT NULL DEFAULT 2.5,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS subtotal NUMERIC(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cgst NUMERIC(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sgst NUMERIC(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS gst_total NUMERIC(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS gst_rate NUMERIC(5,4) NOT NULL DEFAULT 0.05;

ALTER TABLE business_settings
  ADD COLUMN IF NOT EXISTS cgst_rate NUMERIC(5,2) NOT NULL DEFAULT 2.5,
  ADD COLUMN IF NOT EXISTS sgst_rate NUMERIC(5,2) NOT NULL DEFAULT 2.5;

ALTER TABLE admin_account
  ADD COLUMN IF NOT EXISTS email TEXT;

ALTER TABLE menu_items
  ADD COLUMN IF NOT EXISTS diet_type VARCHAR(20) DEFAULT 'none';

INSERT INTO business_settings (id, restaurant_name, address, phone, email, is_gst_enabled, cgst_rate, sgst_rate)
SELECT 1,
       'The Chinese House',
       COALESCE((SELECT address FROM location_content WHERE id = 1), ''),
       COALESCE((SELECT phone FROM location_content WHERE id = 1), ''),
       '',
       true,
       2.5,
       2.5
WHERE NOT EXISTS (SELECT 1 FROM business_settings WHERE id = 1);
`;

async function init() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const schema = fs.readFileSync(path.join(__dirname, "schema.sql"), "utf8");
  try {
    await pool.query(schema);
    await pool.query(GST_SQL);
    await require("./migrate-loyalty")();
    console.log("✅ Database initialized successfully");
  } catch (err) {
    console.error("❌ Database init failed:", err.message);
  } finally {
    await pool.end();
  }
}

init();
