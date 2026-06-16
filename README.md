# DayForge

An intelligent task scheduling engine that builds your weekly plan automatically — respecting deadlines, priorities, dependencies, and your personal time blocks.

**Stack:** Vanilla JavaScript · Node.js · Express.js · express-validator · helmet · cors · uuid · node:test  
**Tests:** 62 unit tests, all passing  
**Status:** Engine complete · Backend API complete · Frontend (React) in progress

---

## What It Does

You give DayForge your tasks (deadlines, priorities, durations, dependencies) and your blocked time (sleep, classes, breaks). It produces the optimal schedule for your week — automatically.

- Tasks with tighter deadlines get scheduled first
- Splittable tasks are broken into sessions that fit available windows
- Dependent tasks wait until their prerequisites complete
- If hard free time is insufficient, soft-blocked time (breaks, naps) is used as fallback
- Tasks that genuinely cannot fit before their deadline are flagged with a reason — never silently skipped

---

## Algorithm & Technical Design

### Scheduling Strategy: Greedy Hybrid (EDF + Priority Scoring)

Every scheduling decision scores all ready tasks:

```
score    = (urgency × 0.7) + (normalizedPriority × 0.3)
urgency  = 1 − (timeRemaining / totalWindow)
```

Deadline urgency is deliberately weighted over priority — a low-priority task close to its deadline will outrank a high-priority task with a week to spare. The 70/30 split prevents deadline misses while still respecting importance.

Greedy over DP/backtracking: optimal scheduling is O(n!) or O(2ⁿ). For realistic task counts, greedy runs in milliseconds and produces schedules that are good enough in practice. Urgency is recalculated every iteration as `currentTime` advances, compensating for the lack of global optimality.

### Slot Selection: Best-Fit with Occupied Slot Subtraction

`findSlot` uses best-fit — for splittable tasks, it fills as much of the available window as possible (`min(taskDuration, availableMinutes - breakDuration)`), reducing fragmentation by maximising work done per session.

`runScheduler` maintains an `occupiedSlots` array. Before each scheduling decision, placed slots are subtracted from the free slot pool — ensuring no two tasks compete for the same window.

### Dependency Resolution: Kahn's Algorithm (Topological Sort)

Dependencies are resolved using Kahn's BFS-based topological sort:

- Detects cycles (`A → B → A`) before scheduling begins, failing fast with `CYCLE_DETECTED`
- Builds an adjacency map so `updateReadyQueue` unlocks dependent tasks the moment prerequisites complete
- Produces the initial ready queue of tasks with zero unresolved dependencies

### Hard vs Soft Blocked Time

| Tier | Type | Behaviour |
|------|------|-----------|
| Hard | `BLOCKED` | Non-negotiable. Sleep, classes, fixed commitments. Never touched. |
| Soft | `BREAK` | Compromisable. Naps, walks, personal time. Used as fallback if hard free time is insufficient. |

`feasibilityCheck` runs a full simulation (without mutating real task state) to verify a task can complete before its deadline — hard slots first, soft slots second.

### Anti-Starvation via Urgency Drift

Low-priority tasks with far deadlines could theoretically never get scheduled if high-priority tasks keep arriving. DayForge handles this naturally: urgency is recalculated every iteration using the advancing `currentTime`. As time passes, every task's urgency score rises — eventually a neglected task outscores everything else and gets scheduled.

### Break System: Tiered by Session Duration

| Session Duration | Break Added |
|-----------------|-------------|
| ≤ 20 min | None |
| 21 – 40 min | 5 min |
| 41 – 180 min | 15 min |
| > 180 min | 30 min |

If a slot fits the task but not task + break, the task is placed without a break rather than skipped. Correctness over perfection.

---

## Project Structure

