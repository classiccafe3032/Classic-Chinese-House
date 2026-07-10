const pool = require('./src/db/pool');

async function run() {
  const client = await pool.connect();
  try {
    const res = await client.query("SELECT * FROM customers WHERE phone = '7083738373'");
    console.log("Customer:", res.rows[0]);

    const res2 = await client.query("SELECT id, status, total, points_earned, points_redeemed, table_session_id FROM orders WHERE customer_phone = '7083738373' ORDER BY created_at DESC LIMIT 5");
    console.log("Orders:", res2.rows);

  } catch (err) {
    console.error(err);
  } finally {
    client.release();
    process.exit(0);
  }
}
run();
