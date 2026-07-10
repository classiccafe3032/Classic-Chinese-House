require("dotenv").config();
const pool = require("./pool");

async function migrateLoyalty() {
  console.log("🔄 Starting loyalty program migration...");
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // 1. Add loyalty settings to business_settings
    console.log("📝 Updating business_settings table...");
    await client.query(`
      ALTER TABLE public.business_settings 
      ADD COLUMN IF NOT EXISTS loyalty_enabled boolean DEFAULT true,
      ADD COLUMN IF NOT EXISTS loyalty_points_per_100 integer DEFAULT 10,
      ADD COLUMN IF NOT EXISTS loyalty_discount_per_point numeric(5,2) DEFAULT 1.00;
    `);

    // 2. Add points tracking to orders
    console.log("📝 Updating orders table...");
    await client.query(`
      ALTER TABLE public.orders 
      ADD COLUMN IF NOT EXISTS points_earned integer DEFAULT 0,
      ADD COLUMN IF NOT EXISTS points_redeemed integer DEFAULT 0;
    `);

    // 3. Create customers table
    console.log("📝 Creating customers table...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.customers (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
        phone character varying(15) NOT NULL,
        name character varying(100) DEFAULT '',
        points_balance integer DEFAULT 0,
        total_spent numeric(10,2) DEFAULT 0,
        last_visit timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
        created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(business_id, phone)
      );
    `);

    await client.query("COMMIT");
    console.log("✅ Loyalty program migration completed successfully!");
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("❌ Error during loyalty program migration:", error);
    throw error;
  } finally {
    client.release();
  }
}

// Allow running directly
if (require.main === module) {
  migrateLoyalty()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

module.exports = migrateLoyalty;
