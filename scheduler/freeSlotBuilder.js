const { SCHEDULING_WINDOW_DAYS, RECURRENCE, BLOCK_TYPES } = require("../utils/constants");
const { copyTimeToDate, addMinutes, minutesToMilliseconds } = require("../utils/timeUtils");

function expandRecurringBlocks(blockedIntervals, startDate) {
    const expandedBlocks = [];

    blockedIntervals.forEach(block => {
        const blockStart = new Date(block.start);
        const blockEnd = new Date(block.end);

        if (block.recurrence === RECURRENCE.NONE) {
            expandedBlocks.push({
                start: blockStart,
                end: blockEnd,
                label: block.label,
                type: block.type
            });
        } else {
            for (let i = 0; i < SCHEDULING_WINDOW_DAYS; i++) {
                const currentDate = new Date(startDate);
                currentDate.setDate(currentDate.getDate() + i);
                const dayName = currentDate.toLocaleString('en-US', { weekday: 'long' });

                let shouldAdd = false;
                if (block.recurrence === RECURRENCE.DAILY) {
                    shouldAdd = true;
                } else if (block.recurrence === RECURRENCE.WEEKDAYS) {
                    shouldAdd = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'].includes(dayName);
                } else if (block.recurrence === RECURRENCE.WEEKENDS) {
                    shouldAdd = ['Saturday', 'Sunday'].includes(dayName);
                } else if (block.recurrence === RECURRENCE.CUSTOM) {
                    shouldAdd = block.customDays && block.customDays.includes(dayName);
                }

                if (shouldAdd) {
                    expandedBlocks.push({
                        start: copyTimeToDate(blockStart, currentDate),
                        end: copyTimeToDate(blockEnd, currentDate),
                        label: block.label,
                        type: block.type
                    });
                }
            }
        }
    });

    expandedBlocks.sort((a, b) => a.start - b.start);
    return expandedBlocks;
}

// called by the main function to build free slots based on expanded blocked intervals
function buildFreeSlots(blockedIntervals, startDate) {
    const endDate = new Date(startDate.getTime() + SCHEDULING_WINDOW_DAYS * 24 * 60 * 60 * 1000);
    const expandedBlocks = expandRecurringBlocks(blockedIntervals, startDate);

    // hardSlots — removes BOTH blocked and break intervals (most restrictive)
    const hardSlots = extractFreeSlots(expandedBlocks, startDate, endDate);

    // softSlots — removes only BLOCKED intervals, break time becomes available for urgent tasks
    const onlyHardBlocks = expandedBlocks.filter(b => b.type === BLOCK_TYPES.BLOCKED);
    const softSlots = extractFreeSlots(onlyHardBlocks, startDate, endDate);

    return { hardSlots, softSlots };
}

// extracted as a helper to avoid code duplication
function extractFreeSlots(blocks, startDate, endDate) {
    const freeSlots = [];
    let currentTime = new Date(startDate);

    blocks.forEach(block => {
        if (currentTime < block.start) {
            freeSlots.push({
                start: new Date(currentTime),
                end: new Date(block.start)
            });
        }
        if (block.end > currentTime) {
            currentTime = new Date(block.end);
        }
    });

    if (currentTime < endDate) {
        freeSlots.push({
            start: new Date(currentTime),
            end: new Date(endDate)
        });
    }

    return freeSlots;
}

module.exports = {
    expandRecurringBlocks,
    buildFreeSlots
};