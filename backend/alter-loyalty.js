const pool = require('./src/db/pool');

async function run() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    console.log("Altering points columns to numeric(10,2)...");
    
    await client.query("ALTER TABLE orders ALTER COLUMN points_earned TYPE numeric(10,2) USING points_earned::numeric(10,2)");
    await client.query("ALTER TABLE orders ALTER COLUMN points_redeemed TYPE numeric(10,2) USING points_redeemed::numeric(10,2)");
    await client.query("ALTER TABLE customers ALTER COLUMN points_balance TYPE numeric(10,2) USING points_balance::numeric(10,2)");
    
    await client.query("COMMIT");
    console.log("Schema updated to support fractional points.");
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(err);
  } finally {
    client.release();
    process.exit(0);
  }
}

run();
