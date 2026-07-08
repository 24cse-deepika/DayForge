const { test } = require('node:test');
const assert = require('node:assert/strict');
const { scoreTask, findSlot, placeTask, feasibilityCheck, updateReadyQueue } = require('../scheduler/strategies/schedulingAlgo');
const { TASK_STATUSES, ERROR_CODES } = require('../utils/constants');

const NOW = new Date('2026-06-07T09:00:00');

function makeTask({ id = 'task-1', name = 'Test Task', duration, originalDuration, splittable = false, minSplitDuration = null, deadline, earliestStart = NOW, dependencies = [], priority = 3 }) {
    return { id, name, duration, originalDuration: originalDuration ?? duration, splittable, minSplitDuration, deadline: new Date(deadline), earliestStart: new Date(earliestStart), dependencies, priority, task_status: 'pending', progress: 0, scheduledSlots: [] };
}

function makeSlot(start, end) {
    return { start: new Date(start), end: new Date(end) };
}

// ── scoreTask ────────────────────────────────────────────────────────────────

test('scoreTask: higher priority wins when deadline is same', () => {
    const low  = makeTask({ duration: 60, deadline: '2026-06-10T00:00:00', priority: 1 });
    const high = makeTask({ duration: 60, deadline: '2026-06-10T00:00:00', priority: 5 });
    assert.ok(scoreTask(high, NOW) > scoreTask(low, NOW));
});

test('scoreTask: past deadline gives urgency of 1', () => {
    const task = makeTask({ duration: 60, deadline: '2026-06-06T00:00:00', priority: 5 });
    assert.equal(scoreTask(task, NOW), 1.0);
});

test('scoreTask: score is always between 0 and 1', () => {
    const cases = [
        makeTask({ duration: 60, deadline: '2026-06-14T00:00:00', priority: 1 }),
        makeTask({ duration: 60, deadline: '2026-06-06T00:00:00', priority: 5 }),
        makeTask({ duration: 60, deadline: '2026-06-08T00:00:00', priority: 3 }),
    ];
    cases.forEach(task => {
        const score = scoreTask(task, NOW);
        assert.ok(score >= 0 && score <= 1, `Score out of range: ${score}`);
    });
});

// ── findSlot ─────────────────────────────────────────────────────────────────

test('findSlot: non-splittable fits with break', () => {
    const task = makeTask({ duration: 60, splittable: false, deadline: '2026-06-10T00:00:00' });
    const result = findSlot(task, NOW, [makeSlot('2026-06-07T09:00:00', '2026-06-07T11:00:00')]);
    assert.equal(result.success, true);
    assert.equal(result.isPartial, false);
    assert.equal(result.fittedDuration, 60);
    assert.equal(result.breakGiven, true);
});

test('findSlot: non-splittable fits without break when slot too tight', () => {
    // 60 min task needs 75 with break — slot is only 70 min
    const task = makeTask({ duration: 60, splittable: false, deadline: '2026-06-10T00:00:00' });
    const result = findSlot(task, NOW, [makeSlot('2026-06-07T09:00:00', '2026-06-07T10:10:00')]);
    assert.equal(result.success, true);
    assert.equal(result.breakGiven, false);
    assert.equal(result.fittedDuration, 60);
});

test('findSlot: non-splittable returns failure when slot too small', () => {
    const task = makeTask({ duration: 120, splittable: false, deadline: '2026-06-10T00:00:00' });
    const result = findSlot(task, NOW, [makeSlot('2026-06-07T09:00:00', '2026-06-07T09:30:00')]);
    assert.equal(result.success, false);
});

test('findSlot: splittable uses max available time, not just minSplitDuration', () => {
    // 120 min task, minSplit 30, slot has 90 min — should fit more than 30
    const task = makeTask({ duration: 120, splittable: true, minSplitDuration: 30, deadline: '2026-06-10T00:00:00' });
    const result = findSlot(task, NOW, [makeSlot('2026-06-07T09:00:00', '2026-06-07T10:30:00')]);
    assert.equal(result.success, true);
    assert.equal(result.isPartial, true);
    assert.ok(result.fittedDuration > 30, `Expected more than minSplit, got ${result.fittedDuration}`);
});

test('findSlot: splittable fails when slot smaller than minSplitDuration', () => {
    const task = makeTask({ duration: 120, splittable: true, minSplitDuration: 60, deadline: '2026-06-10T00:00:00' });
    const result = findSlot(task, NOW, [makeSlot('2026-06-07T09:00:00', '2026-06-07T09:30:00')]);
    assert.equal(result.success, false);
});

test('findSlot: earliestStart trims effectiveStart', () => {
    const task = makeTask({ duration: 60, splittable: false, deadline: '2026-06-10T00:00:00', earliestStart: '2026-06-07T11:00:00' });
    const result = findSlot(task, NOW, [makeSlot('2026-06-07T09:00:00', '2026-06-07T13:00:00')]);
    assert.equal(result.success, true);
    assert.equal(result.start.getTime(), new Date('2026-06-07T11:00:00').getTime());
});

test('findSlot: returns failure when no slots provided', () => {
    const task = makeTask({ duration: 60, splittable: false, deadline: '2026-06-10T00:00:00' });
    assert.equal(findSlot(task, NOW, []).success, false);
});

// ── placeTask ────────────────────────────────────────────────────────────────

test('placeTask: duration decreases by fittedDuration only', () => {
    const task = makeTask({ duration: 120, deadline: '2026-06-10T00:00:00' });
    const slotInfo = { fittedDuration: 60, isPartial: true, start: new Date(NOW), end: new Date(NOW.getTime() + 75 * 60000), breakGiven: true };
    placeTask(task, slotInfo, 'test');
    assert.equal(task.duration, 60);
});

