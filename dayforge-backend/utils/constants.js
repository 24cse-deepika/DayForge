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

const BREAK_RULES = {
    NO_BREAK_MAX: 20,        // ≤ 20 min → no break
    SHORT_BREAK_MAX: 40,     // 21–40 min → 5 min break
    MEDIUM_BREAK_MAX: 180,   // 41–180 min → 15 min break
                             // > 180 min → 30 min break
    SHORT_BREAK: 5,
    MEDIUM_BREAK: 15,
    LONG_BREAK: 30
}

const METRICS = {
    MINIMUM_UTILIZATION_THRESHOLD : 0.5,
    MISSED_TASKS_BEFORE_WARNING : 3
}

const ERROR_CODES = {
    INVALID_INPUT: "invalid_input",
    CYCLE_DETECTED: "cycle_detected",
    IMPOSSIBLE_TO_SCHEDULE: "impossible_to_schedule",    // task itself can't fit anywhere
    CAUSES_DEADLINE_MISS: "causes_deadline_miss",        // task causes ANOTHER task to miss ← new
    REFERENCE_NOT_FOUND: "reference_not_found",
    INVALID_DATE: "invalid_date"
}

const SCHEDULE_REASONS = {
    CRITICAL_DEADLINE: "critical_deadline",
    URGENT_DEADLINE: "urgent_deadline",
    HIGHEST_PRIORITY: "highest_priority",
    DEPENDENCY_RESOLVED: "dependency_resolved",
    TASK_SPLIT: "task_split",
    EARLIEST_DEADLINE: "earliest_deadline"
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
    BREAK : "break"
}

module.exports = {
    TASK_STATUSES,
    URGENCY,
    SCHEDULING_WINDOW_DAYS,
    URGENCY_THRESHOLD_PERCENT,
    CRITICAL_THRESHOLD_HOURS,
    PRIORITY,
    BREAK_RULES,
    METRICS,
    ERROR_CODES,
    SCHEDULE_REASONS,
    RECURRENCE,
    BLOCK_TYPES
};