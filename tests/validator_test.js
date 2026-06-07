const { test } = require('node:test');
const assert = require('node:assert/strict');
const { validateTask, validateBlockedInterval } = require('../scheduler/validator');
const { RECURRENCE, BLOCK_TYPES } = require('../utils/constants');

// ── validateTask ──────────────────────────────────────────────────────────────

test('validateTask: valid task passes', () => {
    const result = validateTask({ name: 'DSA', durationMinutes: 120, deadline: new Date('2030-01-01'), priority: 4, splittable: false, dependencies: [] });
    assert.equal(result.success, true);
});

test('validateTask: missing name fails', () => {
    const result = validateTask({ durationMinutes: 60, deadline: new Date('2030-01-01'), priority: 3, splittable: false });
    assert.equal(result.success, false);
});

test('validateTask: priority above max fails', () => {
    const result = validateTask({ name: 'Task', durationMinutes: 60, deadline: new Date('2030-01-01'), priority: 10, splittable: false });
    assert.equal(result.success, false);
});

test('validateTask: priority below min fails', () => {
    const result = validateTask({ name: 'Task', durationMinutes: 60, deadline: new Date('2030-01-01'), priority: 0, splittable: false });
    assert.equal(result.success, false);
});

test('validateTask: negative duration fails', () => {
    const result = validateTask({ name: 'Task', durationMinutes: -50, deadline: new Date('2030-01-01'), priority: 3, splittable: false });
    assert.equal(result.success, false);
});

test('validateTask: zero duration fails', () => {
    const result = validateTask({ name: 'Task', durationMinutes: 0, deadline: new Date('2030-01-01'), priority: 3, splittable: false });
    assert.equal(result.success, false);
});

test('validateTask: splittable without minSplitDuration fails', () => {
    const result = validateTask({ name: 'Task', durationMinutes: 120, deadline: new Date('2030-01-01'), priority: 3, splittable: true });
    assert.equal(result.success, false);
});

test('validateTask: splittable with valid minSplitDuration passes', () => {
    const result = validateTask({ name: 'Task', durationMinutes: 120, deadline: new Date('2030-01-01'), priority: 3, splittable: true, minSplitDuration: 30 });
    assert.equal(result.success, true);
});

test('validateTask: missing deadline fails', () => {
    const result = validateTask({ name: 'Task', durationMinutes: 60, priority: 3, splittable: false });
    assert.equal(result.success, false);
});

// ── validateBlockedInterval ───────────────────────────────────────────────────

test('validateBlockedInterval: valid interval passes', () => {
    const result = validateBlockedInterval({
        label: 'Sleep',
        start: new Date('2026-06-07T00:00:00'),
        end: new Date('2026-06-07T08:00:00'),
        recurrence: RECURRENCE.DAILY,
        type: BLOCK_TYPES.BLOCKED
    });
    assert.equal(result.success, true);
});

test('validateBlockedInterval: end before start fails', () => {
    const result = validateBlockedInterval({
        label: 'Bad',
        start: new Date('2026-06-07T10:00:00'),
        end: new Date('2026-06-07T08:00:00'),
        recurrence: RECURRENCE.NONE,
        type: BLOCK_TYPES.BLOCKED
    });
    assert.equal(result.success, false);
});

test('validateBlockedInterval: missing label fails', () => {
    const result = validateBlockedInterval({
        start: new Date('2026-06-07T00:00:00'),
        end: new Date('2026-06-07T08:00:00'),
        recurrence: RECURRENCE.NONE,
        type: BLOCK_TYPES.BLOCKED
    });
    assert.equal(result.success, false);
});