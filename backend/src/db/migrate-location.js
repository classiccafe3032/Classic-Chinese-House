

require("dotenv").config();
const pool = require("./pool");

const SQL = `
CREATE TABLE IF NOT EXISTS location_content (
  id INTEGER PRIMARY KEY DEFAULT 1,
  address TEXT NOT NULL DEFAULT 'Koregaon Park, Pune, Maharashtra 411001',
  phone TEXT NOT NULL DEFAULT '+91 98765 43210',
  opening_hours TEXT NOT NULL DEFAULT 'Mon - Sun: 11:00 AM - 11:00 PM',
  instagram_handle TEXT NOT NULL DEFAULT '@thechinesehouse',
  instagram_url TEXT NOT NULL DEFAULT 'https://www.instagram.com/thechinesehouse',
  map_embed_url TEXT NOT NULL DEFAULT 'https://www.google.com/maps?q=18.53870,73.90027&z=17&output=embed',
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  CONSTRAINT location_content_single_row CHECK (id = 1)
);

INSERT INTO location_content (id)
VALUES (1)
ON CONFLICT DO NOTHING;
`;

async function migrate() {
  try {
    await pool.query(SQL);
    console.log("✅ location_content table created successfully");
  } catch (err) {
    console.error("❌ Migration failed:", err);
  } finally {
    await pool.end();
  }
}

migrate();