test('placeTask: progress calculated correctly', () => {
    const task = makeTask({ duration: 120, deadline: '2026-06-10T00:00:00' });
    const slotInfo = { fittedDuration: 60, isPartial: true, start: new Date(NOW), end: new Date(NOW.getTime() + 75 * 60000), breakGiven: true };
    placeTask(task, slotInfo, 'test');
    assert.equal(task.progress, 50);
});

test('placeTask: status stays SCHEDULED (not COMPLETED) when duration hits 0 — completion is user-driven, not engine-driven', () => {
    const task = makeTask({ duration: 60, deadline: '2026-06-10T00:00:00' });
    const slotInfo = { fittedDuration: 60, isPartial: false, start: new Date(NOW), end: new Date(NOW.getTime() + 75 * 60000), breakGiven: true };
    const result = placeTask(task, slotInfo, 'test');
    assert.equal(task.task_status, TASK_STATUSES.SCHEDULED);
    assert.equal(task.progress, 100);
    assert.equal(result.fullyAllocated, true);
});

test('placeTask: status is SCHEDULED when work remains', () => {
    const task = makeTask({ duration: 120, deadline: '2026-06-10T00:00:00' });
    const slotInfo = { fittedDuration: 60, isPartial: true, start: new Date(NOW), end: new Date(NOW.getTime() + 75 * 60000), breakGiven: true };
    placeTask(task, slotInfo, 'test');
    assert.equal(task.task_status, TASK_STATUSES.SCHEDULED);
});

test('placeTask: scheduledSlots entry has correct shape', () => {
    const task = makeTask({ duration: 60, deadline: '2026-06-10T00:00:00' });
    const slotInfo = { fittedDuration: 60, isPartial: false, start: new Date(NOW), end: new Date(NOW.getTime() + 75 * 60000), breakGiven: true };
    placeTask(task, slotInfo, 'earliest_deadline');
    const entry = task.scheduledSlots[0];
    assert.ok(entry.taskId);
    assert.ok(entry.taskName);
    assert.ok(entry.start);
    assert.ok(entry.end);
    assert.equal(typeof entry.isPartial, 'boolean');
    assert.equal(entry.reason, 'earliest_deadline');
});

// ── feasibilityCheck ─────────────────────────────────────────────────────────

test('feasibilityCheck: task fits in hardSlots', () => {
    const task = makeTask({ duration: 60, splittable: false, deadline: '2026-06-10T00:00:00' });
    const slots = [makeSlot('2026-06-07T09:00:00', '2026-06-07T12:00:00')];
    const result = feasibilityCheck(task, NOW, slots, slots);
    assert.equal(result.success, true);
    assert.equal(result.needsSoftSlots, false);
});

test('feasibilityCheck: task fits only in softSlots', () => {
    const task = makeTask({ duration: 60, splittable: false, deadline: '2026-06-10T00:00:00' });
    const hardSlots = [makeSlot('2026-06-07T09:00:00', '2026-06-07T09:20:00')]; // too small
    const softSlots = [makeSlot('2026-06-07T09:00:00', '2026-06-07T12:00:00')];
    const result = feasibilityCheck(task, NOW, hardSlots, softSlots);
    assert.equal(result.success, true);
    assert.equal(result.needsSoftSlots, true);
});

test('feasibilityCheck: impossible task returns correct error code', () => {
    const task = makeTask({ duration: 500, splittable: false, deadline: '2026-06-07T09:30:00' });
    const tinySlot = [makeSlot('2026-06-07T09:00:00', '2026-06-07T09:20:00')];
    const result = feasibilityCheck(task, NOW, tinySlot, tinySlot);
    assert.equal(result.success, false);
    assert.equal(result.error.code, ERROR_CODES.IMPOSSIBLE_TO_SCHEDULE);
});

// ── updateReadyQueue ─────────────────────────────────────────────────────────

test('updateReadyQueue: unlocks child when only dep completes', () => {
    const parent = { id: 'A', dependencies: [] };
    const child  = { id: 'B', dependencies: ['A'] };
    const readyQueue = [];
    updateReadyQueue('A', [parent, child], { A: ['B'] }, new Set(), readyQueue);
    assert.equal(readyQueue.length, 1);
    assert.equal(readyQueue[0].id, 'B');
});

test('updateReadyQueue: does not unlock child if other deps still pending', () => {
    const taskA = { id: 'A', dependencies: [] };
    const taskB = { id: 'B', dependencies: [] };
    const taskC = { id: 'C', dependencies: ['A', 'B'] };
    const readyQueue = [];
    updateReadyQueue('A', [taskA, taskB, taskC], { A: ['C'], B: ['C'] }, new Set(), readyQueue);
    assert.ok(!readyQueue.includes(taskC));
});

test('updateReadyQueue: unlocks child only after all deps complete', () => {
    const taskA = { id: 'A', dependencies: [] };
    const taskB = { id: 'B', dependencies: [] };
    const taskC = { id: 'C', dependencies: ['A', 'B'] };
    const completed = new Set();
    const readyQueue = [];
    updateReadyQueue('A', [taskA, taskB, taskC], { A: ['C'], B: ['C'] }, completed, readyQueue);
    assert.ok(!readyQueue.includes(taskC));
    updateReadyQueue('B', [taskA, taskB, taskC], { A: ['C'], B: ['C'] }, completed, readyQueue);
    assert.ok(readyQueue.includes(taskC));
});

test('updateReadyQueue: task with no dependents — queue unchanged', () => {
    const taskA = { id: 'A', dependencies: [] };
    const readyQueue = [];
    updateReadyQueue('A', [taskA], {}, new Set(), readyQueue);
    assert.equal(readyQueue.length, 0);
});