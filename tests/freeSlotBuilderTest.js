const assert = require("assert");

const {
    expandRecurringBlocks,
    buildFreeSlots
} = require("../scheduler/freeSlotBuilder");

const {
    RECURRENCE,
    BLOCK_TYPES
} = require("../utils/constants");

let passed = 0;
let failed = 0;

function runTest(name, fn) {
    try {
        fn();
        console.log(`✅ ${name}`);
        passed++;
    } catch (err) {
        console.log(`❌ ${name}`);
        console.log(`   ${err.message}`);
        failed++;
    }
}

console.log("\n=== Free Slot Builder Tests ===\n");

runTest("Expand daily recurring block", () => {
    const blocks = [
        {
            label: "Sleep",
            start: new Date("2026-06-01T00:00:00"),
            end: new Date("2026-06-01T08:00:00"),
            recurrence: RECURRENCE.DAILY,
            type: BLOCK_TYPES.BLOCKED
        }
    ];

    const expanded = expandRecurringBlocks(
        blocks,
        new Date("2026-06-01")
    );

    assert.ok(expanded.length > 1);
});

runTest("Expand weekday recurring block", () => {
    const blocks = [
        {
            label: "College",
            start: new Date("2026-06-01T09:00:00"),
            end: new Date("2026-06-01T13:00:00"),
            recurrence: RECURRENCE.WEEKDAYS,
            type: BLOCK_TYPES.BLOCKED
        }
    ];

    const expanded = expandRecurringBlocks(
        blocks,
        new Date("2026-06-01")
    );

    assert.ok(expanded.length > 0);
});

runTest("Generate free slots", () => {
    const blocks = [
        {
            label: "Sleep",
            start: new Date("2026-06-01T00:00:00"),
            end: new Date("2026-06-01T08:00:00"),
            recurrence: RECURRENCE.NONE,
            type: BLOCK_TYPES.BLOCKED
        }
    ];

    const result = buildFreeSlots(
        blocks,
        new Date("2026-06-01T00:00:00")
    );

    assert.ok(result.hardSlots.length > 0);
    assert.ok(result.softSlots.length > 0);
});

runTest("Soft slots ignore breaks", () => {
    const blocks = [
        {
            label: "Lunch",
            start: new Date("2026-06-01T13:00:00"),
            end: new Date("2026-06-01T14:00:00"),
            recurrence: RECURRENCE.NONE,
            type: BLOCK_TYPES.BREAK
        }
    ];

    const result = buildFreeSlots(
        blocks,
        new Date("2026-06-01T00:00:00")
    );

    assert.ok(
        result.softSlots.length >= result.hardSlots.length
    );
});

runTest("Expanded blocks are sorted", () => {
    const blocks = [
        {
            label: "Late",
            start: new Date("2026-06-01T18:00:00"),
            end: new Date("2026-06-01T19:00:00"),
            recurrence: RECURRENCE.NONE,
            type: BLOCK_TYPES.BLOCKED
        },
        {
            label: "Early",
            start: new Date("2026-06-01T09:00:00"),
            end: new Date("2026-06-01T10:00:00"),
            recurrence: RECURRENCE.NONE,
            type: BLOCK_TYPES.BLOCKED
        }
    ];

    const expanded = expandRecurringBlocks(
        blocks,
        new Date("2026-06-01")
    );

    assert.ok(
        expanded[0].start < expanded[1].start
    );
});

console.log("\n=== RESULTS ===");
console.log(`Passed: ${passed}`);
console.log(`Failed: ${failed}`);