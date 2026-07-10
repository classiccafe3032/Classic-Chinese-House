const fs = require("fs");
const pool = require("./pool");

async function migrate() {
  const sql = fs.readFileSync(__dirname + "/migrate-tenant-requests.js", "utf8");
  // Extract only the SQL part
  const sqlContent = `
    CREATE TABLE IF NOT EXISTS tenant_requests (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      restaurant_name VARCHAR(200) NOT NULL,
      owner_name VARCHAR(200) NOT NULL,
      email VARCHAR(255) NOT NULL UNIQUE,
      phone VARCHAR(20) NOT NULL,
      city VARCHAR(100),
      message TEXT,
      status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'approved', 'rejected')),
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_tenant_requests_status ON tenant_requests(status);
    CREATE INDEX IF NOT EXISTS idx_tenant_requests_created ON tenant_requests(created_at DESC);
  `;
  try {
    await pool.query(sqlContent);
    console.log("✅ tenant_requests table created");
  } catch (err) {
    console.error("❌ Migration failed:", err.message);
  } finally {
    pool.end();
  }
}

migrate();
