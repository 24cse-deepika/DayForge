// Raw DB access for the `users` table. Kept deliberately thin - no password hashing, no session/JWT logic here. That belongs in
// authController.js once we build auth. This file only knows how to talk to Postgres.
 
const pool = require('../db/pool');
 
// input.password should already be a bcrypt hash by the time it gets here -
// hashing is an auth concern, not a DB concern.
async function createUser({ email, passwordHash }) {
  const { rows } = await pool.query(
    `INSERT INTO users (email, password_hash)
     VALUES ($1, $2)
     RETURNING id, email, created_at`,
    [email, passwordHash]
  );
  return rows[0];
}
 
async function findUserByEmail(email) {
  const { rows } = await pool.query(
    `SELECT id, email, password_hash, created_at
     FROM users
     WHERE email = $1`,
    [email]
  );
  return rows[0] || null;
}
 
async function findUserById(id) {
  const { rows } = await pool.query(
    `SELECT id, email, created_at
     FROM users
     WHERE id = $1`,
    [id]
  );
  return rows[0] || null;
}
 
module.exports = {
  createUser,
  findUserByEmail,
  findUserById,
};