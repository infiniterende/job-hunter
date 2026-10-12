-- Job Hunter schema. Idempotent: safe to re-run.

CREATE TABLE IF NOT EXISTS companies (
  id          SERIAL PRIMARY KEY,
  name        TEXT NOT NULL,
  source      TEXT NOT NULL CHECK (source IN ('greenhouse','ashby','lever')),
  board_token TEXT NOT NULL,
  active      BOOLEAN NOT NULL DEFAULT TRUE,
  last_status TEXT,
  last_fetched_at TIMESTAMPTZ,
  UNIQUE (source, board_token)
);

CREATE TABLE IF NOT EXISTS jobs (
  id              BIGSERIAL PRIMARY KEY,
  source          TEXT NOT NULL,
  external_id     TEXT NOT NULL,
  company         TEXT NOT NULL,
  title           TEXT NOT NULL,
  location        TEXT,
  is_remote       BOOLEAN NOT NULL DEFAULT FALSE,
  is_nyc          BOOLEAN NOT NULL DEFAULT FALSE,
  url             TEXT NOT NULL,          -- direct application link
  posted_at       TIMESTAMPTZ,            -- date posted (from source)
  first_seen_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  score           INTEGER NOT NULL DEFAULT 0,
  score_breakdown JSONB NOT NULL DEFAULT '{}'::jsonb,
  tags            TEXT[] NOT NULL DEFAULT '{}',
  snippet         TEXT,
  UNIQUE (source, external_id)
);
CREATE INDEX IF NOT EXISTS jobs_posted_at_idx ON jobs (posted_at DESC);
CREATE INDEX IF NOT EXISTS jobs_score_idx     ON jobs (score DESC);

-- Snapshot of the top-N ranked jobs chosen on a given day.
CREATE TABLE IF NOT EXISTS daily_picks (
  day     DATE   NOT NULL,
  rank    INTEGER NOT NULL,
  job_id  BIGINT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  PRIMARY KEY (day, rank),
  UNIQUE (day, job_id)
);

-- Jobs the user has applied to, with status tracking.
CREATE TABLE IF NOT EXISTS applications (
  id          SERIAL PRIMARY KEY,
  job_id      BIGINT NOT NULL UNIQUE REFERENCES jobs(id) ON DELETE CASCADE,
  status      TEXT NOT NULL DEFAULT 'applied'
              CHECK (status IN ('saved','applied','phone_screen','interviewing','offer','rejected','withdrawn')),
  applied_at  DATE,
  notes       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
