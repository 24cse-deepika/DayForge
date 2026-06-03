const TASK_STATUSES = {
    PENDING : "pending",
    IN_PROGRESS : "in_progress",
    COMPLETED : "completed",
    MISSED : "missed",
    SKIPPED : "skipped",
    SCHEDULED : "scheduled"
}

const URGENCY = {
    NORMAL : "normal",
    URGENT : "urgent",
    CRITICAL : "critical"
}

const SCHEDULING_WINDOW_DAYS = 7;
const URGENCY_THRESHOLD_PERCENT = 20;
const CRITICAL_THRESHOLD_HOURS = 3;

const PRIORITY = {
    MIN: 1,
    MAX: 5
}

const POMODORO = {
    WORK_DURATION : 25,
    BREAK_DURATION : 5,
    LONG_BREAK_DURATION : 15,
    SESSIONS_BEFORE_LONG_BREAK : 4
}

const METRICS = {
    MINIMUM_UTILIZATION_THRESHOLD : 0.5,
    MISSED_TASKS_BEFORE_WARNING : 3
}

const ERROR_CODES = {
    INVALID_INPUT: "invalid_input",
    CYCLE_DETECTED: "cycle_detected",
    IMPOSSIBLE_TO_SCHEDULE: "impossible_to_schedule",
    REFERENCE_NOT_FOUND: "reference_not_found",
    INVALID_DATE: "invalid_date"
}

const SCHEDULE_REASONS = {
    CRITICAL_DEADLINE: "critical_deadline",
    URGENT_DEADLINE: "urgent_deadline",
    HIGHEST_PRIORITY: "highest_priority",
    DEPENDENCY_RESOLVED: "dependency_resolved",
    TASK_SPLIT: "task_split"
}

const RECURRENCE = {
    NONE : "none",
    DAILY : "daily",
    WEEKDAYS : "weekdays",
    WEEKENDS : "weekends",
    CUSTOM : "custom"
}

const BLOCK_TYPES = {
    BLOCKED : "blocked",
    BREAK: "break"
}

module.exports = {
    TASK_STATUSES,
    URGENCY,
    SCHEDULING_WINDOW_DAYS,
    URGENCY_THRESHOLD_PERCENT,
    CRITICAL_THRESHOLD_HOURS,
    PRIORITY,
    POMODORO,
    METRICS,
    ERROR_CODES,
    SCHEDULE_REASONS,
    RECURRENCE,
    BLOCK_TYPES
};