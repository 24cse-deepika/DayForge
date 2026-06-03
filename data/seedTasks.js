const { createTask } = require('../models/task');

const rawTasks = [
    {
        name: "DSA Revision",
        durationMinutes: 120,
        priority: 4,
        deadline: new Date("2025-06-30T23:59:00"),
        splittable: false,
        minSplitDuration: null,
        dependencies: [],
        category: "study",
        earliestStart: new Date()
    },
    {
        name: "Backend Development",
        durationMinutes: 120,
        priority: 4,
        deadline: new Date("2025-06-30T23:59:00"),
        splittable: false,
        minSplitDuration: null,
        dependencies: [],
        category: "work",
        earliestStart: new Date()
    },
    {
        name: "DayForge Project",
        durationMinutes: 480,           // 8 hrs total, will be split
        priority: 5,
        deadline: new Date("2025-06-30T23:59:00"),
        splittable: true,
        minSplitDuration: 60,
        dependencies: ["DSA Revision", "Backend Development"], // will be replaced by IDs after creation
        category: "work",
        earliestStart: new Date()
    },
    {
        name: "AI Lab Assignment 4",
        durationMinutes: 120,
        priority: 2,
        deadline: new Date("2025-06-07T23:59:00"),
        splittable: true,
        minSplitDuration: 30,
        dependencies: [],
        category: "college",
        earliestStart: new Date()
    },
    {
        name: "IoT Project and Assignment",
        durationMinutes: 240,
        priority: 1,
        deadline: new Date("2025-06-15T23:59:00"),
        splittable: true,
        minSplitDuration: 60,
        dependencies: [],
        category: "college",
        earliestStart: new Date()
    },
    {
        name: "Learn Cooking",
        durationMinutes: 120,
        priority: 3,
        deadline: new Date("2025-06-30T20:00:00"),
        splittable: false,
        minSplitDuration: null,
        dependencies: [],
        category: "personal",
        earliestStart: new Date()
    },
    {
        name: "Watch Anime",
        durationMinutes: 120,
        priority: 1,
        deadline: new Date("2025-06-30T23:59:00"),
        splittable: true,
        minSplitDuration: 30,
        dependencies: [],
        category: "personal",
        earliestStart: new Date()
    }
];

// create task objects from raw data
const tasks = rawTasks.map(t => createTask(t));

// now wire up project dependencies using actual generated IDs
const dsaTask = tasks.find(t => t.name === "DSA Revision");
const backendTask = tasks.find(t => t.name === "Backend Development");
const projectTask = tasks.find(t => t.name === "DayForge Project");
projectTask.dependencies = [dsaTask.id, backendTask.id];

module.exports = {
    tasks
};