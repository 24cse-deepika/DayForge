const { test } = require('node:test');
const assert = require('node:assert/strict');
const { runScheduler } = require('../scheduler/strategies/schedulingAlgo');
const { TASK_STATUSES } = require('../utils/constants');

const FROM = new Date('2026-06-07T09:00:00');

function makeTask({ id, name = id, duration, splittable = false, minSplitDuration = null, deadline, earliestStart = FROM, dependencies = [], priority = 3 }) {
    return { id, name, duration, originalDuration: duration, splittable, minSplitDuration, deadline: new Date(deadline), earliestStart: new Date(earliestStart), dependencies, priority, task_status: 'pending', progress: 0, scheduledSlots: [], updated_at: new Date() };
}

function makeSlot(start, end) {
    return { start: new Date(start), end: new Date(end) };
}

const OPEN = [makeSlot('2026-06-07T09:00:00', '2026-06-14T23:59:00')];

// ── basic ─────────────────────────────────────────────────────────────────────

test('runScheduler: single task completes successfully', () => {
    const task = makeTask({ id: 'a', duration: 60, deadline: '2026-06-10T00:00:00' });
    const { success, scheduledTasks, atRiskTasks } = runScheduler([task], [task], {}, OPEN, OPEN, FROM);
    assert.equal(success, true);
    assert.equal(scheduledTasks.length, 1);
    assert.equal(atRiskTasks.length, 0);
    assert.equal(scheduledTasks[0].task_status, TASK_STATUSES.COMPLETED);
    assert.equal(scheduledTasks[0].progress, 100);
});

test('runScheduler: empty queue returns success with no tasks', () => {
    const { success, scheduledTasks, atRiskTasks } = runScheduler([], [], {}, OPEN, OPEN, FROM);
    assert.equal(success, true);
    assert.equal(scheduledTasks.length, 0);
    assert.equal(atRiskTasks.length, 0);
});

test('runScheduler: multiple tasks all scheduled', () => {
    const tasks = [
        makeTask({ id: 'a', duration: 60, deadline: '2026-06-10T00:00:00' }),
        makeTask({ id: 'b', duration: 60, deadline: '2026-06-11T00:00:00' }),
        makeTask({ id: 'c', duration: 60, deadline: '2026-06-12T00:00:00' })
    ];
    const { scheduledTasks, atRiskTasks } = runScheduler(tasks, [...tasks], {}, OPEN, OPEN, FROM);
    assert.equal(scheduledTasks.length, 3);
    assert.equal(atRiskTasks.length, 0);
});

// ── impossible tasks ──────────────────────────────────────────────────────────

test('runScheduler: impossible task goes to atRiskTasks, others still schedule', () => {
    const impossible = makeTask({ id: 'x', duration: 120, deadline: '2026-06-07T09:05:00' }); // 5 min window
    const normal     = makeTask({ id: 'a', duration: 60,  deadline: '2026-06-10T00:00:00' });
    const { scheduledTasks, atRiskTasks } = runScheduler([impossible, normal], [impossible, normal], {}, OPEN, OPEN, FROM);
    assert.equal(atRiskTasks.length, 1);
    assert.equal(atRiskTasks[0].taskId, 'x');
    assert.equal(scheduledTasks.length, 1);
    assert.equal(scheduledTasks[0].id, 'a');
});

// ── ordering ──────────────────────────────────────────────────────────────────

test('runScheduler: higher priority task scheduled before lower (same deadline)', () => {
    const low  = makeTask({ id: 'low',  duration: 60, deadline: '2026-06-10T00:00:00', priority: 1 });
    const high = makeTask({ id: 'high', duration: 60, deadline: '2026-06-10T00:00:00', priority: 5 });
    const { scheduledTasks } = runScheduler([low, high], [low, high], {}, OPEN, OPEN, FROM);
    assert.equal(scheduledTasks[0].id, 'high');
});

