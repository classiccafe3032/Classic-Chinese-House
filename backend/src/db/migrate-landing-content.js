require("dotenv").config();
const pool = require("./pool");

async function migrate() {
  const client = await pool.connect();
  try {
    console.log("Starting migration: Add landing_page_content to business_settings...");
    
    // Add landing_page_content JSONB column if it doesn't exist
    await client.query(`
      ALTER TABLE business_settings 
      ADD COLUMN IF NOT EXISTS landing_page_content JSONB DEFAULT '{}'::jsonb;
    `);

    console.log("Migration completed successfully.");
  } catch (err) {
    console.error("Migration failed:", err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();
