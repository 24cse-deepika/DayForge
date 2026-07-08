// Controllers are the glue: they read/write here, then hand plain objects to the engine.
 
const pool = require('../db/pool');
const { TASK_STATUSES, URGENCY } = require('../utils/constants');
 
// DB columns are lowercase-folded (see db/schema.sql for why). We translate
// to/from camelCase here so the rest of the app never has to think about it.
function mapRowToTask(row) {
  if (!row) return null;
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    originalDuration: row.original_duration,
    duration: row.duration,
    deadline: row.deadline,
    priority: row.priority,
    taskStatus: row.task_status,
    urgency: row.urgency,
    splittable: row.splittable,
    minSplitDuration: row.minsplitduration,
    category: row.category,
    progress: row.progress,
    dependencies: row.dependencies,
    earliestStart: row.earliest_start,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    scheduledSlots: typeof row.scheduledslots === 'string'
      ? JSON.parse(row.scheduledslots)
      : (row.scheduledslots || []),
  };
}
 
async function getAllTasksForUser(userId) {
  const { rows } = await pool.query(
    `SELECT * FROM tasks WHERE user_id = $1 ORDER BY deadline ASC`,
    [userId]
  );
  return rows.map(mapRowToTask);
}
 
async function getTaskById(id, userId) {
  const { rows } = await pool.query(
    `SELECT * FROM tasks WHERE id = $1 AND user_id = $2`,
    [id, userId]
  );
  return mapRowToTask(rows[0]);
}
 
async function createTaskRecord(input) {
  const { rows } = await pool.query(
    `INSERT INTO tasks (
       user_id, name, original_duration, duration, deadline, priority,
       task_status, urgency, splittable, minSplitDuration, category,
       progress, dependencies, earliest_start
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
     RETURNING *`,
    [
      input.userId,
      input.name,
      input.durationMinutes,
      input.durationMinutes,
      input.deadline,
      input.priority ?? null,
      input.taskStatus || TASK_STATUSES.PENDING,
      input.urgency || URGENCY.NORMAL,
      input.splittable ?? false,
      input.minSplitDuration ?? 25,
      input.category ?? null,
      0,
      input.dependencies ?? [],
      input.earliestStart ?? null,
    ]
  );
  return mapRowToTask(rows[0]);
}
 
// Whitelist of columns that are safe to update, mapped from the camelCase
// key a caller passes in -> the real (lowercase-folded) DB column name.
// This whitelist is what makes the dynamic SET clause below safe: we never
// interpolate a caller-supplied string as a column name.
const UPDATABLE_FIELDS = {
  name: 'name',
  duration: 'duration',
  deadline: 'deadline',
  priority: 'priority',
  taskStatus: 'task_status',
  urgency: 'urgency',
  splittable: 'splittable',
  minSplitDuration: 'minsplitduration',
  category: 'category',
  progress: 'progress',
  dependencies: 'dependencies',
  earliestStart: 'earliest_start',
  scheduledSlots: 'scheduledslots',
};
 
async function updateTask(id, userId, fields) {
  const setClauses = [];
  const values = [];
  let i = 1;
 
  for (const [key, column] of Object.entries(UPDATABLE_FIELDS)) {
    if (fields[key] !== undefined) {
      setClauses.push(`${column} = $${i}`);
      values.push(key === 'scheduledSlots' ? JSON.stringify(fields[key]) : fields[key]);
      i++;
    }
  }
 
  if (setClauses.length === 0) {
    return getTaskById(id, userId);
  }
 
  setClauses.push(`updated_at = NOW()`);
 
  values.push(id, userId);
  const { rows } = await pool.query(
    `UPDATE tasks SET ${setClauses.join(', ')}
     WHERE id = $${i} AND user_id = $${i + 1}
     RETURNING *`,
    values
  );
  return mapRowToTask(rows[0]);
}
 
async function deleteTask(id, userId) {
  const { rows } = await pool.query(
    `DELETE FROM tasks WHERE id = $1 AND user_id = $2 RETURNING id`,
    [id, userId]
  );
  return rows[0] || null;
}
 
module.exports = {
  getAllTasksForUser,
  getTaskById,
  createTaskRecord,
  updateTask,
  deleteTask,
};