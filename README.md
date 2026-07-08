# DayForge

An intelligent task scheduling engine that builds your weekly plan automatically — respecting deadlines, priorities, dependencies, and your personal time blocks.

**Stack:** Node.js · Express.js · PostgreSQL (raw `pg`) · EJS · JWT · bcrypt · Passport (Google OAuth) · helmet · cors · express-validator · node:test
**Tests:** 74 tests across 7 files, all passing
**Status:** v1.0.0 — Engine complete · Auth complete (local + Google OAuth) · PostgreSQL persistence complete · Frontend complete

---

## What It Does

You give DayForge your tasks (deadlines, priorities, durations, dependencies) and your blocked time (sleep, classes, breaks). It produces the optimal schedule for your week — automatically, persisted to your account, recomputed on demand.

- Tasks with tighter deadlines get scheduled first
- Splittable tasks are broken into sessions that fit available windows
- Dependent tasks wait until their prerequisites complete
- If hard free time is insufficient, soft-blocked time (breaks, naps) is used as fallback
- Tasks that genuinely cannot fit before their deadline are flagged with a reason — never silently skipped
- Every user's tasks, blocked intervals, and generated schedules persist across sessions
- The dashboard and schedule timeline are server-rendered (EJS) and reload with your last-generated schedule intact

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

`findSlot` uses best-fit — for splittable tasks, it fills as much of the available window as possible, capped so a single sitting never exceeds `BREAK_RULES.MEDIUM_BREAK_MAX` (180 minutes) of continuous work. Longer tasks are therefore forced across multiple sessions with a real break in between, rather than one uninterrupted block with a single break tacked on the end.

