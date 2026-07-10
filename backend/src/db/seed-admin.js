/**
 * Seed the admin account. Run once:
 *   node src/db/seed-admin.js
 *
 * Uses env vars:
 *   ADMIN_PASSWORD  - initial admin password (default: chinesehouse2024)
 *   ADMIN_MOBILE    - admin mobile number (default: 9999999999)
 */
require("dotenv").config();
const bcrypt = require("bcrypt");
const { Pool } = require("pg");

async function seed() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  const password = process.env.ADMIN_PASSWORD || "chinesehouse2024";
  const mobile = process.env.ADMIN_MOBILE || "9999999999";

  const hash = await bcrypt.hash(password, 12);

  try {
    // Upsert - insert or update if exists
    await pool.query(
      `INSERT INTO admin_account (id, password_hash, mobile_number)
       VALUES (1, $1, $2)
       ON CONFLICT (id) DO UPDATE SET password_hash = $1, mobile_number = $2, updated_at = NOW()`,
      [hash, mobile]
    );
    console.log("✅ Admin account seeded successfully");
    console.log(`   Mobile: ${mobile}`);
    console.log(`   Password: ${password}`);
  } catch (err) {
    console.error("❌ Seed failed:", err.message);
  } finally {
    await pool.end();
  }
}

seed();
