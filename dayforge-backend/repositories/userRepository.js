const pool = require('../db/pool');
 
// input.password should already be a bcrypt hash by the time it gets here -
// hashing is an auth concern, not a DB concern.
async function createLocalUser({ email, passwordHash }) {
  const { rows } = await pool.query(
    `INSERT INTO users (email, password_hash)
     VALUES ($1, $2)
     RETURNING id, email, google_id, auth_provider, created_at`,
    [email, passwordHash]
  );
  return rows[0];
}

async function createGoogleUser({ email, googleId }) {
  const { rows } = await pool.query(
    `INSERT INTO users (email, google_id, auth_provider)
     VALUES ($1, $2, 'google')
     RETURNING id, email, google_id, auth_provider, created_at`,
    [email, googleId]
  );
  return rows[0];
}

async function findUserByEmail(email) {
  const { rows } = await pool.query(
    `SELECT id, email, password_hash, google_id, auth_provider, created_at
     FROM users
     WHERE email = $1`,
    [email]
  );
  return rows[0] || null;
}
 
async function findUserByGoogleId(googleId) {
  const { rows } = await pool.query(
    `SELECT id, email, google_id, auth_provider, created_at
     FROM users
     WHERE google_id = $1`,
    [googleId]
  );
  return rows[0] || null;
} 

async function findUserById(id) {
  const { rows } = await pool.query(
    `SELECT id, email, google_id, auth_provider, created_at
     FROM users
     WHERE id = $1`,
    [id]
  );
  return rows[0] || null;
}
 
async function updateUserPassword(userId, newPasswordHash) {
  const { rows } = await pool.query(
    `UPDATE users
     SET password_hash = $1
     WHERE id = $2
     RETURNING id, email, google_id, auth_provider, created_at`,
    [newPasswordHash, userId]
  );
  return rows[0] || null;
}

async function deleteUserById(userId) {
  const { rows } = await pool.query(
    `DELETE FROM users
     WHERE id = $1
     RETURNING id, email, google_id, auth_provider, created_at`,
    [userId]
  );
  return rows[0] || null;
}

async function updateUserGoogleId(userId, newGoogleId) {
  const { rows } = await pool.query(
    `UPDATE users   
     SET google_id = $1
     WHERE id = $2
     RETURNING id, email, google_id, auth_provider, created_at`,
    [newGoogleId, userId]
  );
  return rows[0] || null;
}

module.exports = {
  createLocalUser,
  createGoogleUser,
  findUserByEmail,
  findUserByGoogleId,
  findUserById,
  updateUserPassword,
  deleteUserById,
  updateUserGoogleId
};