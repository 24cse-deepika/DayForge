const { generateUniqueId } = require('../utils/idGenerator');
const { TASK_STATUSES, URGENCY } = require('../utils/constants');

function createTask(input) {
    return {
        id: generateUniqueId(),
        name: input.name,
        originalDuration: input.durationMinutes,  // never changes
        duration: input.durationMinutes,  // decreases as work is done [in case of splits or progress tracking]
        deadline: new Date(input.deadline),
        priority: input.priority,
        task_status : TASK_STATUSES.PENDING, // default status when created
        urgency: URGENCY.NORMAL, // default urgency, can be updated later
        splittable: input.splittable ?? false,
        minSplitDuration: input.minSplitDuration || 25, // default to 25 minutes if not provided, according to Pomodoro technique
        category: input.category || null,
        progress : 0, // percentage of completion, starts at 0
        created_at: new Date(),
        updated_at: new Date(),
        dependencies: input.dependencies || [], // array of task IDs this task depends on
        scheduledSlots: [],
        earliestStart: input.earliestStart ? new Date(input.earliestStart) : new Date() // default to now if not provided,
    }
}

module.exports = {
    createTask,
};
