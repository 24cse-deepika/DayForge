const {RECURRENCE, BLOCK_TYPES} = require("../utils/constants");
const { generateUniqueId } = require('../utils/idGenerator');

function createBlockedInterval(input) {
    return {
        id: generateUniqueId(),
        label: input.label,
        start: new Date(input.start),
        end: new Date(input.end),
        recurrence: input.recurrence || RECURRENCE.NONE, // default to no recurrence
        customDays: input.customDays || null, // array of day names e.g. ["Monday", "Wednesday"] for weekly recurrence, or null for non-recurring
        type: input.type || BLOCK_TYPES.BLOCKED, // default to blocked
        created_at: new Date()
    }
}

module.exports = {
    createBlockedInterval
};