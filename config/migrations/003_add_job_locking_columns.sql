-- Migration 003: Add job locking columns required by the worker
-- Run this against your Supabase project via:
--   psql $DATABASE_URL -f config/migrations/003_add_job_locking_columns.sql

ALTER TABLE ai_jobs
  ADD COLUMN IF NOT EXISTS last_error   TEXT,
  ADD COLUMN IF NOT EXISTS locked_at    TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS locked_by    TEXT,
  ADD COLUMN IF NOT EXISTS next_run_at  TIMESTAMPTZ DEFAULT NOW();

-- Back-fill next_run_at for queued jobs that have no value yet
UPDATE ai_jobs SET next_run_at = created_at WHERE next_run_at IS NULL;

-- Composite indexes for worker polling efficiency
CREATE INDEX IF NOT EXISTS idx_ai_jobs_status_created
  ON ai_jobs(status, created_at);

CREATE INDEX IF NOT EXISTS idx_ai_jobs_queued_next_run
  ON ai_jobs(status, next_run_at)
  WHERE status = 'queued';

CREATE INDEX IF NOT EXISTS idx_ai_jobs_running_locked
  ON ai_jobs(status, locked_at)
  WHERE status = 'running';
