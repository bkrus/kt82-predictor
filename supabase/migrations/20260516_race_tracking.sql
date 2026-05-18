-- ─── team_plan race columns ──────────────────────────────────────────────────
-- Safe to run multiple times (IF NOT EXISTS / DO NOTHING).

ALTER TABLE team_plan
  ADD COLUMN IF NOT EXISTS current_leg       INT         DEFAULT 1,
  ADD COLUMN IF NOT EXISTS leg_results       JSONB       DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS race_status       TEXT        DEFAULT 'idle'
                                             CHECK (race_status IN ('idle','in_progress','completed')),
  ADD COLUMN IF NOT EXISTS race_started_at   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS race_ended_at     TIMESTAMPTZ;

-- ─── manual_entries ───────────────────────────────────────────────────────────
-- One row per completed leg.  Kept in sync with leg_results JSONB so the app
-- can query per-leg history without parsing JSON.

CREATE TABLE IF NOT EXISTS manual_entries (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  team_plan_id     TEXT        NOT NULL REFERENCES team_plan(id) ON DELETE CASCADE,
  leg_number       INT         NOT NULL,
  runner_id        TEXT        NOT NULL,   -- matches runner.id ("r1"…"r6")
  actual_distance  FLOAT       NOT NULL,
  start_time       TIMESTAMPTZ NOT NULL,
  end_time         TIMESTAMPTZ NOT NULL,
  elapsed_seconds  FLOAT       NOT NULL,
  actual_pace      FLOAT       NOT NULL,   -- min/mile
  edited_at        TIMESTAMPTZ,            -- set when the row was manually overridden
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- one entry per leg per team plan; upsert on re-run or edit
  UNIQUE (team_plan_id, leg_number)
);

-- Index for the most common query: all legs for a team plan in order
CREATE INDEX IF NOT EXISTS manual_entries_team_leg
  ON manual_entries (team_plan_id, leg_number);

-- Allow the anon key to read/write (RLS must be off or a policy must exist)
ALTER TABLE manual_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "allow all for anon"
  ON manual_entries
  FOR ALL
  TO anon
  USING (true)
  WITH CHECK (true);
