const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { Pool } = require("pg");
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function run() {
  const dir = path.join(__dirname, 'src/db');
  const files = fs.readdirSync(dir).filter(f => f.startsWith('migrate-') && f.endsWith('.js'));
  
  for (const file of files) {
    console.log(`Running ${file}...`);
    try {
      execSync(`node ${path.join(dir, file)}`, { stdio: 'inherit' });
    } catch (e) {
      console.error(`Error running ${file}`);
    }
  }

  // Also add `theme` column manually since it seems to be missing from the migration files
  try {
    console.log("Adding 'theme' column to businesses...");
    await pool.query("ALTER TABLE businesses ADD COLUMN IF NOT EXISTS theme VARCHAR(50) DEFAULT 'gourmet-royal'");
    console.log("✅ 'theme' column added");
  } catch (e) {
    console.error("Failed to add 'theme' column:", e);
  } finally {
    await pool.end();
  }
}

run();
