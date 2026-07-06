// Raw DB access for the `blocked_intervals` table. Same split as
// taskRepository.js: this file only knows Postgres, controllers are the
// glue between this and models/blockedInterval.js (the engine's pure
// in-memory shape used by POST /api/tasks/schedule).
 
const pool = require('../db/pool');
 
function mapRowToBlockedInterval(row) {
  if (!row) return null;
  return {
    id: row.id,
    userId: row.user_id,
    label: row.label,
    start: row.start_time,
    end: row.end_time,
    recurrence: row.recurrence,
    customDays: row.custom_days,
    type: row.type,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
 
async function getAllBlockedIntervalsForUser(userId) {
  const { rows } = await pool.query(
    `SELECT * FROM blocked_intervals WHERE user_id = $1 ORDER BY start_time ASC`,
    [userId]
  );
  return rows.map(mapRowToBlockedInterval);
}
 
async function getBlockedIntervalById(id, userId) {
  const { rows } = await pool.query(
    `SELECT * FROM blocked_intervals WHERE id = $1 AND user_id = $2`,
    [id, userId]
  );
  return mapRowToBlockedInterval(rows[0]);
}
 
async function createBlockedIntervalRecord(input) {
  const { rows } = await pool.query(
    `INSERT INTO blocked_intervals (
       user_id, label, start_time, end_time, recurrence, custom_days, type
     ) VALUES ($1,$2,$3,$4,$5,$6,$7)
     RETURNING *`,
    [
      input.userId,
      input.label,
      input.start,
      input.end,
      input.recurrence || 'none',
      input.customDays ?? null,
      input.type || 'blocked',
    ]
  );
  return mapRowToBlockedInterval(rows[0]);
}
 
// Same whitelist pattern as taskRepository.js's updateTask - only these
// keys can ever become part of the SET clause, so a caller-supplied key
// name can never be interpolated into the SQL itself.
const UPDATABLE_FIELDS = {
  label: 'label',
  start: 'start_time',
  end: 'end_time',
  recurrence: 'recurrence',
  customDays: 'custom_days',
  type: 'type',
};
 
async function updateBlockedInterval(id, userId, fields) {
  const setClauses = [];
  const values = [];
  let i = 1;
 
  for (const [key, column] of Object.entries(UPDATABLE_FIELDS)) {
    if (fields[key] !== undefined) {
      setClauses.push(`${column} = $${i}`);
      values.push(fields[key]);
      i++;
    }
  }
 
  if (setClauses.length === 0) {
    return getBlockedIntervalById(id, userId);
  }
 
  setClauses.push(`updated_at = NOW()`);
 
  values.push(id, userId);
  const { rows } = await pool.query(
    `UPDATE blocked_intervals SET ${setClauses.join(', ')}
     WHERE id = $${i} AND user_id = $${i + 1}
     RETURNING *`,
    values
  );
  return mapRowToBlockedInterval(rows[0]);
}
 
async function deleteBlockedInterval(id, userId) {
  const { rows } = await pool.query(
    `DELETE FROM blocked_intervals WHERE id = $1 AND user_id = $2 RETURNING id`,
    [id, userId]
  );
  return rows[0] || null;
}
 
module.exports = {
  getAllBlockedIntervalsForUser,
  getBlockedIntervalById,
  createBlockedIntervalRecord,
  updateBlockedInterval,
  deleteBlockedInterval,
};