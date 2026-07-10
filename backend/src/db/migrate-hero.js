require("dotenv").config();
const pool = require("./pool");

const SQL = `
CREATE TABLE IF NOT EXISTS hero_content (
  id INTEGER PRIMARY KEY DEFAULT 1,
  location_tag TEXT NOT NULL DEFAULT '🍜 Koregaon Park, Pune',
  title TEXT NOT NULL DEFAULT 'Authentic <span>Chinese Cuisine</span> in Koregaon Park',
  description TEXT NOT NULL DEFAULT 'Traditional flavors. Sizzling wok dishes. Fresh ingredients. Experience the finest culinary journey at Classic Chinese.',
  image_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  CONSTRAINT hero_content_single_row CHECK (id = 1)
);

INSERT INTO hero_content (id)
VALUES (1)
ON CONFLICT DO NOTHING;
`;

async function migrate() {
  try {
    await pool.query(SQL);
    console.log("✅ hero_content table created successfully");
  } catch (err) {
    console.error("❌ Migration failed:", err);
  } finally {
    await pool.end();
  }
}

migrate();