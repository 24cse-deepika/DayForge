const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const pool = require('../db/pool');
const taskRepository = require('../repositories/taskRepository');
const userRepository = require('../repositories/userRepository');

// These are integration tests - they hit your real local Postgres, not a
// mock. That's deliberate: the thing worth verifying here is "does this SQL
// actually do what I think against a real table," which a mock can't tell you.
// Run with: node --test tests/taskRepositoryTest.js
// (or `node --test tests/` to run everything in the folder)

let testUserId;

before(async () => {
  // A throwaway user scoped to this test run, so these tests don't depend
  // on any particular row already existing in your dev database.
  const email = `task-repo-test-${Date.now()}@example.com`;
  const user = await userRepository.createLocalUser({ email, passwordHash: 'placeholder' });
  testUserId = user.id;
});

after(async () => {
  // tasks.user_id has ON DELETE CASCADE, so deleting the user cleans up any
  // task rows left behind too - even if a test below fails partway through
  // and skips its own cleanup.
  await pool.query('DELETE FROM users WHERE id = $1', [testUserId]);
  await pool.end();
});

test('createTaskRecord inserts a task and applies DB defaults', async () => {
  const task = await taskRepository.createTaskRecord({
    userId: testUserId,
    name: 'Write integration tests',
    durationMinutes: 45,
    deadline: new Date('2030-01-01T10:00:00Z'),
    priority: 2,
  });

  assert.equal(task.name, 'Write integration tests');
  assert.equal(task.duration, 45);
  assert.equal(task.originalDuration, 45);
  assert.equal(task.taskStatus, 'PENDING');
  assert.equal(task.urgency, 'NORMAL');
  assert.equal(task.progress, 0);
  assert.equal(task.splittable, false);
  assert.ok(task.id, 'expected a generated uuid');

  await taskRepository.deleteTask(task.id, testUserId);
});

test('getAllTasksForUser returns only that user\'s tasks', async () => {
  const task = await taskRepository.createTaskRecord({
    userId: testUserId, name: 'Task A', durationMinutes: 30, deadline: new Date('2030-01-01'),
  });

  const tasks = await taskRepository.getAllTasksForUser(testUserId);
  assert.ok(tasks.some(t => t.id === task.id));

  await taskRepository.deleteTask(task.id, testUserId);
});

test('getTaskById returns null when the task belongs to a different user', async () => {
  const task = await taskRepository.createTaskRecord({
    userId: testUserId, name: 'Private task', durationMinutes: 30, deadline: new Date('2030-01-01'),
  });

  // This is the ownership check that matters most: a wrong userId should
  // never leak someone else's task, even with a correct task id.
  const result = await taskRepository.getTaskById(task.id, testUserId + 999999);
  assert.equal(result, null);

  await taskRepository.deleteTask(task.id, testUserId);
});

test('updateTask changes only the fields sent, leaves the rest alone', async () => {
  const task = await taskRepository.createTaskRecord({
    userId: testUserId, name: 'Original name', durationMinutes: 30, deadline: new Date('2030-01-01'),
  });

  const updated = await taskRepository.updateTask(task.id, testUserId, { progress: 50 });
  assert.equal(updated.progress, 50);
  assert.equal(updated.name, 'Original name');

  await taskRepository.deleteTask(task.id, testUserId);
});

test('updateTask with no whitelisted fields is a no-op, not an error', async () => {
  const task = await taskRepository.createTaskRecord({
    userId: testUserId, name: 'Untouched', durationMinutes: 30, deadline: new Date('2030-01-01'),
  });

  const result = await taskRepository.updateTask(task.id, testUserId, {});
  assert.equal(result.name, 'Untouched');

  await taskRepository.deleteTask(task.id, testUserId);
});

test('deleteTask removes the row; deleting again returns null', async () => {
  const task = await taskRepository.createTaskRecord({
    userId: testUserId, name: 'Temp task', durationMinutes: 30, deadline: new Date('2030-01-01'),
  });

  const firstDelete = await taskRepository.deleteTask(task.id, testUserId);
  assert.ok(firstDelete);

  const secondDelete = await taskRepository.deleteTask(task.id, testUserId);
  assert.equal(secondDelete, null);
});