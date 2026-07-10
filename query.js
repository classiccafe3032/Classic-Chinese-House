const pool = require('./backend/src/db/pool');
async function run() {
  const res = await pool.query('SELECT features FROM businesses LIMIT 1');
  console.log(JSON.stringify(res.rows[0].features, null, 2));
  process.exit(0);
}
run();
