const { PRIORITY, TASK_STATUSES, SCHEDULE_REASONS, ERROR_CODES, CRITICAL_THRESHOLD_HOURS, URGENCY_THRESHOLD_PERCENT, BREAK_RULES } = require('../../utils/constants');
const { percentageTimeRemaining, addMinutes, minutesToMilliseconds, minutesBetween, getBreakDuration } = require('../../utils/timeUtils');

function scoreTask(task, currentTime) {
    const earliestStart = task.earliestStart || currentTime;
    let urgency = 1 - (percentageTimeRemaining(earliestStart, task.deadline, currentTime) / 100);
    let normalizedPriority = (task.priority - PRIORITY.MIN) / (PRIORITY.MAX - PRIORITY.MIN);
    return (urgency * 0.7) + (normalizedPriority * 0.3);
}

function findSlot(task, fromTime, slotsToUse) {
    const earliestStart = task.earliestStart || fromTime;
    for (let slot of slotsToUse) {
        const effectiveStart = new Date(Math.max(slot.start.getTime(), fromTime.getTime(), earliestStart.getTime()));
        const availableMinutes = minutesBetween(effectiveStart, slot.end);

        if (task.splittable) {
            // A single sitting is capped at MEDIUM_BREAK_MAX minutes of continuous
            // work — beyond that, the task must be split into another session with
            // a real break in between, rather than one long uninterrupted block.
            const maxFit = Math.min(task.duration, availableMinutes, BREAK_RULES.MEDIUM_BREAK_MAX);
            const isLastChunk = maxFit >= task.duration;

            if (maxFit <= 0) continue;

            if (isLastChunk || maxFit >= task.minSplitDuration) {
                // Now compute break based on what's actually being placed, not full remaining duration
                const breakDuration = getBreakDuration(maxFit);
                const fittedWithBreak = availableMinutes - breakDuration;

                if (fittedWithBreak >= task.minSplitDuration) {
                    // Enough room for work + break
                    const actualFit = Math.min(maxFit, fittedWithBreak);
                    const workEnd = new Date(effectiveStart.getTime() + minutesToMilliseconds(actualFit));
                    return {
                        success: true,
                        start: effectiveStart,
                        end: new Date(workEnd.getTime() + minutesToMilliseconds(breakDuration)),
                        workEnd,
                        isPartial: actualFit < task.duration,
                        fittedDuration: actualFit,
                        breakGiven: true
                    };
                } else {
                    // Not enough room for work + break, place work only
                    const workEnd = new Date(effectiveStart.getTime() + minutesToMilliseconds(maxFit));
                    return {
                        success: true,
                        start: effectiveStart,
                        end: workEnd,
                        workEnd,
                        isPartial: maxFit < task.duration,
                        fittedDuration: maxFit,
                        breakGiven: false
                    };
                }
            }
        } else {
            const breakDuration = getBreakDuration(task.duration);

            if (availableMinutes >= task.duration + breakDuration) {
                const workEnd = new Date(effectiveStart.getTime() + minutesToMilliseconds(task.duration));
                return {
                    success: true,
                    start: effectiveStart,
                    end: new Date(workEnd.getTime() + minutesToMilliseconds(breakDuration)),
                    workEnd,
                    isPartial: false,
                    fittedDuration: task.duration,
                    breakGiven: true
                };
            } else if (availableMinutes >= task.duration) {
                const workEnd = new Date(effectiveStart.getTime() + minutesToMilliseconds(task.duration));
                return {
                    success: true,
                    start: effectiveStart,
                    end: workEnd,
                    workEnd,
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
   const fullyAllocated = task.duration === 0;
   // Getting a slot on the calendar isn't the same as the work being done —
   // "completed" should mean the user actually finished it, which this
   // engine has no way of knowing. So the persisted/user-facing status is
   // always SCHEDULED here; `fullyAllocated` (returned below) is the
   // separate internal signal runScheduler uses to know a task needs no
   // further placement passes.
   task.task_status = TASK_STATUSES.SCHEDULED;
   task.progress = Math.round(((task.originalDuration - task.duration) / task.originalDuration) * 100);
   task.updated_at = new Date(slotInfo.end);
    task.scheduledSlots.push({
        taskId: task.id,
        taskName: task.name,
        start: slotInfo.start,
        // Render only the work portion — slotInfo.end (used above for occupiedSlots)
        // still reserves the full work+break span so nothing else can be scheduled
        // during the break; workEnd falls back to end for any legacy caller that
        // doesn't supply it.
        end: slotInfo.workEnd || slotInfo.end,
        isPartial: slotInfo.isPartial,
        reason: reason
    });
   
    return { success: true, updatedTask: task, fullyAllocated };
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

function subtractOccupied(slots, occupiedSlots) {
    let available = slots.map(s => ({ start: new Date(s.start), end: new Date(s.end) }));

    for (const occupied of occupiedSlots) {
        const result = [];
        for (const slot of available) {
            if (occupied.end <= slot.start || occupied.start >= slot.end) {
                // no overlap, keep as-is
                result.push(slot);
            } else {
                // trim the slot around the occupied window
                if (slot.start < occupied.start) {
                    result.push({ start: slot.start, end: new Date(occupied.start) });
                }
                if (slot.end > occupied.end) {
                    result.push({ start: new Date(occupied.end), end: slot.end });
                }
            }
        }
        available = result;
    }

    return available;
}

function runScheduler(tasks, readyQueue, adj, hardSlots, softSlots, fromTime) {
    const scheduledTasks = [];
    const completedTaskIds = new Set();
    const atRiskTasks = [];
    const occupiedSlots = [];
    const currentTime = new Date(fromTime);
    let lastQueueSize = -1;

    while (readyQueue.length > 0) {
        if (readyQueue.length === lastQueueSize) break;
        lastQueueSize = readyQueue.length;

        readyQueue.sort((a, b) => scoreTask(b, currentTime) - scoreTask(a, currentTime));
        const taskToSchedule = readyQueue.shift();

        const availableHard = subtractOccupied(hardSlots, occupiedSlots);
        const availableSoft = subtractOccupied(softSlots, occupiedSlots);

        const feasibility = feasibilityCheck(taskToSchedule, currentTime, availableHard, availableSoft);
        if (!feasibility.success) {
            atRiskTasks.push({
                taskId: taskToSchedule.id,
                taskName: taskToSchedule.name,
                reason: feasibility.error.message
            });
            continue;
        }

        const slotsToUse = feasibility.needsSoftSlots ? availableSoft : availableHard;
        const slotInfo = findSlot(taskToSchedule, currentTime, slotsToUse);

        if (!slotInfo.success) {
            atRiskTasks.push({
                taskId: taskToSchedule.id,
                taskName: taskToSchedule.name,
                reason: `Unexpected: no slot found despite passing feasibility check.`
            });
            continue;
        }

        occupiedSlots.push({ start: slotInfo.start, end: slotInfo.end });
        occupiedSlots.sort((a, b) => a.start - b.start);

        const placement = placeTask(taskToSchedule, slotInfo, SCHEDULE_REASONS.EARLIEST_DEADLINE);
        lastQueueSize = -1;

        if (placement.fullyAllocated) {
            scheduledTasks.push(taskToSchedule);
            updateReadyQueue(taskToSchedule.id, tasks, adj, completedTaskIds, readyQueue);
        } else {
            readyQueue.push(taskToSchedule);
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