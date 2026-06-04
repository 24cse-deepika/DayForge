function isInPast(date) {
    const now = new Date();
    return date < now;
}

function minutesBetween(start, end){
    const diff = end - start; // difference in milliseconds
    return Math.round(diff / 60000); // convert to minutes
}

function overlaps(slotA, slotB) {
    return slotA.start < slotB.end && slotA.end > slotB.start;  
}

function isValidDate(date) {
    const d = date instanceof Date ? date : new Date(date);
    return d instanceof Date && !isNaN(d);
}

function hoursUntilDeadline(deadline) {
    const now = new Date();
    const diff = deadline - now;
    return diff / (1000 * 60 * 60); // convert to hours
}

function minutesToMilliseconds(minutes) {
    return minutes * 60 * 1000;
}

// adds minutes to a date, returns new Date
function addMinutes(date, minutes) {
    return new Date(date.getTime() + minutesToMilliseconds(minutes));
}

// checks if a date falls within a slot
function isWithinSlot(date, slot) {
    return date >= slot.start && date <= slot.end;
}

function percentageTimeRemaining(earliestStart, deadline) {
    const now = new Date();
    if (now >= deadline) return 0;
    if (now <= earliestStart) return 100;
    const totalTime = deadline - earliestStart;
    const timeRemaining = deadline - now;
    return Math.round((timeRemaining / totalTime) * 100);
}

function copyTimeToDate(original, targetDate) {
    const newDate = new Date(targetDate);
    newDate.setHours(
        original.getHours(),
        original.getMinutes(),
        original.getSeconds(),
        original.getMilliseconds()
    );
    return newDate;
}

module.exports = {
    isInPast,
    minutesBetween,
    overlaps,
    isValidDate,
    minutesToMilliseconds,
    hoursUntilDeadline,
    addMinutes,
    isWithinSlot,
    percentageTimeRemaining,
    copyTimeToDate
};
    