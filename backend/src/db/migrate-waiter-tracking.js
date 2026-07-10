const pool = require("./pool");

async function migrateWaiterTracking() {
  const client = await pool.connect();
  try {
    console.log("Running Waiter Tracking & QR Routing migration...");
    await client.query("BEGIN");

    // 1. Add qr_routing_mode to business_settings
    console.log("Adding qr_routing_mode to business_settings...");
    await client.query(`
      ALTER TABLE public.business_settings 
      ADD COLUMN IF NOT EXISTS qr_routing_mode VARCHAR(20) DEFAULT 'claim' NOT NULL;
    `);

    // 2. Add waiter_id to table_sessions
    console.log("Adding waiter_id to table_sessions...");
    await client.query(`
      ALTER TABLE public.table_sessions
      ADD COLUMN IF NOT EXISTS waiter_id UUID REFERENCES public.staff(id) ON DELETE SET NULL;
    `);

    // 3. Add waiter_id to orders
    console.log("Adding waiter_id to orders...");
    await client.query(`
      ALTER TABLE public.orders
      ADD COLUMN IF NOT EXISTS waiter_id UUID REFERENCES public.staff(id) ON DELETE SET NULL;
    `);

    await client.query("COMMIT");
    console.log("✅ Waiter Tracking & QR Routing migration completed successfully!");
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("❌ Migration failed:", error);
    process.exit(1);
  } finally {
    client.release();
  }
}

if (require.main === module) {
  migrateWaiterTracking()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}

module.exports = migrateWaiterTracking;
