const { ERROR_CODES, RECURRENCE} = require('../utils/constants');
const { isInPast, isValidDate } = require('../utils/timeUtils');


function validateTask(input) {
    if (!input.name || typeof input.name !== 'string' || input.name.trim() === '') {
        return { success: false, error: { code: ERROR_CODES.INVALID_INPUT, message: "Task name is required and must be a non-empty string." } };
    }
    if (!input.durationMinutes || typeof input.durationMinutes !== 'number' || input.durationMinutes <= 0) {
        return { success: false, error: { code: ERROR_CODES.INVALID_INPUT, message: "Duration is required and must be a positive number." } };
    }
    if (!input.deadline || !isValidDate(new Date(input.deadline)) || isInPast(new Date(input.deadline))) {
        return { success: false, error: { code: ERROR_CODES.INVALID_INPUT, message: "A valid future deadline is required." } };
    }
    if (input.earliestStart && !isValidDate(new Date(input.earliestStart))) {
        return { success: false, error: { code: ERROR_CODES.INVALID_INPUT, message: "If provided, earliestStart must be a valid date." } };
    }
    if (!input.priority || typeof input.priority !== 'number' || input.priority < 1 || input.priority > 5) {
        return { success: false, error: { code: ERROR_CODES.INVALID_INPUT, message: "Priority is required and must be a number between 1 and 5." } };
    }
    if (typeof input.splittable !== 'boolean') {
        return { success: false, error: { code: ERROR_CODES.INVALID_INPUT, message: "Splittable must be a boolean." } };
    }
    if (input.splittable && (!input.minSplitDuration || typeof input.minSplitDuration !== 'number' || input.minSplitDuration <= 0)) {
        return { success: false, error: { code: ERROR_CODES.INVALID_INPUT, message: "If task is splittable, minSplitDuration must be a positive number." } };
    }
    if (input.splittable && input.minSplitDuration >= input.durationMinutes) {
        return { success: false, error: { code: ERROR_CODES.INVALID_INPUT, message: "minSplitDuration must be less than total task duration." } };
    }
    if (input.dependencies && !Array.isArray(input.dependencies)) {
        return { success: false, error: { code: ERROR_CODES.INVALID_INPUT, message: "Dependencies must be an array of task IDs." } };
    }
    return { success: true };
}

function validateBlockedInterval(input) {
    if (!input.label || typeof input.label !== 'string' || input.label.trim() === '') {
        return { success: false, error: { code: ERROR_CODES.INVALID_INPUT, message: "Label is required and must be a non-empty string." } };
    }
    if (!input.start || !isValidDate(new Date(input.start))) {
        return { success: false, error: { code: ERROR_CODES.INVALID_INPUT, message: "Start time is required and must be a valid date." } };
    }
    if (!input.end || !isValidDate(new Date(input.end))) {
        return { success: false, error: { code: ERROR_CODES.INVALID_INPUT, message: "End time is required and must be a valid date." } };
    }
    if (new Date(input.start) >= new Date(input.end)) {
        return { success: false, error: { code: ERROR_CODES.INVALID_INPUT, message: "Start time must be before end time." } };
    }
    if (input.recurrence && !Object.values(RECURRENCE).includes(input.recurrence)) {
        return { success: false, error: { code: ERROR_CODES.INVALID_INPUT, message: "Recurrence must be one of: none, daily, weekdays, weekends, custom." } };
    }
    if (input.recurrence === RECURRENCE.CUSTOM && (!input.customDays || !Array.isArray(input.customDays) || input.customDays.length === 0)) {
        return { success: false, error: { code: ERROR_CODES.INVALID_INPUT, message: "For custom recurrence, customDays must be a non-empty array of day names." } };
    }
    
    return { success: true };
}

module.exports = {
    validateTask,
    validateBlockedInterval
};