```
DayForge/
├── index.js                          # Pipeline orchestrator (standalone engine runner)
├── package.json
│
└── dayforge-backend/                 # Express REST API
    ├── app.js                        # Express setup — middleware, routes, error handling
    ├── index.js                      # Server entry point
    │
    ├── routes/
    │   ├── auth.js                   # POST /auth/register, /login, /logout
    │   └── tasks.js                  # GET/POST/PATCH/DELETE /tasks, POST /tasks/schedule
    │
    ├── controllers/
    │   ├── authController.js         # Auth handlers
    │   └── taskController.js         # Task CRUD + scheduleTask (wires engine to HTTP)
    │
    ├── scheduler/                    # Core scheduling engine
    │   ├── validator.js
    │   ├── dependencyResolver.js     # Kahn's algorithm
    │   ├── freeSlotBuilder.js        # Hard/soft slot builder
    │   ├── reasonLogger.js
    │   └── strategies/
    │       └── schedulingAlgo.js     # scoreTask, findSlot, placeTask,
    │                                 # feasibilityCheck, updateReadyQueue, runScheduler
    │
    ├── models/
    │   ├── task.js
    │   └── blockedInterval.js
    │
    ├── metrics/
    │   └── index.js                  # Post-schedule metrics: workload, warnings, health
    │
    ├── utils/
    │   ├── constants.js              # TASK_STATUSES, PRIORITY, BREAK_RULES, ERROR_CODES
    │   ├── timeUtils.js
    │   └── idGenerator.js
    │
    └── tests/
        ├── validator_test.js         # 13 tests
        ├── dependencyResolverTest.js # 8 tests
        ├── freeSlotBuilderTest.js    # 11 tests
        ├── schedulingAlgoTest.js     # 22 tests
        └── runSchedulerTest.js       # 11 tests — 62 total, all passing
```

---

## API Endpoints

### Auth

| Method | Route | Description |
|--------|-------|-------------|
| POST | `/api/auth/register` | Register a new user |
| POST | `/api/auth/login` | Log in |
| POST | `/api/auth/logout` | Log out |

### Tasks

| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/tasks` | Get all tasks |
| GET | `/api/tasks/:id` | Get task by ID |
| POST | `/api/tasks` | Create a new task |
| PATCH | `/api/tasks/:id` | Update a task |
| DELETE | `/api/tasks/:id` | Delete a task |
| POST | `/api/tasks/schedule` | Run the scheduling engine |

### Schedule Request Body

```json
{
  "tasks": [],
  "blockedIntervals": [],
  "fromTime": "2026-06-10T08:00:00"
}
```

### Schedule Response

```json
{
  "scheduledTasks": [],
  "atRiskTasks": []
}
```

---

## Task Input Schema

```json
{
  "name": "OS Exam Prep",
  "durationMinutes": 600,
  "deadline": "2026-06-12T09:00",
  "priority": 5,
  "splittable": true,
  "minSplitDuration": 60,
  "earliestStart": "2026-06-07",
  "dependencies": ["task-uuid"],
  "category": "exam"
}
```

---

## Sample Output (Standalone Engine)

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

## Post-Schedule Metrics

| Metric | Description |
|--------|-------------|
| Scheduling rate | % of submitted tasks successfully scheduled |
| Hours today / this week | Total work time placed on the calendar |
| Free time today | Remaining hard free slots today |
| Deadline misses | Tasks scheduled but ending after their deadline |
| Soft slot usage | Tasks that required break time to fit |
| Split tasks | Tasks broken across multiple sessions |
| Avg urgency score | Overall schedule pressure (0 = relaxed, 1 = critical) |
| At-risk tasks | Tasks impossible to schedule + reason why |

---

## Test Coverage

62 unit tests across 5 files using Node's built-in `node:test` — no external framework required.

Every module in the scheduling engine has dedicated tests written alongside the implementation. Coverage includes: normal scheduling cases, empty inputs, past deadlines, impossible tasks, dependency chains, cycles, slots that fit work but not work + break, splittable tasks smaller than `minSplitDuration`, and tasks with future `earliestStart`.

---

## Running the Project

### Standalone Engine

```bash
git clone https://github.com/24cse-deepika/DayForge.git
cd DayForge
npm install
node index.js
```

### Run All Tests

```bash
node --test dayforge-backend/tests/validator_test.js \
             dayforge-backend/tests/dependencyResolverTest.js \
             dayforge-backend/tests/freeSlotBuilderTest.js \
             dayforge-backend/tests/schedulingAlgoTest.js \
             dayforge-backend/tests/runSchedulerTest.js
```

### Backend API Server

```bash
cd dayforge-backend
npm install
node index.js
# Server starts on port 3000
```

---

## Roadmap

- [x] Scheduling engine (greedy hybrid, dependency resolution, hard/soft slots)
- [x] Express REST API (auth + task routes, input validation, error handling)
- [x] 62 unit tests, all passing
- [ ] PostgreSQL — task persistence, completion tracking, reschedule history
- [ ] JWT auth — bcrypt password hashing, token-based sessions
- [ ] Full CRUD connected to database (currently stubbed)
- [ ] React frontend — weekly calendar view, drag-and-drop rescheduling
- [ ] DB-dependent metrics — completion rate, on-time delivery rate