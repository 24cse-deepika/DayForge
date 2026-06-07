const { rawTasks } = require("./data/seedTasks");
const { rawBlockedIntervals } = require("./data/seedBlockedIntervals");

const { createTask } = require("./models/task");
const { createBlockedInterval } = require("./models/blockedInterval");
const {validateTask, validateBlockedInterval} = require("./scheduler/validator");
const {resolveDependencies} = require("./scheduler/dependencyResolver");
const {buildFreeSlots} = require("./scheduler/freeSlotBuilder");
const {runScheduler} = require("./scheduler/strategies/schedulingAlgo");

function main() {
    console.log("=================================");
    console.log("DAYFORGE SCHEDULER");
    console.log("=================================\n");

    try {
        // -----------------------------
        // Validate Tasks
        // -----------------------------
        console.log("Validating tasks...");

        for (const task of rawTasks) {
            const result = validateTask(task);

            if (!result.success) {
                console.error(
                    `Task Validation Failed: ${task.name}`
                );
                console.error(result.error);
                return;
            }
        }

        // -----------------------------
        // Validate Blocked Intervals
        // -----------------------------
        console.log("Validating blocked intervals...");

        for (const block of rawBlockedIntervals) {
            const result = validateBlockedInterval(block);

            if (!result.success) {
                console.error(
                    `Blocked Interval Validation Failed: ${block.label}`
                );
                console.error(result.error);
                return;
            }
        }

        // -----------------------------
        // Create Runtime Objects
        // -----------------------------
        const tasks = rawTasks.map(createTask);

        const blockedIntervals =
            rawBlockedIntervals.map(createBlockedInterval);

        // -----------------------------
        // Resolve Dependencies
        // -----------------------------
        console.log("Resolving dependencies...");

        const dependencyResult =
            resolveDependencies(tasks);

        if (!dependencyResult.success) {
            console.error(
                "Dependency Resolution Failed:"
            );
            console.error(dependencyResult.error);
            return;
        }

        const {
            readyQueue,
            adj
        } = dependencyResult;

        // -----------------------------
        // Build Free Slots
        // -----------------------------
        console.log("Generating free slots...");

        const schedulerStartTime = new Date();

        const {
            hardSlots,
            softSlots
        } = buildFreeSlots(
            blockedIntervals,
            schedulerStartTime
        );

        // -----------------------------
        // Run Scheduler
        // -----------------------------
        console.log("Running scheduler...\n");

        const result = runScheduler(
            tasks,
            readyQueue,
            adj,
            hardSlots,
            softSlots,
            schedulerStartTime
        );

        // -----------------------------
        // Output
        // -----------------------------
        console.log("=================================");
        console.log("SCHEDULING RESULT");
        console.log("=================================\n");

        console.log("=== SCHEDULED TASKS ===");
        console.dir(result.scheduledTasks, {
            depth: null
        });

        console.log("\n=== AT RISK TASKS ===");
        console.dir(result.atRiskTasks, {
            depth: null
        });

        console.log("\n=================================");
        console.log("DONE");
        console.log("=================================");
    }
    catch (error) {
        console.error(
            "\nFatal Scheduler Error:"
        );
        console.error(error);
    }
}

main();