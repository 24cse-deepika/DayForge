const rawTasks = [
    // Highest priority exam preparation
    {
        name: "Operating Systems Exam Prep",
        durationMinutes: 600,
        priority: 5,
        deadline: new Date("2026-06-12T09:00:00"),
        splittable: true,
        minSplitDuration: 60,
        dependencies: [],
        category: "exam",
        earliestStart: new Date("2026-06-06T09:00:00")
    },

    // Dependency parent
    {
        name: "Revise OS Notes",
        durationMinutes: 120,
        priority: 4,
        deadline: new Date("2026-06-11T23:59:00"),
        splittable: false,
        minSplitDuration: null,
        dependencies: [],
        category: "exam",
        earliestStart: new Date("2026-06-06T09:00:00")
    },

    // Dependency child
    {
        name: "Solve OS PYQs",
        durationMinutes: 180,
        priority: 5,
        deadline: new Date("2026-06-12T09:00:00"),
        splittable: true,
        minSplitDuration: 60,
        dependencies: [], 
        category: "exam",
        earliestStart: new Date("2026-06-06T09:00:00")
    },

    // Another important exam
    {
        name: "DBMS Exam Prep",
        durationMinutes: 480,
        priority: 5,
        deadline: new Date("2026-06-14T09:00:00"),
        splittable: true,
        minSplitDuration: 60,
        dependencies: [],
        category: "exam",
        earliestStart: new Date("2026-06-06T09:00:00")
    },

    // Third exam
    {
        name: "CN Exam Prep",
        durationMinutes: 420,
        priority: 4,
        deadline: new Date("2026-06-16T09:00:00"),
        splittable: true,
        minSplitDuration: 60,
        dependencies: [],
        category: "exam",
        earliestStart: new Date("2026-06-06T09:00:00")
    },

    // Project submission
    {
        name: "Mini Project Report",
        durationMinutes: 240,
        priority: 4,
        deadline: new Date("2026-06-13T23:59:00"),
        splittable: true,
        minSplitDuration: 60,
        dependencies: [],
        category: "project",
        earliestStart: new Date("2026-06-06T09:00:00")
    },

    // Placement preparation
    {
        name: "Aptitude Practice",
        durationMinutes: 180,
        priority: 2,
        deadline: new Date("2026-06-25T23:59:00"),
        splittable: true,
        minSplitDuration: 30,
        dependencies: [],
        category: "career",
        earliestStart: new Date("2026-06-06T09:00:00")
    },

    // Low urgency task
    {
        name: "Resume Update",
        durationMinutes: 90,
        priority: 2,
        deadline: new Date("2026-06-20T23:59:00"),
        splittable: false,
        minSplitDuration: null,
        dependencies: [],
        category: "career",
        earliestStart: new Date("2026-06-06T09:00:00")
    },

    // Future start constraint test
    {
        name: "Mock Interview",
        durationMinutes: 90,
        priority: 3,
        deadline: new Date("2026-06-18T23:59:00"),
        splittable: false,
        minSplitDuration: null,
        dependencies: [],
        category: "career",
        earliestStart: new Date("2026-06-11T18:00:00")
    }
];

module.exports = { rawTasks };