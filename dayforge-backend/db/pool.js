// Single shared pg connection pool for the whole app.
// Every repository file should require THIS module, not create its own pool -
// pg.Pool already manages a set of reusable connections internally, so
// creating multiple pools just wastes connections for no benefit.
 
const { Pool } = require('pg');
 
const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
});
 
// Fires once when a new physical connection is opened - useful to confirm
// on server startup that the credentials/host are actually correct.
pool.on('connect', () => {
  console.log('[db] new client connected to Postgres');
});
 
// Fires on background errors from idle clients (e.g. DB restarted).
// Without this handler, an idle-client error would crash the whole process.
pool.on('error', (err) => {
  console.error('[db] unexpected error on idle client', err);
});
 
module.exports = pool;