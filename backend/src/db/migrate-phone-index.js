require("dotenv").config();
const pool = require("./pool");

async function migrate() {
  const client = await pool.connect();
  try {
    console.log("Creating index on orders.customer_phone...");
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_orders_customer_phone
      ON orders (customer_phone);
    `);

    // Composite index for the history query (phone + created_at DESC)
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_orders_phone_created
      ON orders (customer_phone, created_at DESC);
    `);

    console.log("✅ Phone indexes created successfully");
  } catch (err) {
    console.error("Migration failed:", err);
  } finally {
    client.release();
    process.exit(0);
  }
}

migrate();
