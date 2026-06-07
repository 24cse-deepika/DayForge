const assert = require("assert");

const {
    scoreTask,
    findSlot,
    placeTask,
    feasibilityCheck,
    updateReadyQueue
} = require("../scheduler/strategies/schedulingAlgo");

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

console.log("\n=== Scheduling Algorithm Tests ===\n");

/* =====================================================
   scoreTask()
===================================================== */

runTest("Higher priority task gets higher score", () => {

    const currentTime = new Date("2026-06-01");

    const lowPriority = {
        priority: 1,
        earliestStart: new Date("2026-06-01"),
        deadline: new Date("2026-06-10")
    };

    const highPriority = {
        priority: 5,
        earliestStart: new Date("2026-06-01"),
        deadline: new Date("2026-06-10")
    };

    assert.ok(
        scoreTask(highPriority, currentTime) >
        scoreTask(lowPriority, currentTime)
    );
});

/* =====================================================
   findSlot()
===================================================== */

runTest("Splittable task can partially fit", () => {

    const task = {
        duration: 300,
        splittable: true,
        minSplitDuration: 60,
        earliestStart: new Date("2026-06-01T09:00:00")
    };

    const slots = [
        {
            start: new Date("2026-06-01T09:00:00"),
            end: new Date("2026-06-01T11:00:00")
        }
    ];

    const result = findSlot(
        task,
        new Date("2026-06-01T09:00:00"),
        slots
    );

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.isPartial, true);
});

runTest("Non-splittable task cannot partially fit", () => {

    const task = {
        duration: 300,
        splittable: false,
        earliestStart: new Date("2026-06-01T09:00:00")
    };

    const slots = [
        {
            start: new Date("2026-06-01T09:00:00"),
            end: new Date("2026-06-01T10:00:00")
        }
    ];

    const result = findSlot(
        task,
        new Date("2026-06-01T09:00:00"),
        slots
    );

    assert.strictEqual(result.success, false);
});

/* =====================================================
   placeTask()
===================================================== */

runTest("placeTask updates progress correctly", () => {

    const task = {
        id: "1",
        name: "Test Task",
        duration: 120,
        originalDuration: 120,
        task_status: "pending",
        progress: 0,
        scheduledSlots: []
    };

    placeTask(
        task,
        {
            fittedDuration: 60,
            start: new Date(),
            end: new Date(),
            isPartial: true
        },
        "test"
    );

    assert.strictEqual(task.progress, 50);
});

runTest("placeTask marks task completed", () => {

    const task = {
        id: "1",
        name: "Test Task",
        duration: 120,
        originalDuration: 120,
        task_status: "pending",
        progress: 0,
        scheduledSlots: []
    };

    placeTask(
        task,
        {
            fittedDuration: 120,
            start: new Date(),
            end: new Date(),
            isPartial: false
        },
        "test"
    );

    assert.strictEqual(task.duration, 0);
    assert.strictEqual(task.progress, 100);
});

/* =====================================================
   feasibilityCheck()
===================================================== */

runTest("Feasibility check succeeds when task fits", () => {

    const task = {
        duration: 60,
        deadline: new Date("2026-06-02"),
        earliestStart: new Date("2026-06-01"),
        splittable: false
    };

    const slots = [
        {
            start: new Date("2026-06-01T09:00:00"),
            end: new Date("2026-06-01T12:00:00")
        }
    ];

    const result = feasibilityCheck(
        task,
        new Date("2026-06-01"),
        slots,
        slots
    );

    assert.strictEqual(result.success, true);
});

runTest("Feasibility check fails when task cannot fit", () => {

    const task = {
        duration: 500,
        deadline: new Date("2026-06-01T12:00:00"),
        earliestStart: new Date("2026-06-01T09:00:00"),
        splittable: false
    };

    const slots = [
        {
            start: new Date("2026-06-01T09:00:00"),
            end: new Date("2026-06-01T10:00:00")
        }
    ];

    const result = feasibilityCheck(
        task,
        new Date("2026-06-01"),
        slots,
        slots
    );

    assert.strictEqual(result.success, false);
});

/* =====================================================
   updateReadyQueue()
===================================================== */

runTest("Completed dependency unlocks child task", () => {

    const completedTaskIds = new Set();

    const parent = {
        id: "A",
        dependencies: []
    };

    const child = {
        id: "B",
        dependencies: ["A"]
    };

    const readyQueue = [];

    updateReadyQueue(
        "A",
        [parent, child],
        { A: ["B"] },
        completedTaskIds,
        readyQueue
    );

    assert.strictEqual(
        readyQueue.length,
        1
    );

    assert.strictEqual(
        readyQueue[0].id,
        "B"
    );
});

/* =====================================================
   Final Results
===================================================== */

console.log("\n=== RESULTS ===");
console.log(`Passed: ${passed}`);
console.log(`Failed: ${failed}`);

if (failed === 0) {
    console.log("\n🎉 ALL SCHEDULING TESTS PASSED");
} else {
    console.log("\n⚠️ SOME TESTS FAILED");
}