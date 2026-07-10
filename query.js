const pool = require('./backend/src/db/pool');
async function run() {
  const res = await pool.query("SELECT column_name FROM information_schema.columns WHERE table_name='menu_categories'");
  console.log(res.rows.map(r => r.column_name));
  process.exit(0);
}
run();
