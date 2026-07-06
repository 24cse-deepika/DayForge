const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const pool = require('../db/pool');
const blockedIntervalRepository = require('../repositories/blockedIntervalRepository');
const userRepository = require('../repositories/userRepository');

// Run with: node --test tests/blockedIntervalRepositoryTest.js

let testUserId;

before(async () => {
  const email = `blocked-interval-repo-test-${Date.now()}@example.com`;
  const user = await userRepository.createUser({ email, passwordHash: 'placeholder' });
  testUserId = user.id;
});

after(async () => {
  await pool.query('DELETE FROM users WHERE id = $1', [testUserId]);
  await pool.end();
});

test('createBlockedIntervalRecord inserts a row and applies defaults', async () => {
  const bi = await blockedIntervalRepository.createBlockedIntervalRecord({
    userId: testUserId,
    label: 'Gym',
    start: new Date('2030-01-01T06:00:00Z'),
    end: new Date('2030-01-01T07:00:00Z'),
    recurrence: 'weekdays',
  });

  assert.equal(bi.label, 'Gym');
  assert.equal(bi.recurrence, 'weekdays');
  assert.equal(bi.type, 'blocked'); // default applied
  assert.equal(bi.customDays, null);
  assert.ok(bi.id);

  await blockedIntervalRepository.deleteBlockedInterval(bi.id, testUserId);
});

test('customDays array round-trips correctly for custom recurrence', async () => {
  const bi = await blockedIntervalRepository.createBlockedIntervalRecord({
    userId: testUserId,
    label: 'Custom study block',
    start: new Date('2030-01-01T18:00:00Z'),
    end: new Date('2030-01-01T20:00:00Z'),
    recurrence: 'custom',
    customDays: ['Monday', 'Wednesday', 'Friday'],
  });

  assert.deepEqual(bi.customDays, ['Monday', 'Wednesday', 'Friday']);

  await blockedIntervalRepository.deleteBlockedInterval(bi.id, testUserId);
});

test('getAllBlockedIntervalsForUser returns only that user\'s rows', async () => {
  const bi = await blockedIntervalRepository.createBlockedIntervalRecord({
    userId: testUserId, label: 'Lunch', start: new Date('2030-01-01T12:00:00Z'), end: new Date('2030-01-01T13:00:00Z'),
  });

  const all = await blockedIntervalRepository.getAllBlockedIntervalsForUser(testUserId);
  assert.ok(all.some(b => b.id === bi.id));

  await blockedIntervalRepository.deleteBlockedInterval(bi.id, testUserId);
});

test('getBlockedIntervalById returns null for a different user', async () => {
  const bi = await blockedIntervalRepository.createBlockedIntervalRecord({
    userId: testUserId, label: 'Private block', start: new Date('2030-01-01T08:00:00Z'), end: new Date('2030-01-01T09:00:00Z'),
  });

  const result = await blockedIntervalRepository.getBlockedIntervalById(bi.id, testUserId + 999999);
  assert.equal(result, null);

  await blockedIntervalRepository.deleteBlockedInterval(bi.id, testUserId);
});

test('updateBlockedInterval changes only the fields sent', async () => {
  const bi = await blockedIntervalRepository.createBlockedIntervalRecord({
    userId: testUserId, label: 'Gym', start: new Date('2030-01-01T06:00:00Z'), end: new Date('2030-01-01T07:00:00Z'),
  });

  const updated = await blockedIntervalRepository.updateBlockedInterval(bi.id, testUserId, {
    label: 'Gym + shower', type: 'break',
  });
  assert.equal(updated.label, 'Gym + shower');
  assert.equal(updated.type, 'break');
  // start/end untouched
  assert.equal(updated.start.toISOString(), new Date('2030-01-01T06:00:00Z').toISOString());

  await blockedIntervalRepository.deleteBlockedInterval(bi.id, testUserId);
});

test('deleteBlockedInterval removes the row; deleting again returns null', async () => {
  const bi = await blockedIntervalRepository.createBlockedIntervalRecord({
    userId: testUserId, label: 'Temp block', start: new Date('2030-01-01T06:00:00Z'), end: new Date('2030-01-01T07:00:00Z'),
  });

  const firstDelete = await blockedIntervalRepository.deleteBlockedInterval(bi.id, testUserId);
  assert.ok(firstDelete);

  const secondDelete = await blockedIntervalRepository.deleteBlockedInterval(bi.id, testUserId);
  assert.equal(secondDelete, null);
});