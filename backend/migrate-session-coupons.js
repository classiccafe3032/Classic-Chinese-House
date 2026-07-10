const pool = require("./src/db/pool");

async function migrate() {
  try {
    console.log("Starting table_sessions coupon migration...");

    await pool.query(`
      ALTER TABLE table_sessions 
      ADD COLUMN IF NOT EXISTS coupon_code VARCHAR(50);
    `);

    await pool.query(`
      ALTER TABLE table_sessions 
      ADD COLUMN IF NOT EXISTS discount_amount DECIMAL(10, 2) DEFAULT 0;
    `);

    console.log("Added coupon_code and discount_amount to table_sessions.");

    // Update schema.sql as well so future deployments have it
    const fs = require('fs');
    const path = require('path');
    const schemaPath = path.join(__dirname, 'src', 'db', 'schema.sql');
    if (fs.existsSync(schemaPath)) {
      let schema = fs.readFileSync(schemaPath, 'utf8');
      
      if (!schema.includes('coupon_code character varying(50)')) {
        schema = schema.replace(
          'customer_phone character varying(15) NOT NULL,',
          'customer_phone character varying(15) NOT NULL,\n    coupon_code character varying(50),\n    discount_amount numeric(10,2) DEFAULT 0,'
        );
        fs.writeFileSync(schemaPath, schema);
        console.log("Updated schema.sql");
      }
    }

    console.log("Migration complete!");
    process.exit(0);
  } catch (err) {
    console.error("Migration failed:", err);
    process.exit(1);
  }
}

migrate();
