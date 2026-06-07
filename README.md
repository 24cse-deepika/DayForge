# DayForge 🔥

> An intelligent task scheduling engine that automatically builds your weekly plan — respecting deadlines, priorities, dependencies, and your personal time blocks.

DayForge is a scheduling engine built from scratch in vanilla JavaScript, designed for students and professionals who need more than a to-do list. It doesn't just store tasks — it thinks about when and how to fit them into your life.

---

## What It Does

You give DayForge your tasks (with deadlines, priorities, durations, and dependencies) and your blocked time (sleep, classes, breaks). It figures out the best schedule for the week — automatically.

- Tasks with tighter deadlines get scheduled first
- Splittable tasks are broken into sessions that fit available windows
- Tasks that depend on other tasks wait until their prerequisites are done
- If your normal time isn't enough, it can use soft-blocked time (naps, breaks) as a fallback
- Tasks that genuinely can't fit before their deadline are flagged — not silently skipped

---

## Algorithm & Technical Design

### Scheduling Strategy: Greedy Hybrid (EDF + Priority Scoring)

Rather than brute-forcing all possible orderings (exponential complexity — impractical for real use), DayForge uses a **greedy hybrid algorithm** that scores each task before every scheduling decision:

```
score = (urgency × 0.7) + (normalizedPriority × 0.3)
urgency = 1 − (timeRemaining / totalWindow)
```

This deliberately weights deadline urgency over priority — a low-priority task close to its deadline will beat a high-priority task with a week to spare. The 70/30 split was a conscious design choice to prevent deadline misses while still respecting importance.

**Why greedy over dynamic programming or backtracking?**  
DP and backtracking would guarantee the globally optimal schedule but at O(n!) or O(2ⁿ) complexity. For a personal scheduler with realistic task counts, greedy runs in milliseconds and produces schedules that are good enough in practice. The urgency-weighted scoring compensates for the lack of global optimality by continuously re-scoring every iteration as time advances.

### Slot Selection: Best-Fit with Occupied Slot Subtraction

`findSlot` implements a **best-fit approach** — for splittable tasks, it doesn't just check if the minimum chunk fits, it fills as much of the available window as possible (`min(taskDuration, availableMinutes - breakDuration)`). This reduces fragmentation by maximising work done per session.

To prevent double-booking, `runScheduler` maintains an `occupiedSlots` array. Before each scheduling decision, placed slots are subtracted from the free slot pool — ensuring two tasks never compete for the same window.

### Dependency Resolution: Kahn's Algorithm (Topological Sort)

Task dependencies are resolved using **Kahn's algorithm** — a standard BFS-based topological sort that:
- Detects cycles (A → B → A) before scheduling begins, failing fast with `CYCLE_DETECTED`
- Builds an adjacency map so `updateReadyQueue` can unlock dependent tasks the moment their prerequisites complete
- Produces the initial ready queue of tasks with zero unresolved dependencies

### Hard vs Soft Slots

Blocked time is split into two tiers:
- **Hard blocks** (`BLOCKED`) — non-negotiable. Sleep, classes, fixed commitments. The scheduler never touches these.
- **Soft blocks** (`BREAK`) — compromisable. Naps, walks, personal time. If a task can't fit in hard free time, the scheduler falls back to soft slots before declaring it infeasible.

`feasibilityCheck` runs a full simulation (without mutating any real task) to verify a task can complete before its deadline — on hard slots first, soft slots second.

### Anti-Starvation via Urgency Drift

Low-priority tasks with far deadlines could theoretically never get scheduled if high-priority tasks keep arriving. DayForge handles this naturally: urgency is recalculated every iteration using the advancing `currentTime`. As time passes, every task's urgency score rises — eventually a neglected task outscores everything else and gets its turn.

### Break System: Tiered by Session Duration

Rather than enforcing Pomodoro (which couples UI concerns into the scheduling engine), DayForge uses a **tiered break system** based on actual session length:

| Session Duration | Break |
|-----------------|-------|
| ≤ 20 min | No break |
| 21 – 40 min | 5 min |
| 41 – 180 min | 15 min |
| > 180 min | 30 min |

If a slot fits the task but not task + break, the task is placed without a break rather than being skipped. Correctness over perfection.

---

## Project Structure

