// Run with: node db/testConnection.js  (from anywhere - path below is fixed)
// Quick sanity check that .env has the right credentials and Postgres is
// reachable, without needing to start the whole Express server.
 
const path = require('path');
// Resolve .env relative to THIS file's location, not the current working
// directory. Without this, running `node testConnection.js` from inside
// db/ (instead of the dayforge-backend/ root) silently loads 0 variables,
// since dotenv's default config() looks for .env in process.cwd().
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const pool = require('./pool');
 
async function main() {
  try {
    const { rows } = await pool.query('SELECT NOW() AS now, current_database() AS db');
    console.log('✅ Connected to Postgres successfully');
    console.log(`   Database: ${rows[0].db}`);
    console.log(`   Server time: ${rows[0].now}`);
 
    const { rows: tables } = await pool.query(
      `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name`
    );
    console.log(`   Tables found: ${tables.map(t => t.table_name).join(', ') || '(none)'}`);
  } catch (err) {
    console.error('❌ Could not connect to Postgres');
    console.error(err.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}
 
main();