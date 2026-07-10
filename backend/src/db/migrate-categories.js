/**
 * Run this migration to create the menu_categories table.
 * Usage: node src/db/migrate-categories.js
 */
require("dotenv").config();
const pool = require("./pool");

const SQL = `
CREATE TABLE IF NOT EXISTS menu_categories (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  sort_order INTEGER DEFAULT 0 NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Seed default categories if table is empty
INSERT INTO menu_categories (name, sort_order)
SELECT name, sort_order FROM (VALUES
  ('Classic', 1),
  ('Chocolate', 2),
  ('Fruit & Cream', 3),
  ('Premium', 4),
  ('Beverages', 5)
) AS defaults(name, sort_order)
WHERE NOT EXISTS (SELECT 1 FROM menu_categories LIMIT 1);
`;

async function migrate() {
  try {
    await pool.query(SQL);
    console.log("✅ menu_categories table created successfully");
  } catch (err) {
    console.error("❌ Migration failed:", err);
  } finally {
    await pool.end();
  }
}

migrate();
