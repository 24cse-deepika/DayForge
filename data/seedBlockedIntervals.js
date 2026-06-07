const rawBlockedIntervals = [
    // Sleep
    {
        label: "Sleep",
        start: new Date("2026-06-06T00:00:00"),
        end: new Date("2026-06-06T07:00:00"),
        recurrence: "daily",
        customDays: null,
        type: "blocked"
    },

    // College hours
    {
        label: "College",
        start: new Date("2026-06-06T09:00:00"),
        end: new Date("2026-06-06T16:00:00"),
        recurrence: "weekdays",
        customDays: null,
        type: "blocked"
    },

    // Lunch break
    {
        label: "Lunch",
        start: new Date("2026-06-06T13:00:00"),
        end: new Date("2026-06-06T14:00:00"),
        recurrence: "daily",
        customDays: null,
        type: "break"
    },

    // Gym (soft block)
    {
        label: "Gym",
        start: new Date("2026-06-06T19:00:00"),
        end: new Date("2026-06-06T20:00:00"),
        recurrence: "weekdays",
        customDays: null,
        type: "break"
    },

    // Family time on weekends
    {
        label: "Family Time",
        start: new Date("2026-06-06T20:00:00"),
        end: new Date("2026-06-06T22:00:00"),
        recurrence: "weekends",
        customDays: null,
        type: "blocked"
    }
];

module.exports = { rawBlockedIntervals };