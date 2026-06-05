const { PRIORITY, TASK_STATUSES, POMODORO, SCHEDULE_REASONS, ERROR_CODES, SLOT_TYPES } = require('../../utils/constants');
const { percentageTimeRemaining, addMinutes, minutesToMilliseconds, minutesBetween } = require('../../utils/timeUtils');

function scoreTask(task, currentTime) {
    let urgency = 1 - (percentageTimeRemaining(task.earliestStart, task.deadline, currentTime) / 100);
    let normalizedPriority = (task.priority - PRIORITY.MIN) / (PRIORITY.MAX - PRIORITY.MIN);
    return (urgency * 0.7) + (normalizedPriority * 0.3);
}

function findActualEndTime(task, fromTime, slots) {
    let remainingDuration = task.duration;
    let currentTime = new Date(fromTime);
    
    for (let slot of slots) {
        if (slot.end <= currentTime) continue;
        if (slot.type !== SLOT_TYPES.WORK) continue;
        
        const slotStart = slot.start < currentTime ? currentTime : slot.start;
        const slotDuration = minutesBetween(slotStart, slot.end);

        // skip slots too small for a splittable task's minimum chunk
        if (task.splittable && slotDuration < task.minSplitDuration) continue;
        
        if (slotDuration >= remainingDuration) {
            return addMinutes(slotStart, remainingDuration);
        } else {
            remainingDuration -= slotDuration;
            currentTime = new Date(slot.end);
        }
    }
    
    return null;
}

function getSlotForTask(task, hardSlots, softSlots, useSoft = false) {
    if (!task.splittable && task.duration > POMODORO.WORK_DURATION) {
        return softSlots;
    }
    if (useSoft) {
        return softSlots;
    }
    return hardSlots;
}

function feasibilityCheck(candidateTask, readyTasks, currentTime, hardSlots, softSlots) {
    let usesSoftSlots = !candidateTask.splittable && candidateTask.duration > POMODORO.WORK_DURATION;
    
    const slotsToUse = getSlotForTask(candidateTask, hardSlots, softSlots, usesSoftSlots);
    let candidateEndTime = findActualEndTime(candidateTask, currentTime, slotsToUse);

    if (!candidateEndTime && !usesSoftSlots) {
        candidateEndTime = findActualEndTime(candidateTask, currentTime, softSlots);
        if (candidateEndTime) usesSoftSlots = true;
    }

    if (!candidateEndTime) {
        return { 
            feasible: false, 
            error: { 
                code: ERROR_CODES.IMPOSSIBLE_TO_SCHEDULE, 
                message: `${candidateTask.name} cannot fit in any available slot.` 
            } 
        };
    }

    if (candidateEndTime > new Date(candidateTask.deadline)) {
        if (!usesSoftSlots) {
            const softEndTime = findActualEndTime(candidateTask, currentTime, softSlots);
            if (softEndTime && softEndTime <= new Date(candidateTask.deadline)) {
                candidateEndTime = softEndTime;
                usesSoftSlots = true;
            } else {
                return { 
                    feasible: false, 
                    error: { 
                        code: ERROR_CODES.IMPOSSIBLE_TO_SCHEDULE, 
                        message: `${candidateTask.name} cannot finish before its deadline even with soft slots.` 
                    } 
                };
            }
        } else {
            return { 
                feasible: false, 
                error: { 
                    code: ERROR_CODES.IMPOSSIBLE_TO_SCHEDULE, 
                    message: `${candidateTask.name} cannot finish before its deadline.` 
                } 
            };
        }
    }

    for (let task of readyTasks) {
        if (task.id === candidateTask.id) continue;

        const slotsForThisTask = getSlotForTask(task, hardSlots, softSlots);
        const taskEndTime = findActualEndTime(task, candidateEndTime, slotsForThisTask);
        
        if (!taskEndTime || taskEndTime > new Date(task.deadline)) {
            if (slotsForThisTask !== softSlots) {
                const softEndTime = findActualEndTime(task, candidateEndTime, softSlots);
                if (!softEndTime || softEndTime > new Date(task.deadline)) {
                    return { 
                        feasible: false, 
                        error: { 
                            code: ERROR_CODES.IMPOSSIBLE_TO_SCHEDULE, 
                            message: `Scheduling ${candidateTask.name} would cause ${task.name} to miss its deadline.` 
                        } 
                    };
                }
                usesSoftSlots = true;
            } else {
                return { 
                    feasible: false, 
                    error: { 
                        code: ERROR_CODES.IMPOSSIBLE_TO_SCHEDULE, 
                        message: `Scheduling ${candidateTask.name} would cause ${task.name} to miss its deadline.` 
                    } 
                };
            }
        }
    }

    return { 
        feasible: true, 
        usesSoftSlots,
        reason: usesSoftSlots ? SCHEDULE_REASONS.URGENT_DEADLINE : SCHEDULE_REASONS.EARLIEST_DEADLINE 
    };
}

// find and return the specific slot to place task in along with chunk size
// it returns the slot info
function findSlot(task, fromTime, slotsToUse) {
    const minChunk = task.splittable 
        ? (task.minSplitDuration || POMODORO.WORK_DURATION) 
        : task.duration;

    for (let slot of slotsToUse) {
        if (slot.end <= fromTime) continue;
        if (slot.type !== SLOT_TYPES.WORK) continue;

        const slotStart = slot.start < fromTime ? fromTime : slot.start;
        const slotDuration = minutesBetween(slotStart, slot.end);

        if (slotDuration >= minChunk) {
            const chunkSize = task.splittable 
                ? Math.min(task.duration, slotDuration)
                : task.duration;
            return { slot, slotStart, chunkSize };
        }
    }
    return null;
}

// place task to the slot and update everything
function placeTask(task, slotInfo, currentTime) {
    // updations:
    task.duration -= slotInfo.chunkSize;
    task.updated_at = new Date();
    task.scheduledSlots.push({
        start: slotInfo.slotStart,
        end: addMinutes(slotInfo.slotStart, slotInfo.chunkSize),
        isPartial: task.duration > 0
    });
    task.task_status = task.duration > 0 ? TASK_STATUSES.IN_PROGRESS : TASK_STATUSES.COMPLETED;
    task.progress = ((task.originalDuration - task.duration) / task.originalDuration) * 100;

    return {
        taskId: task.id,
        taskName: task.name,
        start: slotInfo.slotStart,
        end: addMinutes(slotInfo.slotStart, slotInfo.chunkSize),
        isPartial: task.duration > 0  // true if task still has remaining work
    }
}



module.exports = {
    scoreTask,
    findActualEndTime,
    getSlotForTask,
    findSlot,
    feasibilityCheck
};