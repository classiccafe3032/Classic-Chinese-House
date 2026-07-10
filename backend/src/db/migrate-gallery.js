require("dotenv").config();
const pool = require("./pool");

async function migrate() {
  const sql = `
    CREATE TABLE IF NOT EXISTS gallery_images (
      id SERIAL PRIMARY KEY,
      image_url TEXT NOT NULL,
      alt_text VARCHAR(200) DEFAULT '',
      display_order INTEGER DEFAULT 0 NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_gallery_display_order ON gallery_images (display_order);
  `;

  try {
    await pool.query(sql);
    console.log("✅ gallery_images table created");
  } catch (err) {
    console.error("Migration failed:", err);
  } finally {
    await pool.end();
  }
}

migrate();