Each placed slot tracks a `workEnd` (the actual work portion, used for what's rendered on the timeline) separately from the reserved end (work + break, used to block other tasks from being scheduled during that break).

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
| > 180 min | 30 min, and the session is capped at 180 min — the rest becomes a separate session |

If a slot fits the task but not task + break, the task is placed without a break rather than skipped. Correctness over perfection.

### Task Status Vocabulary

`task_status` reflects the scheduling engine's state, not the user's actual
progress — placing a task on the calendar (even fully) sets it to
`scheduled`, never `completed`. The engine has no way to know a task was
actually finished, so `completed` is reserved for the user explicitly
marking it done. An internal `fullyAllocated` flag (not exposed as
`task_status`) drives the scheduling loop and dependency-chain unlocking.

---

## Authentication

- **Local auth**: email/password, bcrypt-hashed (10 salt rounds)
- **Google OAuth**: via Passport, no server-side sessions — the OAuth handshake issues a signed JWT, same as local login
- **Sessions**: JWT stored in an httpOnly cookie (7-day expiry), verified on every protected request by `authenticate` middleware; page routes use `authenticatePage` to redirect unauthenticated visitors to `/login` instead of returning a JSON 401
- Every task and blocked interval is scoped to the authenticated user (`user_id` foreign key, enforced at the query level — one user can never read or modify another's data)

---

## Project Structure

```
DayForge/
├── package.json
│
└── dayforge-backend/                 # Express app — REST API + server-rendered frontend
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
    │   ├── blockedIntervals.js        # Blocked interval CRUD, behind auth middleware
    │   └── pages.js                   # Server-rendered pages — /, /login, /register, /dashboard, /schedule
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
    ├── views/                         # EJS templates
    │   ├── partials/head.ejs, sidebar.ejs
    │   ├── login.ejs, register.ejs
    │   ├── dashboard.ejs
    │   └── schedule.ejs                # Timeline, day tabs, generate-schedule flow, at-risk list
    │
    ├── public/                        # Static assets served by Express
    │   ├── css/style.css
    │   └── js/
    │       ├── auth.js
    │       ├── common.js
    │       ├── dashboard.js
    │       └── schedule.js             # Timeline rendering, generate/reload flow
    │
    └── tests/
        ├── validator_test.js           # 12 tests
        ├── dependencyResolverTest.js    # 8 tests
        ├── freeSlotBuilderTest.js       # 10 tests
        ├── schedulingAlgoTest.js        # 22 tests
        ├── runSchedulerTest.js          # 10 tests
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

### Pages (server-rendered, EJS)

| Method | Route | Description |
|--------|-------|-------------|
| GET | `/` | Redirects to `/login` |
| GET | `/login` | Login page (redirects to `/dashboard` if already authenticated) |
| GET | `/register` | Registration page (same redirect behaviour) |
| GET | `/dashboard` | Dashboard *(protected — redirects to `/login` if not authenticated)* |
| GET | `/schedule` | Schedule timeline — reloads your last-generated schedule from the DB *(protected)* |

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

Each task in the response includes its assigned `scheduledSlots`, updated `task_status` (`scheduled`, never auto-set to `completed`), and `progress` — the same values written back to the database.

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

`earliestStart` is optional — tasks without one default to the schedule's
`fromTime` at intake, rather than the engine treating a missing value as
"no constraint."

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

PostgreSQL, three tables: `users`, `tasks`, `blocked_intervals`. Both `tasks` and `blocked_intervals` scope every row to a `user_id` foreign key with `ON DELETE CASCADE`. `tasks.scheduled_slots` is `JSONB`, overwritten on every `/schedule` call. `tasks.dependencies` is a native `UUID[]` array. `task_status` and `urgency` default to lowercase (`pending`, `normal`) to match the `TASK_STATUSES`/`URGENCY` enums in `utils/constants.js`. Full schema in `dayforge-backend/db/schema.sql`.

> Column names in `schema.sql` are intentionally unquoted, which Postgres
> folds to lowercase (e.g. `minSplitDuration` → `minsplitduration`). The
> repository layer is written against those folded names — don't quote the
> identifiers when editing the schema.

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

- **Engine tests** (62 tests): scheduling algorithm, dependency resolution, free-slot building, validators — pure logic, no DB dependency. Covers normal scheduling, empty inputs, past deadlines, impossible tasks, dependency chains, cycles, slots that fit work but not work + break, splittable tasks smaller than `minSplitDuration`, tasks with no `earliestStart`, sessions capped at 180 min with real internal breaks, and future `earliestStart`.
- **Repository tests** (12 tests): real integration tests against local Postgres — verifies CRUD, user-scoping (one user can't read another's rows), partial updates, defensive parsing of `scheduledSlots`, and correct lowercase status/urgency defaults against the live schema, not a mock.

Run just the engine tests without a live database:

```bash
node --test tests/schedulingAlgoTest.js tests/runSchedulerTest.js tests/freeSlotBuilderTest.js tests/dependencyResolverTest.js tests/validator_test.js
```

---

## Running the Project

### Backend + Frontend (single Express app)

```bash
git clone https://github.com/24cse-deepika/DayForge.git
cd DayForge/dayforge-backend
npm install
```

Set up `.env`:

```env
PORT=3000
NODE_ENV=development

# Postgres connection
DB_USER=your_pg_user
DB_HOST=localhost
DB_NAME=dayforge
DB_PASSWORD=your_pg_password
DB_PORT=5432

# Auth
JWT_SECRET=some_long_random_string
CLIENT_ORIGIN=http://localhost:3000
BASE_URL=http://localhost:3000

# Google OAuth (optional)
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
```

`BASE_URL` is used to build the Google OAuth callback URL
(`${BASE_URL}/api/auth/google/callback`) — it must match a redirect URI
registered in your Google Cloud console.

```bash
psql -U your_pg_user -d dayforge -f db/schema.sql
npm start
# Server starts on port 3000 — serves both the API and the EJS frontend.
# Visit http://localhost:3000, you'll be redirected to /login.
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
- [x] HTML, CSS, EJS frontend — dashboard, schedule timeline, day tabs, at-risk list, persisted-schedule reload
- [ ] Deployment (Railway/Render + Neon/Railway Postgres)