test('runScheduler: tasks do not overlap in time', () => {
    const tasks = [
        makeTask({ id: 'a', duration: 60, deadline: '2026-06-10T00:00:00' }),
        makeTask({ id: 'b', duration: 60, deadline: '2026-06-11T00:00:00' })
    ];
    const { scheduledTasks } = runScheduler(tasks, [...tasks], {}, OPEN, OPEN, FROM);
    const slotA = scheduledTasks.find(t => t.id === 'a').scheduledSlots[0];
    const slotB = scheduledTasks.find(t => t.id === 'b').scheduledSlots[0];
    const noOverlap = slotA.end <= slotB.start || slotB.end <= slotA.start;
    assert.ok(noOverlap, 'Tasks must not overlap');
});

// ── dependencies ──────────────────────────────────────────────────────────────

test('runScheduler: dependent task unlocked after parent completes', () => {
    const parent = makeTask({ id: 'a', duration: 60, deadline: '2026-06-10T00:00:00', dependencies: [] });
    const child  = makeTask({ id: 'b', duration: 60, deadline: '2026-06-10T00:00:00', dependencies: ['a'] });
    const { scheduledTasks, atRiskTasks } = runScheduler([parent, child], [parent], { a: ['b'] }, OPEN, OPEN, FROM);
    assert.equal(atRiskTasks.length, 0);
    assert.equal(scheduledTasks.length, 2);
    const slotA = scheduledTasks.find(t => t.id === 'a').scheduledSlots[0];
    const slotB = scheduledTasks.find(t => t.id === 'b').scheduledSlots[0];
    assert.ok(slotA.end <= slotB.start, 'Child must start after parent ends');
});

test('runScheduler: dependent task not scheduled if parent is at-risk', () => {
    // parent impossible → child never unlocked → child stays unscheduled
    const parent = makeTask({ id: 'a', duration: 999, deadline: '2026-06-07T09:01:00', dependencies: [] });
    const child  = makeTask({ id: 'b', duration: 60,  deadline: '2026-06-10T00:00:00', dependencies: ['a'] });
    const { scheduledTasks, atRiskTasks } = runScheduler([parent, child], [parent], { a: ['b'] }, OPEN, OPEN, FROM);
    assert.equal(atRiskTasks.length, 1);     // parent flagged
    assert.equal(scheduledTasks.length, 0);  // child never got queued
});

// ── splittable ────────────────────────────────────────────────────────────────

test('runScheduler: splittable task completes across multiple slots', () => {
    const hardSlots = [
        makeSlot('2026-06-07T09:00:00', '2026-06-07T10:20:00'), // 80 min
        makeSlot('2026-06-07T11:00:00', '2026-06-07T12:20:00')  // 80 min
    ];
    const task = makeTask({ id: 'a', duration: 120, splittable: true, minSplitDuration: 30, deadline: '2026-06-07T14:00:00' });
    const { scheduledTasks, atRiskTasks } = runScheduler([task], [task], {}, hardSlots, hardSlots, FROM);
    assert.equal(atRiskTasks.length, 0);
    assert.equal(scheduledTasks.length, 1);
    assert.equal(scheduledTasks[0].task_status, TASK_STATUSES.COMPLETED);
    assert.ok(scheduledTasks[0].scheduledSlots.length > 1, 'Should span multiple slots');
});

// ── soft slots ────────────────────────────────────────────────────────────────

test('runScheduler: uses softSlots when hardSlots insufficient', () => {
    const tinyHard = [makeSlot('2026-06-07T09:00:00', '2026-06-07T09:10:00')]; // 10 min — too small
    const softSlots = OPEN;
    const task = makeTask({ id: 'a', duration: 60, deadline: '2026-06-10T00:00:00' });
    const { scheduledTasks, atRiskTasks } = runScheduler([task], [task], {}, tinyHard, softSlots, FROM);
    assert.equal(atRiskTasks.length, 0);
    assert.equal(scheduledTasks.length, 1);
    assert.equal(scheduledTasks[0].task_status, TASK_STATUSES.COMPLETED);
});