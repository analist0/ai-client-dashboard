-- Migration 004: Add missing indexes identified in Phase 3 audit
--
-- Missing indexes vs. actual query patterns:
--   1. approvals(status)      — worker & approval route both filter WHERE status = 'pending'
--   2. workflow_step_executions(ai_job_id) — worker's checkAndContinueWorkflow queries this on every job
--   3. workflow_executions(status) — workflow engine filters WHERE status = 'running'

CREATE INDEX IF NOT EXISTS idx_approvals_status
  ON approvals(status);

CREATE INDEX IF NOT EXISTS idx_workflow_step_executions_ai_job_id
  ON workflow_step_executions(ai_job_id);

-- Partial index: only 'running' executions need fast lookup
CREATE INDEX IF NOT EXISTS idx_workflow_executions_status_running
  ON workflow_executions(status, task_id)
  WHERE status = 'running';
