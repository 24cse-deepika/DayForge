const { createBlockedInterval } = require('../models/blockedInterval');

const rawBlockedIntervals = [
    {
        label: "Sleep + Yoga + Breakfast",
        start: new Date("2025-06-05T00:00:00"),
        end: new Date("2025-06-05T09:00:00"),
        recurrence: "daily",
        customDays: null,
        type: "blocked"                 // hard block, cannot be compromised
    },
    {
        label: "Afternoon Nap",
        start: new Date("2025-06-05T13:00:00"),
        end: new Date("2025-06-05T15:00:00"),
        recurrence: "daily",
        customDays: null,
        type: "break"                   // soft block, compromisable for urgent tasks
    },
    {
        label: "Walk + Rest",
        start: new Date("2025-06-05T17:00:00"),
        end: new Date("2025-06-05T18:00:00"),
        recurrence: "daily",
        customDays: null,
        type: "blocked"
    },
    {
        label: "Badminton",
        start: new Date("2025-06-05T18:00:00"),
        end: new Date("2025-06-05T19:00:00"),
        recurrence: "daily",
        customDays: null,
        type: "blocked"
    }
];

const blockedIntervals = rawBlockedIntervals.map(b => createBlockedInterval(b));

module.exports = {
    blockedIntervals
};