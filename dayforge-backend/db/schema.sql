-- IMPORTANT NAMING GOTCHA:
-- Postgres folds unquoted identifiers to lowercase. That means the "tasks"
-- table created with `minSplitDuration` and `scheduledSlots` (no double
-- quotes around them) is NOT actually storing those names - Postgres saved
-- them as `minsplitduration` and `scheduledslots`.

-- The repository code in this project (repositories/taskRepository.js) is
-- written against the FOLDED lowercase names to match what's actually in
-- your database right now. This file below reproduces that same schema
-- byte-for-byte (still unquoted -> still folds to lowercase) so schema.sql
-- and your live database stay in sync.
 
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255),
  google_id VARCHAR(255) UNIQUE,
  auth_provider VARCHAR(20) NOT NULL DEFAULT 'local',
  created_at TIMESTAMP DEFAULT NOW(),

  CONSTRAINT check_auth_provider CHECK (auth_provider IN ('local', 'google'))
);
 
CREATE TABLE IF NOT EXISTS tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  original_duration INTEGER NOT NULL,
  duration INTEGER NOT NULL,
  deadline TIMESTAMP NOT NULL,
  priority INTEGER,
  task_status VARCHAR(50) DEFAULT 'PENDING',
  urgency VARCHAR(50) DEFAULT 'NORMAL',
  splittable BOOLEAN DEFAULT FALSE,
  minSplitDuration INTEGER DEFAULT 25,
  category VARCHAR(100),
  progress INTEGER DEFAULT 0,
  dependencies UUID[] DEFAULT '{}',
  earliest_start TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  scheduledSlots JSONB DEFAULT '[]'
);
 
-- Mirrors models/blockedInterval.js (the in-memory shape the scheduler
-- engine consumes). `start`/`end` are valid unquoted Postgres column names
-- (not reserved words), but we still call them start_time/end_time here to
-- read unambiguously in queries - "WHERE end_time > start_time" is clearer
-- than "WHERE end > start" at a glance. Mapped back to start/end in JS by
-- repositories/blockedIntervalRepository.js so the rest of the app matches
-- the engine's naming.
CREATE TABLE IF NOT EXISTS blocked_intervals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  label VARCHAR(255) NOT NULL,
  start_time TIMESTAMP NOT NULL,
  end_time TIMESTAMP NOT NULL,
  recurrence VARCHAR(50) DEFAULT 'none',
  custom_days TEXT[] DEFAULT NULL,
  type VARCHAR(50) DEFAULT 'blocked',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
 
-- gen_random_uuid() lives in the pgcrypto extension. If your `tasks` table
-- was created successfully, this was already enabled - but if you ever
-- rebuild the DB from scratch and get "function gen_random_uuid() does not
-- exist", run this first:
-- CREATE EXTENSION IF NOT EXISTS pgcrypto;