const { SCHEDULE_REASONS } = require('../utils/constants');

const REASON_MESSAGES = {
    [SCHEDULE_REASONS.EARLIEST_DEADLINE]: 'Scheduled first — has the earliest deadline.',
    [SCHEDULE_REASONS.URGENT_DEADLINE]:   'Scheduled urgently — deadline is critically close.',
    [SCHEDULE_REASONS.HIGHEST_PRIORITY]:  'Scheduled due to highest priority among ready tasks.',
    [SCHEDULE_REASONS.DEPENDENCY_RESOLVED]: 'Scheduled because all its dependencies are now complete.',
    [SCHEDULE_REASONS.TASK_SPLIT]:        'Split across multiple sessions to fit available time.',
    [SCHEDULE_REASONS.USING_SOFT_SLOT]:   'Used break/rest time — deadline urgency required it.'
};

// logScheduleResult: developer-facing console log of the full scheduling decision
// call this after runScheduler — never inside it
function logScheduleResult({ scheduledTasks, atRiskTasks }) {
    console.log('\n==============================');
    console.log('  DAYFORGE — SCHEDULE REPORT');
    console.log('==============================\n');

    // ── scheduled tasks ────────────────────────────────────────────────────
    console.log(`✅ SCHEDULED TASKS (${scheduledTasks.length})\n`);

    scheduledTasks.forEach(task => {
        const splitCount = task.scheduledSlots.length;
        const wasSplit   = splitCount > 1;

        console.log(`  📌 ${task.name}`);
        console.log(`     Priority : ${task.priority} | Progress: ${task.progress}%`);
        console.log(`     Status   : ${task.task_status}`);
        console.log(`     Sessions : ${splitCount}${wasSplit ? ' (split across multiple slots)' : ''}`);

        task.scheduledSlots.forEach((slot, i) => {
            const start  = slot.start.toLocaleString();
            const end    = slot.end.toLocaleString();
            const reason = REASON_MESSAGES[slot.reason] || slot.reason;
            console.log(`     [${i + 1}] ${start} → ${end}`);
            console.log(`         Reason: ${reason}`);
            if (slot.isPartial) console.log(`         (partial session)`);
        });

        console.log('');
    });

    // ── at risk tasks ──────────────────────────────────────────────────────
    if (atRiskTasks.length === 0) {
        console.log('🎉 NO AT-RISK TASKS — all tasks scheduled successfully.\n');
    } else {
        console.log(`⚠️  AT-RISK TASKS (${atRiskTasks.length})\n`);
        atRiskTasks.forEach(task => {
            console.log(`  ❌ ${task.taskName}`);
            console.log(`     Reason: ${task.reason}\n`);
        });
    }

    console.log('==============================\n');
}

// buildReasonLog: returns structured data for the frontend/API
// same info as logScheduleResult but as a plain object, not console output
function buildReasonLog({ scheduledTasks, atRiskTasks }) {
    const scheduled = scheduledTasks.map(task => ({
        taskId:   task.id,
        taskName: task.name,
        priority: task.priority,
        progress: task.progress,
        status:   task.task_status,
        wasSplit: task.scheduledSlots.length > 1,
        slots: task.scheduledSlots.map(slot => ({
            start:     slot.start,
            end:       slot.end,
            isPartial: slot.isPartial,
            reason:    REASON_MESSAGES[slot.reason] || slot.reason
        }))
    }));

    const atRisk = atRiskTasks.map(task => ({
        taskId:   task.taskId,
        taskName: task.taskName,
        reason:   task.reason
    }));

    return { scheduled, atRisk };
}

module.exports = { logScheduleResult, buildReasonLog };