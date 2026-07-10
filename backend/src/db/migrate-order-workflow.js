require('dotenv').config({ path: __dirname + '/../../.env' });
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function migrate() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // Add the order_workflow column with a default of 'quick-complete'
    await client.query(`
      ALTER TABLE business_settings 
      ADD COLUMN IF NOT EXISTS order_workflow VARCHAR(50) DEFAULT 'quick-complete' NOT NULL;
    `);

    console.log("Migration successful: added order_workflow to business_settings.");
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error("Migration failed:", err);
  } finally {
    client.release();
    pool.end();
  }
}

migrate();
