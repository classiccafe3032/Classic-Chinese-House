require("dotenv").config({ path: __dirname + "/../../.env" });
const pool = require("./pool");

async function migrateStaffPermissions() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    console.log("Starting staff permissions migration...");

    // Check if column exists
    const checkRes = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name='staff' AND column_name='permissions'
    `);

    if (checkRes.rows.length === 0) {
      console.log("Adding permissions column to staff table...");
      await client.query(`ALTER TABLE staff ADD COLUMN permissions JSONB DEFAULT '{}'::jsonb;`);
      
      // Update existing staff based on role
      console.log("Setting default permissions for existing staff...");
      
      // Admin/Manager
      await client.query(`
        UPDATE staff SET permissions = '{
          "canClearTable": true,
          "canTransferTable": true,
          "canViewOrderStats": true,
          "tabs": {
            "orders": true,
            "tables": true,
            "sales": true,
            "analytics": true,
            "content": true,
            "management": true,
            "system": true,
            "staff": true
          },
          "orders": {
            "active": true,
            "pos": true,
            "history": true
          }
        }'::jsonb
        WHERE role = 'manager'
      `);

      // Waiter
      await client.query(`
        UPDATE staff SET permissions = '{
          "canClearTable": true,
          "canTransferTable": true,
          "canViewOrderStats": false,
          "tabs": {
            "orders": true,
            "tables": true,
            "sales": false,
            "analytics": false,
            "content": false,
            "management": false,
            "system": false,
            "staff": false
          },
          "orders": {
            "active": true,
            "pos": true,
            "history": true
          }
        }'::jsonb
        WHERE role = 'waiter'
      `);

      // Kitchen
      await client.query(`
        UPDATE staff SET permissions = '{
          "canClearTable": false,
          "canTransferTable": false,
          "canViewOrderStats": false,
          "tabs": {
            "orders": true,
            "tables": false,
            "sales": false,
            "analytics": false,
            "content": false,
            "management": false,
            "system": false,
            "staff": false
          },
          "orders": {
            "active": true,
            "pos": false,
            "history": true
          }
        }'::jsonb
        WHERE role = 'kitchen'
      `);
      
      console.log("Migration completed successfully.");
    } else {
      console.log("permissions column already exists.");
    }

    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK");
    console.error("Migration failed:", e);
    process.exit(1);
  } finally {
    client.release();
    process.exit(0);
  }
}

migrateStaffPermissions();
