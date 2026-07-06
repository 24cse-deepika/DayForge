const { rawTasks }           = require('./dayforge-backend/data/seedTasks');
const { rawBlockedIntervals } = require('./dayforge-backend/data/seedBlockedIntervals');

const { createTask }           = require('./dayforge-backend/models/task');
const { createBlockedInterval } = require('./dayforge-backend/models/blockedInterval');

const { validateTask, validateBlockedInterval } = require('./dayforge-backend/scheduler/validator');
const { resolveDependencies }                   = require('./dayforge-backend/scheduler/dependencyResolver');
const { buildFreeSlots }                        = require('./dayforge-backend/scheduler/freeSlotBuilder');
const { runScheduler }                          = require('./dayforge-backend/scheduler/strategies/schedulingAlgo');
const { logScheduleResult, buildReasonLog }     = require('./dayforge-backend/scheduler/reasonLogger');
const { computeMetrics }                        = require('./dayforge-backend/metrics/index');

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function printStep(step, message) {
    console.log(`  [${step}] ${message}`);
}

function abort(context, error) {
    console.error(`\n  ✖ ${context}`);
    console.error(`    ${error.message || JSON.stringify(error)}`);
    console.error('\n  Scheduler aborted.\n');
    process.exit(1);
}

// ─────────────────────────────────────────────────────────────────────────────
// Pipeline
// ─────────────────────────────────────────────────────────────────────────────

function main() {
    console.log('\n╔══════════════════════════════════════╗');
    console.log('║         DAYFORGE SCHEDULER           ║');
    console.log('╚══════════════════════════════════════╝\n');

    // 1. Validate input
    printStep('1/5', 'Validating tasks...');
    for (const raw of rawTasks) {
        const { success, error } = validateTask(raw);
        if (!success) abort(`Task validation failed: "${raw.name}"`, error);
    }

    printStep('1/5', 'Validating blocked intervals...');
    for (const raw of rawBlockedIntervals) {
        const { success, error } = validateBlockedInterval(raw);
        if (!success) abort(`Blocked interval validation failed: "${raw.label}"`, error);
    }

    // 2. Build runtime objects
    printStep('2/5', 'Building runtime objects...');
    const tasks           = rawTasks.map(createTask);
    const blockedIntervals = rawBlockedIntervals.map(createBlockedInterval);

    // 3. Resolve dependencies
    printStep('3/5', 'Resolving task dependencies...');
    const depResult = resolveDependencies(tasks);
    if (!depResult.success) abort('Dependency resolution failed', depResult.error);
    const { readyQueue, adj } = depResult;

    // 4. Build free slots
    printStep('4/5', 'Generating free time slots...');
    const fromTime = new Date();
    const { hardSlots, softSlots } = buildFreeSlots(blockedIntervals, fromTime);

    // 5. Run scheduler
    printStep('5/5', 'Running scheduling algorithm...');
    const result = runScheduler(tasks, readyQueue, adj, hardSlots, softSlots, fromTime);

    // ── Output ────────────────────────────────────────────────────────────────

    // Human-readable schedule report (developer log)
    logScheduleResult(result);

    // Structured reason log (what the API will eventually serve)
    const reasonLog = buildReasonLog(result);

    // Metrics
    const metrics = computeMetrics(result, hardSlots, softSlots, fromTime);

    console.log('╔══════════════════════════════════════╗');
    console.log('║             METRICS                  ║');
    console.log('╚══════════════════════════════════════╝\n');

    console.log('  📊 Summary');
    console.log(`     Tasks submitted : ${metrics.summary.totalSubmitted}`);
    console.log(`     Tasks scheduled : ${metrics.summary.totalScheduled}`);
    console.log(`     Tasks at risk   : ${metrics.summary.totalAtRisk}`);
    console.log(`     Scheduling rate : ${metrics.summary.schedulingRate}\n`);

    console.log('  🕐 Workload');
    console.log(`     Work today      : ${metrics.workload.hoursToday}h`);
    console.log(`     Work this week  : ${metrics.workload.hoursThisWeek}h`);
    console.log(`     Free today      : ${metrics.workload.freeHoursToday}h\n`);

    console.log('  ⚠️  Warnings');
    if (metrics.warnings.deadlineMisses.length === 0) {
        console.log('     No deadline misses — all tasks fit within deadlines.');
    } else {
        metrics.warnings.deadlineMisses.forEach(t =>
            console.log(`     ❌ Deadline miss: ${t.taskName} (due ${t.deadline.toLocaleDateString()})`)
        );
    }

    if (metrics.warnings.tasksUsingSoftSlots.length > 0) {
        console.log('');
        metrics.warnings.tasksUsingSoftSlots.forEach(t =>
            console.log(`     😴 Using rest time: ${t.taskName}`)
        );
    }

    if (metrics.warnings.splitTasks.length > 0) {
        console.log('');
        metrics.warnings.splitTasks.forEach(t =>
            console.log(`     ✂️  Split task: ${t.taskName} (${t.sessionCount} sessions)`)
        );
    }

    console.log('');
    console.log('  💚 Health');
    console.log(`     Avg urgency score : ${metrics.health.avgUrgencyScore} / 1.0`);
    if (metrics.health.avgUrgencyScore > 0.7) {
        console.log('     ⚠️  High urgency — schedule is under significant pressure.');
    } else if (metrics.health.avgUrgencyScore > 0.4) {
        console.log('     🟡 Moderate urgency — keep an eye on upcoming deadlines.');
    } else {
        console.log('     🟢 Low urgency — schedule looks healthy.');
    }

    console.log('\n╔══════════════════════════════════════╗');
    console.log('║              DONE ✓                  ║');
    console.log('╚══════════════════════════════════════╝\n');
}

main();
