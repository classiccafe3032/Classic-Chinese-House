const pool = require("./pool");

async function migrate() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    await client.query(`
      CREATE TABLE IF NOT EXISTS promotions (
        id SERIAL PRIMARY KEY,
        message TEXT NOT NULL,
        bg_color VARCHAR(30) DEFAULT '#f59e0b',
        text_color VARCHAR(30) DEFAULT '#ffffff',
        starts_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
        active BOOLEAN DEFAULT true NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
      );
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_promotions_active_expires
      ON promotions (active, expires_at DESC);
    `);

    await client.query("COMMIT");
    console.log("✅ Promotions table created");
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("❌ Migration failed:", err);
  } finally {
    client.release();
    process.exit(0);
  }
}

migrate();
