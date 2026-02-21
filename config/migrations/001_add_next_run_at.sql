-- Migration 001: Add next_run_at to ai_jobs for proper retry scheduling
-- Run this against your Supabase project via:
--   psql $DATABASE_URL -f config/migrations/001_add_next_run_at.sql

ALTER TABLE ai_jobs
  ADD COLUMN IF NOT EXISTS next_run_at TIMESTAMPTZ;

-- Update claim_next_ai_job to respect retry scheduling
CREATE OR REPLACE FUNCTION claim_next_ai_job()
RETURNS SETOF ai_jobs
LANGUAGE sql
SECURITY DEFINER
AS $$
  WITH selected_job AS (
    SELECT id
    FROM ai_jobs
    WHERE status = 'queued'
      AND retry_count < max_retries
      AND (next_run_at IS NULL OR next_run_at <= NOW())
    ORDER BY created_at ASC
    FOR UPDATE SKIP LOCKED
    LIMIT 1
  )
  UPDATE ai_jobs
  SET status = 'running',
      started_at = NOW()
  WHERE id IN (SELECT id FROM selected_job)
  RETURNING *;
$$;
