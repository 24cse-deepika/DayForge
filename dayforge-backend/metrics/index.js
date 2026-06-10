const { minutesBetween } = require('../utils/timeUtils');

// computeMetrics: pure computation — no logging, no side effects
// call after runScheduler with its result + the slot data + fromTime
function computeMetrics({ scheduledTasks, atRiskTasks }, hardSlots, softSlots, fromTime) {
    const today = new Date(fromTime);
    today.setHours(0, 0, 0, 0);  // start of day, not current time
    const todayEnd = new Date(today);
    todayEnd.setHours(23, 59, 59, 999);

    // ── task counts ───────────────────────────────────────────────────────────
    const totalSubmitted = scheduledTasks.length + atRiskTasks.length;
    const totalScheduled = scheduledTasks.length;
    const totalAtRisk    = atRiskTasks.length;

    // ── workload: today ───────────────────────────────────────────────────────
    let minutesTodayTotal = 0;
    scheduledTasks.forEach(task => {
        task.scheduledSlots.forEach(slot => {
            if (slot.start >= today && slot.start <= todayEnd) {
                minutesTodayTotal += minutesBetween(slot.start, slot.end);
            }
        });
    });
    const hoursToday = Math.round((minutesTodayTotal / 60) * 10) / 10;

    // ── workload: full week ───────────────────────────────────────────────────
    let minutesWeekTotal = 0;
    scheduledTasks.forEach(task => {
        task.scheduledSlots.forEach(slot => {
            minutesWeekTotal += minutesBetween(slot.start, slot.end);
        });
    });
    const hoursThisWeek = Math.round((minutesWeekTotal / 60) * 10) / 10;

    // ── free time remaining today ─────────────────────────────────────────────
    const freeMinutesToday = hardSlots
        .filter(slot => slot.start >= today && slot.start <= todayEnd)
        .reduce((sum, slot) => {
            const slotEnd = slot.end > todayEnd ? todayEnd : slot.end;
            return sum + minutesBetween(slot.start, slotEnd);
        }, 0);
    const freeHoursToday = Math.round((freeMinutesToday / 60) * 10) / 10;

    // ── soft slot usage (break/rest time consumed) ────────────────────────────
    // a task used soft slots if it was placed in a window that doesn't exist in hardSlots
    const tasksUsingSoftSlots = scheduledTasks.filter(task =>
        task.scheduledSlots.some(slot => {
            const inHard = hardSlots.some(h => h.start <= slot.start && h.end >= slot.end);
            return !inHard;
        })
    ).map(t => ({ taskId: t.id, taskName: t.name }));

    // ── split tasks ───────────────────────────────────────────────────────────
    const splitTasks = scheduledTasks
        .filter(task => task.scheduledSlots.length > 1)
        .map(task => ({
            taskId:       task.id,
            taskName:     task.name,
            sessionCount: task.scheduledSlots.length
        }));

    // ── average urgency score ─────────────────────────────────────────────────
    // urgency = 1 - (timeRemaining / totalWindow), clamped 0–1
    // approximate from scheduledSlots: tasks with tighter deadlines score higher
    const avgUrgency = scheduledTasks.length === 0 ? 0 :
        Math.round(
            (scheduledTasks.reduce((sum, task) => {
                const totalWindow = task.deadline - task.earliestStart;
                const remaining   = Math.max(0, task.deadline - fromTime);
                const urgency     = totalWindow === 0 ? 1 : 1 - (remaining / totalWindow);
                return sum + Math.min(1, Math.max(0, urgency));
            }, 0) / scheduledTasks.length) * 100
        ) / 100;

    // ── deadline misses ───────────────────────────────────────────────────────
    // tasks where the last scheduled slot ends after their deadline
    const deadlineMisses = scheduledTasks
        .filter(task => {
            const lastSlot = task.scheduledSlots[task.scheduledSlots.length - 1];
            return lastSlot && lastSlot.end > task.deadline;
        })
        .map(task => ({
            taskId:   task.id,
            taskName: task.name,
            deadline: task.deadline,
            scheduledEnd: task.scheduledSlots[task.scheduledSlots.length - 1].end
        }));

    // ── tasks blocked by dependencies (in atRisk but not impossible) ──────────
    // currently all atRisk tasks are impossible — dependency blocking tracked separately
    // this will be more useful once DB tracks completion state
    const blockedByDependencies = atRiskTasks.filter(t =>
        t.reason && t.reason.toLowerCase().includes('depend')
    );

    return {
        summary: {
            totalSubmitted,
            totalScheduled,
            totalAtRisk,
            schedulingRate: `${Math.round((totalScheduled / totalSubmitted) * 100)}%`
        },
        workload: {
            hoursToday,
            hoursThisWeek,
            freeHoursToday
        },
        warnings: {
            deadlineMisses,
            tasksUsingSoftSlots,
            splitTasks,
            atRiskTasks: atRiskTasks.map(t => ({ taskId: t.taskId, taskName: t.taskName, reason: t.reason }))
        },
        health: {
            avgUrgencyScore: avgUrgency,
            blockedByDependencies
        }
    };
}

module.exports = { computeMetrics };