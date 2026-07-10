require("dotenv").config({ path: "../../.env" });
const pool = require("./pool");

async function runMigration() {
  try {
    console.log("Starting passkeys migration...");
    
    // Check if webauthn_user_id exists on admin_account
    const { rows } = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name='admin_account' AND column_name='webauthn_user_id';
    `);
    
    if (rows.length === 0) {
      await pool.query(`ALTER TABLE admin_account ADD COLUMN webauthn_user_id TEXT;`);
      console.log("Added webauthn_user_id to admin_account.");
      
      // Update existing rows with a random ID
      await pool.query(`UPDATE admin_account SET webauthn_user_id = encode(gen_random_bytes(32), 'hex') WHERE webauthn_user_id IS NULL;`);
      
      await pool.query(`ALTER TABLE admin_account ALTER COLUMN webauthn_user_id SET NOT NULL;`);
      console.log("Made webauthn_user_id NOT NULL.");
    }
    
    await pool.query(`
      CREATE TABLE IF NOT EXISTS admin_passkeys (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          credential_id TEXT UNIQUE NOT NULL,
          public_key BYTEA NOT NULL,
          webauthn_user_id TEXT NOT NULL,
          counter BIGINT NOT NULL DEFAULT 0,
          device_type VARCHAR(32) NOT NULL,
          backed_up BOOLEAN NOT NULL DEFAULT false,
          transports VARCHAR(255),
          admin_id INTEGER REFERENCES admin_account(id) ON DELETE CASCADE,
          business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log("Created admin_passkeys table successfully.");
  } catch (error) {
    console.error("Migration failed:", error);
  } finally {
    pool.end();
  }
}

runMigration();
