# DayForge

An intelligent task scheduling engine that builds your weekly plan automatically — respecting deadlines, priorities, dependencies, and your personal time blocks.

**Stack:** Node.js · Express.js · PostgreSQL (raw `pg`) · JWT · bcrypt · Passport (Google OAuth) · helmet · cors · express-validator · node:test
**Tests:** 74 tests across 7 files, all passing
**Status:** Engine complete · Auth complete (local + Google OAuth) · PostgreSQL persistence complete · Frontend in progress

---

## What It Does

You give DayForge your tasks (deadlines, priorities, durations, dependencies) and your blocked time (sleep, classes, breaks). It produces the optimal schedule for your week — automatically, persisted to your account, recomputed on demand.

- Tasks with tighter deadlines get scheduled first
- Splittable tasks are broken into sessions that fit available windows
- Dependent tasks wait until their prerequisites complete
- If hard free time is insufficient, soft-blocked time (breaks, naps) is used as fallback
- Tasks that genuinely cannot fit before their deadline are flagged with a reason — never silently skipped
- Every user's tasks, blocked intervals, and generated schedules persist across sessions

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

## Authentication

- **Local auth**: email/password, bcrypt-hashed (10 salt rounds)
- **Google OAuth**: via Passport, no server-side sessions — the OAuth handshake issues a signed JWT, same as local login
- **Sessions**: JWT stored in an httpOnly cookie (7-day expiry), verified on every protected request by `authenticate` middleware
- Every task and blocked interval is scoped to the authenticated user (`user_id` foreign key, enforced at the query level — one user can never read or modify another's data)

---

## Project Structure

```
DayForge/
├── package.json
│
└── dayforge-backend/                 # Express REST API
    ├── app.js                        # Express setup — middleware, routes, error handling
    ├── index.js                      # Server entry point
    │
    ├── config/
    │   └── passport.js                # Google OAuth strategy
    │
    ├── db/
    │   ├── pool.js                    # Postgres connection pool
    │   ├── schema.sql                 # Full schema — users, tasks, blocked_intervals
    │   └── testConnection.js          # Manual DB connectivity check
    │
    ├── routes/
    │   ├── auth.js                    # /register, /login, /logout, /google, /google/callback, /me
    │   ├── tasks.js                   # Task CRUD + /schedule, all behind auth middleware
    │   └── blockedIntervals.js        # Blocked interval CRUD, behind auth middleware
    │
    ├── controllers/
    │   ├── authController.js          # Auth handlers — register, login, Google callback, logout
    │   ├── taskController.js          # Task CRUD + scheduleTask (DB-backed)
    │   └── blockedIntervalController.js
    │
    ├── middleware/
    │   └── authMiddleware.js          # authenticate (JSON 401) / authenticatePage (redirect)
    │
    ├── repositories/                  # Raw SQL, one file per table
    │   ├── userRepository.js
    │   ├── taskRepository.js          # Handles camelCase ↔ snake_case column mapping
    │   └── blockedIntervalRepository.js
    │
    ├── scheduler/                     # Core scheduling engine — pure, no DB/HTTP dependency
    │   ├── validator.js
    │   ├── dependencyResolver.js      # Kahn's algorithm
    │   ├── freeSlotBuilder.js         # Hard/soft slot builder
    │   ├── reasonLogger.js
    │   └── strategies/
    │       └── schedulingAlgo.js      # scoreTask, findSlot, placeTask,
    │                                  # feasibilityCheck, updateReadyQueue, runScheduler
    │
    ├── models/
    │   ├── task.js
    │   └── blockedInterval.js
    │
    ├── metrics/
    │   └── index.js                   # Post-schedule metrics: workload, warnings, health
    │
    ├── utils/
    │   ├── constants.js               # TASK_STATUSES, PRIORITY, BREAK_RULES, ERROR_CODES
    │   ├── timeUtils.js
    │   ├── idGenerator.js
    │   └── jwt.js                     # generateToken / verifyToken
    │
    └── tests/
        ├── validator_test.js           # 13 tests
        ├── dependencyResolverTest.js    # 8 tests
        ├── freeSlotBuilderTest.js       # 11 tests
        ├── schedulingAlgoTest.js        # 22 tests
        ├── runSchedulerTest.js          # 11 tests
        ├── taskRepositoryTest.js        # 6 tests — real Postgres integration tests
        └── blockedIntervalRepositoryTest.js  # 6 tests — real Postgres integration tests
                                          # 74 total, all passing
```

---

## API Endpoints

### Auth

| Method | Route | Description |
|--------|-------|-------------|
| POST | `/api/auth/register` | Register with email/password |
| POST | `/api/auth/login` | Log in, sets JWT cookie |
| GET | `/api/auth/google` | Start Google OAuth flow |
| GET | `/api/auth/google/callback` | Google OAuth callback, sets JWT cookie |
| POST | `/api/auth/logout` | Clear session cookie |
| GET | `/api/auth/me` | Get current authenticated user *(protected)* |

### Tasks — all routes below require authentication

| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/tasks` | Get all tasks for the logged-in user |
| GET | `/api/tasks/:id` | Get a single task by ID |
| POST | `/api/tasks` | Create a new task |
| PATCH | `/api/tasks/:id` | Update a task |
| DELETE | `/api/tasks/:id` | Delete a task |
| POST | `/api/tasks/schedule` | Fetch the user's tasks + blocked intervals from the DB, run the scheduling engine, persist and return the result |

### Blocked Intervals — all routes below require authentication

| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/blocked-intervals` | Get all blocked intervals for the logged-in user |
| GET | `/api/blocked-intervals/:id` | Get a single blocked interval by ID |
| POST | `/api/blocked-intervals` | Create a new blocked interval |
| PATCH | `/api/blocked-intervals/:id` | Update a blocked interval |
| DELETE | `/api/blocked-intervals/:id` | Delete a blocked interval |

### Schedule Request Body

```json
{
  "fromTime": "2026-07-08T09:00:00"
}
```

Tasks and blocked intervals are no longer sent by the client — `/schedule` reads them directly from Postgres, scoped to the authenticated user.

### Schedule Response

```json
{
  "scheduledTasks": [],
  "atRiskTasks": []
}
```

Each task in the response includes its assigned `scheduledSlots`, updated `task_status`, and `progress` — the same values written back to the database.

---

## Task Input Schema

```json
{
  "name": "OS Exam Prep",
  "durationMinutes": 600,
  "deadline": "2026-07-12T09:00",
  "priority": 5,
  "splittable": true,
  "minSplitDuration": 60,
  "earliestStart": "2026-07-08",
  "dependencies": ["task-uuid"],
  "category": "exam"
}
```

## Blocked Interval Input Schema

```json
{
  "label": "College hours",
  "start": "2026-07-08T09:00:00",
  "end": "2026-07-08T16:00:00",
  "recurrence": "none",
  "type": "blocked"
}
```

---

## Database Schema

PostgreSQL, three tables: `users`, `tasks`, `blocked_intervals`. Both `tasks` and `blocked_intervals` scope every row to a `user_id` foreign key with `ON DELETE CASCADE`. `tasks.scheduled_slots` is `JSONB`, overwritten on every `/schedule` call. `tasks.dependencies` is a native `UUID[]` array. Full schema in `dayforge-backend/db/schema.sql`.

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

74 tests across 7 files using Node's built-in `node:test` — no external framework required.

- **Engine tests** (65 tests): scheduling algorithm, dependency resolution, free-slot building, validators — pure logic, no DB dependency. Covers normal scheduling, empty inputs, past deadlines, impossible tasks, dependency chains, cycles, slots that fit work but not work + break, splittable tasks smaller than `minSplitDuration`, and future `earliestStart`.
- **Repository tests** (9 tests): real integration tests against local Postgres — verifies CRUD, user-scoping (one user can't read another's rows), and partial updates actually work against the live schema, not a mock.

---

## Running the Project

### Backend API Server

```bash
git clone https://github.com/24cse-deepika/DayForge.git
cd DayForge/dayforge-backend
npm install
# Set up .env — see .env.example for required variables:
# DATABASE_URL, JWT_SECRET, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, BASE_URL, CLIENT_ORIGIN
psql -U postgres -d dayforge -f db/schema.sql
node index.js
# Server starts on port 3000
```

### Run All Tests

```bash
cd dayforge-backend
npm test
```

---

## Roadmap

- [x] Scheduling engine (greedy hybrid, dependency resolution, hard/soft slots)
- [x] Express REST API (task + blocked-interval routes, input validation, error handling)
- [x] PostgreSQL persistence — tasks, blocked intervals, generated schedules
- [x] Full auth — bcrypt password hashing, JWT sessions, Google OAuth
- [x] Full CRUD connected to database, scoped per user
- [x] 74 tests, all passing (engine + repository integration tests)
- [ ] HTML, CSS, EJS frontend
- [ ] Deployment (Railway/Render + Neon/Railway Postgres)