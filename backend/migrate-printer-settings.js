const pool = require("./src/db/pool");

async function run() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    
    // Add printer_width column to business_settings
    await client.query(`
      ALTER TABLE business_settings 
      ADD COLUMN IF NOT EXISTS printer_width VARCHAR(10) DEFAULT '58mm';
    `);

    await client.query("COMMIT");
    console.log("Migration successful: added printer_width to business_settings");
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Migration failed:", err);
  } finally {
    client.release();
    pool.end();
  }
}

run();
