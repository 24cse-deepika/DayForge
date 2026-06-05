const { SCHEDULE_REASONS } = require('../utils/constants');

const REASON_MESSAGES = {
    [SCHEDULE_REASONS.EARLIEST_DEADLINE]: "Scheduled because it has the earliest deadline.",
    [SCHEDULE_REASONS.URGENT_DEADLINE]: "Scheduled urgently — deadline is critically close.",
    [SCHEDULE_REASONS.HIGHEST_PRIORITY]: "Scheduled due to highest priority.",
    [SCHEDULE_REASONS.DEPENDENCY_RESOLVED]: "Scheduled because its dependencies are now complete.",
    [SCHEDULE_REASONS.TASK_SPLIT]: "Split across multiple sessions to fit available time slots.",
    [SCHEDULE_REASONS.USING_SOFT_SLOT]: "Scheduled using break time due to deadline urgency."
};

function generateReasons(scheduledSlots, reasons, atRiskTasks) {
    const reasonLog = [];
    const riskLog = [];

    scheduledSlots.forEach(slot => {
        const reasonCode = reasons[slot.taskId];
        reasonLog.push({
            taskId: slot.taskId,
            taskName: slot.taskName,
            start: slot.start,
            end: slot.end,
            isPartial: slot.isPartial,
            reason: REASON_MESSAGES[reasonCode] || "Scheduled based on availability."
        });
    });

    atRiskTasks.forEach(task => {
        riskLog.push({
            taskId: task.taskId,
            taskName: task.taskName,
            warning: `⚠ ${task.taskName}: ${task.reason}`
        });
    });

    return { reasonLog, riskLog };
}

module.exports = { generateReasons };