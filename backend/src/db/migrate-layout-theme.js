const pool = require("./pool");

async function migrateLayoutTheme() {
  try {
    await pool.query(`
      ALTER TABLE businesses ADD COLUMN IF NOT EXISTS layout_theme VARCHAR(50) DEFAULT 'classic';
    `);
    console.log("✅ layout_theme column added to businesses table");
  } catch (err) {
    console.error("Migration failed:", err);
  } finally {
    pool.end();
  }
}

migrateLayoutTheme();
