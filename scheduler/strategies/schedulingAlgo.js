const { PRIORITY, TASK_STATUSES, SCHEDULE_REASONS, ERROR_CODES, CRITICAL_THRESHOLD_HOURS, URGENCY_THRESHOLD_PERCENT } = require('../../utils/constants');
const { percentageTimeRemaining, addMinutes, minutesToMilliseconds, minutesBetween, getBreakDuration } = require('../../utils/timeUtils');

function scoreTask(task, currentTime) {
    let urgency = 1 - (percentageTimeRemaining(task.earliestStart, task.deadline, currentTime) / 100);
    let normalizedPriority = (task.priority - PRIORITY.MIN) / (PRIORITY.MAX - PRIORITY.MIN);
    return (urgency * 0.7) + (normalizedPriority * 0.3);
}

function findSlot(task, fromTime, slotsToUse) {
    for (let slot of slotsToUse) {
        const effectiveStart = new Date(Math.max(slot.start.getTime(), fromTime.getTime(), task.earliestStart.getTime()));
        const availableMinutes = minutesBetween(effectiveStart, slot.end);
        const breakDuration = getBreakDuration(task.duration);

        if (task.splittable) {
            const fittedWithBreak = Math.min(task.duration, availableMinutes - breakDuration);
            if (fittedWithBreak >= task.minSplitDuration) {
                return {
                    success: true,
                    start: effectiveStart,
                    end: new Date(effectiveStart.getTime() + minutesToMilliseconds(fittedWithBreak + breakDuration)),
                    isPartial: fittedWithBreak < task.duration,
                    fittedDuration: fittedWithBreak,
                    breakGiven: true
                };
            }
            const fittedNoBreak = Math.min(task.duration, availableMinutes);
            if (fittedNoBreak >= task.minSplitDuration) {
                return {
                    success: true,
                    start: effectiveStart,
                    end: new Date(effectiveStart.getTime() + minutesToMilliseconds(fittedNoBreak)),
                    isPartial: fittedNoBreak < task.duration,
                    fittedDuration: fittedNoBreak,
                    breakGiven: false
                };
            }
        } else {
            if (availableMinutes >= task.duration + breakDuration) {
                return {
                    success: true,
                    start: effectiveStart,
                    end: new Date(effectiveStart.getTime() + minutesToMilliseconds(task.duration + breakDuration)),
                    isPartial: false,
                    fittedDuration: task.duration,
                    breakGiven: true
                };
            } else if (availableMinutes >= task.duration) {
                return {
                    success: true,
                    start: effectiveStart,
                    end: new Date(effectiveStart.getTime() + minutesToMilliseconds(task.duration)),
                    isPartial: false,
                    fittedDuration: task.duration,
                    breakGiven: false
                };
            }
        }
    }

    return { success: false };
}

// place task to the slot and update everything
function placeTask(task, slotInfo, reason) {
   task.duration -= slotInfo.fittedDuration;
   task.task_status = task.duration === 0 ? TASK_STATUSES.COMPLETED : TASK_STATUSES.SCHEDULED;
   task.progress = Math.round(((task.originalDuration - task.duration) / task.originalDuration) * 100);
   task.updated_at = new Date(slotInfo.end);
    task.scheduledSlots.push({
        taskId: task.id,
        taskName: task.name,
        start: slotInfo.start,
        end: slotInfo.end,
        isPartial: slotInfo.isPartial,
        reason: reason
    });
   
    return { success: true, updatedTask: task };
}

function canFit(task, fromTime, slots) {
    let remainingDuration = task.duration;
    let currentTime = new Date(fromTime);
    const simulatedTask = { ...task, duration: remainingDuration };

    while (remainingDuration > 0) {
        simulatedTask.duration = remainingDuration;
        const slotInfo = findSlot(simulatedTask, currentTime, slots);
        if (!slotInfo.success) return false;
        if (slotInfo.start >= task.deadline) return false;
        remainingDuration -= slotInfo.fittedDuration;
        currentTime = new Date(slotInfo.end);
    }

    return currentTime <= task.deadline;
}

function feasibilityCheck(task, fromTime, hardSlots, softSlots) {
    if (canFit(task, fromTime, hardSlots)) {
        return { success: true, needsSoftSlots: false };
    }
    if (canFit(task, fromTime, softSlots)) {
        return { success: true, needsSoftSlots: true };
    }
    return { success: false, error: { code: ERROR_CODES.IMPOSSIBLE_TO_SCHEDULE, message: "Task cannot be scheduled within its deadline." } };
}

// after a task is completed, we need to update the ready queue by adding any dependent tasks that are now unblocked  
function updateReadyQueue(completedTaskId, tasks, adj, completedTaskIds, readyQueue) {
    completedTaskIds.add(completedTaskId);

    const dependents = adj[completedTaskId] || [];
    dependents.forEach(dependentId => {
        const dependentTask = tasks.find(t => t.id === dependentId);
        if (!dependentTask) return;

        const allDepsCompleted = dependentTask.dependencies.every(depId => completedTaskIds.has(depId));
        if (allDepsCompleted) {
            readyQueue.push(dependentTask);
        }
    });

    return readyQueue;
}

function runScheduler(tasks, readyQueue, adj, hardSlots, softSlots, fromTime) {
    const scheduledTasks = [];
    const completedTaskIds = new Set();
    const atRiskTasks = [];
    let currentTime = new Date(fromTime);
    let lastQueueSize = -1;

    while (readyQueue.length > 0) {
        // infinite loop guard — if queue size hasn't changed, no progress is being made
        if (readyQueue.length === lastQueueSize) break;
        lastQueueSize = readyQueue.length;

        // re-score and sort every iteration — urgency changes as currentTime advances
        readyQueue.sort((a, b) => scoreTask(b, currentTime) - scoreTask(a, currentTime));
        const taskToSchedule = readyQueue.shift();

        // feasibility check — filter out impossible tasks upfront
        const feasibility = feasibilityCheck(taskToSchedule, currentTime, hardSlots, softSlots);
        if (!feasibility.success) {
            atRiskTasks.push({
                taskId: taskToSchedule.id,
                taskName: taskToSchedule.name,
                reason: feasibility.error.message
            });
            continue;
        }

        // pick slots based on feasibility result
        const slotsToUse = feasibility.needsSoftSlots ? softSlots : hardSlots;
        const slotInfo = findSlot(taskToSchedule, currentTime, slotsToUse);

        // safety net — shouldn't happen if feasibilityCheck is correct
        if (!slotInfo.success) {
            atRiskTasks.push({
                taskId: taskToSchedule.id,
                taskName: taskToSchedule.name,
                reason: `Unexpected: no slot found despite passing feasibility check.`
            });
            continue;
        }

        // place the task
        placeTask(taskToSchedule, slotInfo, SCHEDULE_REASONS.EARLIEST_DEADLINE);
        currentTime = new Date(slotInfo.end);  // advance time

        if (taskToSchedule.task_status === TASK_STATUSES.COMPLETED) {
            // task fully done — unlock dependents
            scheduledTasks.push(taskToSchedule);
            updateReadyQueue(taskToSchedule.id, tasks, adj, completedTaskIds, readyQueue);
        } else {
            // task partially placed — push back for another chunk
            readyQueue.push(taskToSchedule);
            lastQueueSize = -1;  // reset guard — real progress was made
        }
    }

    return { success: true, scheduledTasks, atRiskTasks };
}

module.exports = {
    scoreTask,
    findSlot,
    placeTask,
    feasibilityCheck,
    updateReadyQueue,
    runScheduler
};