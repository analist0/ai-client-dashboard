-- =====================================================
-- Migration 002: Align actual DB schema with application code
-- Run this in Supabase SQL Editor or via psql
-- =====================================================

-- Add 'revision_requested' to approval_status enum
ALTER TYPE approval_status ADD VALUE IF NOT EXISTS 'revision_requested';

-- =====================================================
-- Extend ai_jobs with columns the worker expects
-- =====================================================
ALTER TABLE ai_jobs
  ADD COLUMN IF NOT EXISTS model           TEXT DEFAULT 'gpt-4o-mini',
  ADD COLUMN IF NOT EXISTS provider        TEXT DEFAULT 'openai',
  ADD COLUMN IF NOT EXISTS prompt          TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS input_data      JSONB,
  ADD COLUMN IF NOT EXISTS output_data     JSONB,
  ADD COLUMN IF NOT EXISTS retry_count     INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS max_retries     INTEGER DEFAULT 3,
  ADD COLUMN IF NOT EXISTS error_message   TEXT,
  ADD COLUMN IF NOT EXISTS failure_stage   TEXT,
  ADD COLUMN IF NOT EXISTS failure_type    TEXT,
  ADD COLUMN IF NOT EXISTS logs            JSONB DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS started_at      TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS completed_at    TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS execution_time_ms INTEGER,
  ADD COLUMN IF NOT EXISTS token_usage     JSONB,
  ADD COLUMN IF NOT EXISTS system_prompt   TEXT;

-- Back-fill from existing columns (idempotent)
UPDATE ai_jobs SET input_data  = input      WHERE input_data  IS NULL;
UPDATE ai_jobs SET output_data = output     WHERE output_data IS NULL;
UPDATE ai_jobs SET retry_count = attempts   WHERE retry_count = 0;
UPDATE ai_jobs SET max_retries = max_attempts WHERE max_retries = 3 AND max_attempts <> 3;
UPDATE ai_jobs SET error_message = last_error WHERE error_message IS NULL AND last_error IS NOT NULL;

-- =====================================================
-- Extend approvals with columns the API route expects
-- =====================================================
ALTER TABLE approvals
  ADD COLUMN IF NOT EXISTS metadata          JSONB DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS response_notes    TEXT,
  ADD COLUMN IF NOT EXISTS requested_by      UUID,
  ADD COLUMN IF NOT EXISTS responded_by      UUID,
  ADD COLUMN IF NOT EXISTS revision_requests INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS deliverable_id    UUID;

-- =====================================================
-- Extend tasks with columns the code expects
-- =====================================================
ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS completed_at   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS assigned_agent TEXT,
  ADD COLUMN IF NOT EXISTS description    TEXT,
  ADD COLUMN IF NOT EXISTS priority       INTEGER DEFAULT 5;

