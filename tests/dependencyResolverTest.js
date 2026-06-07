const assert = require("assert");
const {
    resolveDependencies
} = require("../scheduler/dependencyResolver");

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

console.log("\n=== Dependency Resolver Tests ===\n");

runTest("Valid dependency chain", () => {
    const tasks = [
        {
            id: "A",
            dependencies: []
        },
        {
            id: "B",
            dependencies: ["A"]
        },
        {
            id: "C",
            dependencies: ["B"]
        }
    ];

    const result = resolveDependencies(tasks);

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.readyQueue.length, 1);
    assert.strictEqual(result.readyQueue[0].id, "A");
});

runTest("Detect missing dependency", () => {
    const tasks = [
        {
            id: "A",
            dependencies: ["DOES_NOT_EXIST"]
        }
    ];

    const result = resolveDependencies(tasks);

    assert.strictEqual(result.success, false);
});

runTest("Detect simple cycle", () => {
    const tasks = [
        {
            id: "A",
            dependencies: ["B"]
        },
        {
            id: "B",
            dependencies: ["A"]
        }
    ];

    const result = resolveDependencies(tasks);

    assert.strictEqual(result.success, false);
});

runTest("Detect 3-node cycle", () => {
    const tasks = [
        {
            id: "A",
            dependencies: ["C"]
        },
        {
            id: "B",
            dependencies: ["A"]
        },
        {
            id: "C",
            dependencies: ["B"]
        }
    ];

    const result = resolveDependencies(tasks);

    assert.strictEqual(result.success, false);
});

runTest("Multiple root tasks", () => {
    const tasks = [
        {
            id: "A",
            dependencies: []
        },
        {
            id: "B",
            dependencies: []
        },
        {
            id: "C",
            dependencies: ["A"]
        }
    ];

    const result = resolveDependencies(tasks);

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.readyQueue.length, 2);
});

console.log("\n=== RESULTS ===");
console.log(`Passed: ${passed}`);
console.log(`Failed: ${failed}`);