/**
 * Run this migration to create the menu_items table.
 * Usage: node src/db/migrate-menu.js
 */
require("dotenv").config();
const pool = require("./pool");

const SQL = `
CREATE TABLE IF NOT EXISTS menu_items (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  slug VARCHAR(120) NOT NULL,
  description TEXT NOT NULL,
  price NUMERIC(10,2) NOT NULL,
  price_label VARCHAR(20) NOT NULL,
  category_id INTEGER NOT NULL REFERENCES menu_categories(id) ON DELETE RESTRICT,
  image_url TEXT,
  available BOOLEAN DEFAULT true NOT NULL,
  sort_order INTEGER DEFAULT 0 NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_menu_items_category_id ON menu_items(category_id);
CREATE INDEX IF NOT EXISTS idx_menu_items_available ON menu_items(available);
CREATE INDEX IF NOT EXISTS idx_menu_items_sort ON menu_items(sort_order);
`;

async function migrate() {
  try {
    await pool.query(SQL);
    console.log("✅ menu_items table created successfully");
  } catch (err) {
    console.error("❌ Migration failed:", err);
  } finally {
    await pool.end();
  }
}

migrate();