-- =====================================================
-- Create workflows table
-- =====================================================
CREATE TABLE IF NOT EXISTS workflows (
  id          UUID    PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        TEXT    NOT NULL UNIQUE,
  description TEXT,
  task_type   TEXT    NOT NULL DEFAULT 'other',
  definition  JSONB   NOT NULL,
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =====================================================
-- Create workflow_executions table
-- =====================================================
CREATE TABLE IF NOT EXISTS workflow_executions (
  id           UUID    PRIMARY KEY DEFAULT uuid_generate_v4(),
  task_id      UUID    NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  workflow_id  UUID    NOT NULL REFERENCES workflows(id),
  status       TEXT    NOT NULL DEFAULT 'running',
  current_step INTEGER NOT NULL DEFAULT 0,
  total_steps  INTEGER NOT NULL DEFAULT 0,
  context      JSONB   DEFAULT '{}',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- =====================================================
-- Create workflow_step_executions table
-- =====================================================
CREATE TABLE IF NOT EXISTS workflow_step_executions (
  id           UUID    PRIMARY KEY DEFAULT uuid_generate_v4(),
  execution_id UUID    NOT NULL REFERENCES workflow_executions(id) ON DELETE CASCADE,
  step_index   INTEGER NOT NULL,
  step_name    TEXT    NOT NULL,
  agent_name   TEXT,
  status       TEXT    NOT NULL DEFAULT 'pending',
  input_data   JSONB,
  output_data  JSONB,
  ai_job_id    UUID    REFERENCES ai_jobs(id),
  error_message TEXT,
  started_at   TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  UNIQUE(execution_id, step_index)
);

-- =====================================================
-- Create deliverables table
-- =====================================================
CREATE TABLE IF NOT EXISTS deliverables (
  id          UUID    PRIMARY KEY DEFAULT uuid_generate_v4(),
  task_id     UUID    NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  name        TEXT    NOT NULL,
  description TEXT,
  content     JSONB,
  file_type   TEXT,
  file_url    TEXT,
  storage_path TEXT,
  file_size   BIGINT,
  version     INTEGER NOT NULL DEFAULT 1,
  is_final    BOOLEAN NOT NULL DEFAULT false,
  metadata    JSONB   DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =====================================================
-- Update claim_next_ai_job to support no-arg call
-- (create overloaded version with default worker_id)
-- =====================================================
CREATE OR REPLACE FUNCTION public.claim_next_ai_job(worker_id text DEFAULT 'default')
RETURNS ai_jobs
LANGUAGE plpgsql
AS $$
DECLARE
  job public.ai_jobs;
BEGIN
  SELECT *
    INTO job
    FROM public.ai_jobs
    WHERE status = 'queued'
      AND next_run_at <= now()
      AND attempts < max_attempts
    ORDER BY created_at ASC
    LIMIT 1
    FOR UPDATE SKIP LOCKED;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  UPDATE public.ai_jobs
    SET status    = 'running',
        locked_at = now(),
        locked_by = worker_id,
        attempts  = attempts + 1,
        retry_count = attempts + 1,
        started_at  = COALESCE(started_at, now()),
        updated_at  = now()
    WHERE id = job.id;

  -- Return the updated row
  SELECT * INTO job FROM public.ai_jobs WHERE id = job.id;
  RETURN job;
END;
$$;

-- =====================================================
-- RLS: allow service role full access to new tables
-- =====================================================
ALTER TABLE workflows              ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_executions    ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_step_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE deliverables           ENABLE ROW LEVEL SECURITY;

-- Service role bypasses RLS automatically.
-- Grant anon/authenticated read on workflows (public templates):
CREATE POLICY IF NOT EXISTS "workflows_read_all"
  ON workflows FOR SELECT USING (true);

-- workflow_executions / step_executions: owner via task→project
CREATE POLICY IF NOT EXISTS "wf_exec_owner"
  ON workflow_executions FOR ALL
  USING (EXISTS (
    SELECT 1 FROM tasks t JOIN projects p ON p.id = t.project_id
    WHERE t.id = workflow_executions.task_id AND p.owner_id = auth.uid()
  ));

CREATE POLICY IF NOT EXISTS "wf_step_exec_owner"
  ON workflow_step_executions FOR ALL
  USING (EXISTS (
    SELECT 1 FROM workflow_executions we
      JOIN tasks t  ON t.id  = we.task_id
      JOIN projects p ON p.id = t.project_id
    WHERE we.id = workflow_step_executions.execution_id
      AND p.owner_id = auth.uid()
  ));

CREATE POLICY IF NOT EXISTS "deliverables_owner"
  ON deliverables FOR ALL
  USING (EXISTS (
    SELECT 1 FROM tasks t JOIN projects p ON p.id = t.project_id
    WHERE t.id = deliverables.task_id AND p.owner_id = auth.uid()
  ));

-- Indexes for new tables
CREATE INDEX IF NOT EXISTS idx_wf_exec_task_id      ON workflow_executions(task_id);
CREATE INDEX IF NOT EXISTS idx_wf_step_exec_exec_id ON workflow_step_executions(execution_id);
CREATE INDEX IF NOT EXISTS idx_wf_step_exec_job_id  ON workflow_step_executions(ai_job_id);
CREATE INDEX IF NOT EXISTS idx_deliverables_task_id ON deliverables(task_id);
