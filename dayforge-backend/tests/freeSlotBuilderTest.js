const { test } = require('node:test');
const assert = require('node:assert/strict');
const { expandRecurringBlocks, buildFreeSlots } = require('../scheduler/freeSlotBuilder');
const { RECURRENCE, BLOCK_TYPES } = require('../utils/constants');

const START = new Date('2026-06-07T00:00:00'); // Sunday

function makeBlock({ label, start, end, recurrence, type, customDays = null }) {
    return { label, start: new Date(start), end: new Date(end), recurrence, type, customDays };
}

// ── expandRecurringBlocks ────────────────────────────────────────────────────

test('expandRecurringBlocks: NONE recurrence produces exactly 1 block', () => {
    const blocks = [makeBlock({ label: 'Meeting', start: '2026-06-07T10:00:00', end: '2026-06-07T11:00:00', recurrence: RECURRENCE.NONE, type: BLOCK_TYPES.BLOCKED })];
    const expanded = expandRecurringBlocks(blocks, START);
    assert.equal(expanded.length, 1);
});

test('expandRecurringBlocks: DAILY recurrence produces SCHEDULING_WINDOW_DAYS blocks', () => {
    const { SCHEDULING_WINDOW_DAYS } = require('../utils/constants');
    const blocks = [makeBlock({ label: 'Sleep', start: '2026-06-07T00:00:00', end: '2026-06-07T08:00:00', recurrence: RECURRENCE.DAILY, type: BLOCK_TYPES.BLOCKED })];
    const expanded = expandRecurringBlocks(blocks, START);
    assert.equal(expanded.length, SCHEDULING_WINDOW_DAYS);
});

test('expandRecurringBlocks: WEEKDAYS recurrence excludes weekends', () => {
    const blocks = [makeBlock({ label: 'College', start: '2026-06-07T09:00:00', end: '2026-06-07T13:00:00', recurrence: RECURRENCE.WEEKDAYS, type: BLOCK_TYPES.BLOCKED })];
    const expanded = expandRecurringBlocks(blocks, START);
    const days = expanded.map(b => b.start.toLocaleString('en-US', { weekday: 'long' }));
    assert.ok(!days.includes('Saturday'));
    assert.ok(!days.includes('Sunday'));
});

test('expandRecurringBlocks: WEEKENDS recurrence only includes Sat and Sun', () => {
    const blocks = [makeBlock({ label: 'Rest', start: '2026-06-07T10:00:00', end: '2026-06-07T12:00:00', recurrence: RECURRENCE.WEEKENDS, type: BLOCK_TYPES.BLOCKED })];
    const expanded = expandRecurringBlocks(blocks, START);
    const days = expanded.map(b => b.start.toLocaleString('en-US', { weekday: 'long' }));
    days.forEach(d => assert.ok(['Saturday', 'Sunday'].includes(d), `Unexpected day: ${d}`));
});

test('expandRecurringBlocks: result is sorted by start time', () => {
    const blocks = [
        makeBlock({ label: 'Late', start: '2026-06-07T18:00:00', end: '2026-06-07T19:00:00', recurrence: RECURRENCE.NONE, type: BLOCK_TYPES.BLOCKED }),
        makeBlock({ label: 'Early', start: '2026-06-07T09:00:00', end: '2026-06-07T10:00:00', recurrence: RECURRENCE.NONE, type: BLOCK_TYPES.BLOCKED })
    ];
    const expanded = expandRecurringBlocks(blocks, START);
    assert.ok(expanded[0].start <= expanded[1].start);
});

test('expandRecurringBlocks: CUSTOM recurrence only includes specified days', () => {
    const blocks = [makeBlock({ label: 'Class', start: '2026-06-07T10:00:00', end: '2026-06-07T11:00:00', recurrence: RECURRENCE.CUSTOM, type: BLOCK_TYPES.BLOCKED, customDays: ['Monday', 'Wednesday'] })];
    const expanded = expandRecurringBlocks(blocks, START);
    const days = expanded.map(b => b.start.toLocaleString('en-US', { weekday: 'long' }));
    days.forEach(d => assert.ok(['Monday', 'Wednesday'].includes(d), `Unexpected day: ${d}`));
});

// ── buildFreeSlots ────────────────────────────────────────────────────────────

test('buildFreeSlots: returns hardSlots and softSlots', () => {
    const blocks = [makeBlock({ label: 'Sleep', start: '2026-06-07T00:00:00', end: '2026-06-07T08:00:00', recurrence: RECURRENCE.NONE, type: BLOCK_TYPES.BLOCKED })];
    const result = buildFreeSlots(blocks, START);
    assert.ok(Array.isArray(result.hardSlots));
    assert.ok(Array.isArray(result.softSlots));
    assert.ok(result.hardSlots.length > 0);
    assert.ok(result.softSlots.length > 0);
});

test('buildFreeSlots: BREAK block excluded from hardSlots but included in softSlots window', () => {
    const napStart = new Date('2026-06-07T13:00:00');
    const blocks = [makeBlock({ label: 'Nap', start: '2026-06-07T13:00:00', end: '2026-06-07T14:00:00', recurrence: RECURRENCE.NONE, type: BLOCK_TYPES.BREAK })];
    const { hardSlots, softSlots } = buildFreeSlots(blocks, START);

    const hardCoversNap = hardSlots.some(s => s.start <= napStart && s.end > napStart);
    const softCoversNap = softSlots.some(s => s.start <= napStart && s.end > napStart);

    assert.equal(hardCoversNap, false, 'hardSlots should not cover nap window');
    assert.equal(softCoversNap, true,  'softSlots should cover nap window');
});

test('buildFreeSlots: no blocks produces one large free slot', () => {
    const { hardSlots } = buildFreeSlots([], START);
    assert.equal(hardSlots.length, 1);
});

test('buildFreeSlots: free slots do not overlap with blocked intervals', () => {
    const blocks = [makeBlock({ label: 'Block', start: '2026-06-07T10:00:00', end: '2026-06-07T12:00:00', recurrence: RECURRENCE.NONE, type: BLOCK_TYPES.BLOCKED })];
    const { hardSlots } = buildFreeSlots(blocks, START);
    const blockStart = new Date('2026-06-07T10:00:00');
    const blockEnd   = new Date('2026-06-07T12:00:00');
    hardSlots.forEach(slot => {
        const overlaps = slot.start < blockEnd && slot.end > blockStart;
        assert.equal(overlaps, false, `Slot ${slot.start}–${slot.end} overlaps with blocked interval`);
    });
});