```
DayForge/
├── index.js                          # Pipeline orchestrator
├── data/
│   ├── seedTasks.js                  # Sample tasks for development
│   └── seedBlockedIntervals.js       # Sample blocked time
├── models/
│   ├── task.js                       # Task factory with validation defaults
│   └── blockedInterval.js            # Blocked interval factory
├── scheduler/
│   ├── validator.js                  # Input validation (tasks + intervals)
│   ├── dependencyResolver.js         # Kahn's algorithm — cycle detection + adjacency map
│   ├── freeSlotBuilder.js            # Recurring block expansion + hard/soft slot builder
│   ├── reasonLogger.js               # Developer log + structured reason output for API
│   └── strategies/
│       └── schedulingAlgo.js         # Core engine: scoreTask, findSlot, placeTask,
│                                     #   feasibilityCheck, updateReadyQueue, runScheduler
├── metrics/
│   └── index.js                      # Post-schedule metrics: workload, warnings, health
├── utils/
│   ├── constants.js                  # TASK_STATUSES, PRIORITY, BREAK_RULES, ERROR_CODES
│   ├── timeUtils.js                  # Pure time helpers: minutesBetween, getBreakDuration
│   └── idGenerator.js               # UUID wrapper
└── tests/
    ├── validator_test.js             # 13 tests
    ├── dependencyResolverTest.js     # 8 tests
    ├── freeSlotBuilderTest.js        # 11 tests
    ├── schedulingAlgoTest.js         # 22 tests
    └── runSchedulerTest.js           # 11 tests — 62 total, all passing
```

---

## Running the Project

```bash
# Clone the repo
git clone https://github.com/yourusername/DayForge.git
cd DayForge

# Install dependencies (just uuid)
npm install

# Run the scheduler
node index.js

# Run all tests
node --test tests/validator_test.js tests/dependencyResolverTest.js tests/freeSlotBuilderTest.js tests/schedulingAlgoTest.js tests/runSchedulerTest.js
```

---

## Sample Output

```
╔══════════════════════════════════════╗
║         DAYFORGE SCHEDULER           ║
╚══════════════════════════════════════╝

  [1/5] Validating tasks...
  [2/5] Building runtime objects...
  [3/5] Resolving task dependencies...
  [4/5] Generating free time slots...
  [5/5] Running scheduling algorithm...

✅ SCHEDULED TASKS (8)

  📌 OS Exam Prep
     Priority: 5 | Progress: 100%
     Sessions: 4 (split across multiple slots)
     [1] Mon 09:00 → 15:00  Reason: Earliest deadline
     [2] Tue 07:00 → 09:00  Reason: Earliest deadline

📊 Summary
   Tasks submitted: 9 | Scheduled: 8 | At risk: 1
   Scheduling rate: 89%

🕐 Workload
   Work today: 7.9h | This week: 34.5h | Free today: 2.2h

💚 Health: Avg urgency 0.15/1.0 — Schedule looks healthy 🟢
```

---

## Metrics

After every scheduling run, DayForge computes:

| Metric | Description |
|--------|-------------|
| Scheduling rate | % of submitted tasks successfully scheduled |
| Hours today / this week | Total work time placed on the calendar |
| Free time today | Remaining hard free slots today |
| Deadline misses | Tasks scheduled but ending after their deadline |
| Soft slot usage | Tasks that required rest/break time to fit |
| Split tasks | Tasks broken across multiple sessions |
| Avg urgency score | Overall schedule pressure (0 = relaxed, 1 = critical) |
| At-risk tasks | Tasks impossible to schedule + reason why |

---

## Task Input Schema

```js
{
  name: "OS Exam Prep",
  durationMinutes: 600,          // estimated work time
  deadline: "2026-06-12T09:00", // hard deadline
  priority: 5,                   // 1 (low) → 5 (critical)
  splittable: true,              // can be broken into sessions?
  minSplitDuration: 60,          // minimum viable session (minutes)
  earliestStart: "2026-06-07",  // don't schedule before this date
  dependencies: ["task-uuid"],   // IDs of tasks that must complete first
  category: "exam"
}
```

---

## About the Tests

62 unit tests across 5 files using Node's built-in `node:test` — no external test framework required.

Every function in the scheduling engine has dedicated tests written alongside the implementation. Tests cover normal cases, edge cases (empty inputs, past deadlines, impossible tasks, dependency chains), and known failure modes (slots that fit work but not work + break, splittable tasks smaller than `minSplitDuration`, tasks with future `earliestStart`).

---

## What's Next

The scheduling engine is complete and fully tested. Upcoming phases:

- **Backend** — Node.js + Express REST API wrapping the engine
- **Database** — PostgreSQL for task persistence, completion tracking, reschedule history
- **Frontend** — React UI with a weekly calendar view
- **DB-dependent metrics** — completion rate, reschedule count, on-time delivery rate

The engine is deliberately decoupled from I/O — it takes plain objects in and returns plain objects out, making it straightforward to plug into any backend without changes.

---

## About

Built by Deepika — a 3rd year CS student who learns by building real things.

Started as a C++ idea, pivoted to JavaScript after reasoning through what actually mattered for this use case. Went through two full redesigns (dropped Pomodoro scheduling, overhauled the slot system) before the engine felt right. The project began with no knowledge of Node.js, Express, or React — the scheduling engine was built first, learning the full stack comes next. Every function was reasoned through before being written. This was built to be understood, not just to work.

**Stack in this phase:** Vanilla JavaScript · Node.js · `uuid` · `node:test`  
**Coming next:** Express.js · PostgreSQL · React