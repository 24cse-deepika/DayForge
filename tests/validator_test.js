const assert = require("assert");
const {
    validateTask,
    validateBlockedInterval
} = require("../scheduler/validator");

console.log("Running validator tests...");

// Valid Task
assert.strictEqual(
    validateTask({
        name: "DSA",
        durationMinutes: 120,
        deadline: new Date("2030-01-01"),
        priority: 4,
        splittable: false,
        dependencies: []
    }).success,
    true
);

// Invalid Priority
assert.strictEqual(
    validateTask({
        name: "DSA",
        durationMinutes: 120,
        deadline: new Date("2030-01-01"),
        priority: 10,
        splittable: false
    }).success,
    false
);

// Invalid Duration
assert.strictEqual(
    validateTask({
        name: "DSA",
        durationMinutes: -50,
        deadline: new Date("2030-01-01"),
        priority: 4,
        splittable: false
    }).success,
    false
);

console.log("Validator tests passed!");