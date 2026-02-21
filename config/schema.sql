-- =====================================================
-- AI Client Dashboard - Supabase Database Schema
-- =====================================================
-- This schema includes all tables, enums, RLS policies,
-- and triggers for the AI-powered client dashboard system.
-- =====================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =====================================================
-- ENUMS
-- =====================================================

-- User roles in the system
CREATE TYPE user_role AS ENUM ('admin', 'client');

-- Project status
CREATE TYPE project_status AS ENUM (
  'planning',
  'active',
  'on_hold',
  'completed',
  'archived'
);

-- Task types
CREATE TYPE task_type AS ENUM (
  'blog_post',
  'research',
  'seo',
  'dev',
  'design',
  'video',
  'social_media',
  'email_campaign',
  'landing_page',
  'other'
);

-- Task status
CREATE TYPE task_status AS ENUM (
  'pending',
  'running',
  'waiting_approval',
  'approved',
  'rejected',
  'completed',
  'failed',
  'cancelled'
);

-- AI Job status
CREATE TYPE job_status AS ENUM (
  'queued',
  'running',
  'completed',
  'failed',
  'cancelled'
);

-- Workflow step status
CREATE TYPE workflow_step_status AS ENUM (
  'pending',
  'running',
  'completed',
  'failed',
  'skipped'
);

-- Notification types
CREATE TYPE notification_type AS ENUM (
  'task_assigned',
  'task_completed',
  'approval_required',
  'approval_response',
  'system',
  'error'
);

-- =====================================================
-- TABLES
-- =====================================================

-- Users table (extends Supabase auth.users)
CREATE TABLE users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  full_name TEXT,
  role user_role NOT NULL DEFAULT 'client',
  avatar_url TEXT,
  company_name TEXT,
  timezone TEXT DEFAULT 'UTC',
  language TEXT DEFAULT 'en',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Clients table (additional client-specific data)
CREATE TABLE clients (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  company_name TEXT,
  industry TEXT,
  website TEXT,
  notes TEXT,
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Projects table
CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  status project_status NOT NULL DEFAULT 'planning',
  start_date DATE,
  end_date DATE,
  deadline DATE,
  budget DECIMAL(12, 2),
  currency TEXT DEFAULT 'USD',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES users(id)
);

-- Workflows table (defines reusable workflow templates)
CREATE TABLE workflows (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  task_type task_type NOT NULL,
  definition JSONB NOT NULL, -- YAML/JSON workflow definition
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES users(id)
);

-- Tasks table
CREATE TABLE tasks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  workflow_id UUID REFERENCES workflows(id),
  name TEXT NOT NULL,
  description TEXT,
  type task_type NOT NULL,
  status task_status NOT NULL DEFAULT 'pending',
  priority INTEGER NOT NULL DEFAULT 5 CHECK (priority BETWEEN 1 AND 10),
  deadline TIMESTAMPTZ,
  estimated_hours DECIMAL(6, 2),
  actual_hours DECIMAL(6, 2),
  assigned_to UUID REFERENCES users(id),
  assigned_agent TEXT, -- AI agent name if assigned to AI
  parent_task_id UUID REFERENCES tasks(id),
  metadata JSONB DEFAULT '{}',
  input_data JSONB, -- Input data for AI tasks
  output_data JSONB, -- Output data from AI tasks
  client_feedback TEXT,
  admin_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- AI Jobs table (tracks each AI execution)
CREATE TABLE ai_jobs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  agent_name TEXT NOT NULL,
  model TEXT NOT NULL,
  provider TEXT NOT NULL, -- openai, anthropic, google, ollama
  status job_status NOT NULL DEFAULT 'queued',
  prompt TEXT NOT NULL,
  system_prompt TEXT,
  input_data JSONB NOT NULL DEFAULT '{}',
  output_data JSONB,
  token_usage JSONB, -- {prompt_tokens, completion_tokens, total_tokens}
  execution_time_ms INTEGER,
  error_message TEXT,
  failure_stage TEXT, -- llm_call | parse | validation | timeout
  failure_type TEXT,  -- timeout | schema_mismatch | network | rate_limit | invalid_input
  logs JSONB DEFAULT '[]',
  retry_count INTEGER NOT NULL DEFAULT 0,
  max_retries INTEGER NOT NULL DEFAULT 3,
  last_error TEXT,
  locked_at TIMESTAMPTZ,
  locked_by TEXT,
  next_run_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_by UUID REFERENCES users(id)
);

-- Workflow executions table (tracks workflow progress)
CREATE TABLE workflow_executions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  workflow_id UUID NOT NULL REFERENCES workflows(id),
  status task_status NOT NULL DEFAULT 'pending',
  current_step INTEGER NOT NULL DEFAULT 0,
  total_steps INTEGER NOT NULL DEFAULT 0,
  context JSONB DEFAULT '{}', -- Shared context across steps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- Workflow step executions table
CREATE TABLE workflow_step_executions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  execution_id UUID NOT NULL REFERENCES workflow_executions(id) ON DELETE CASCADE,
  step_index INTEGER NOT NULL,
  step_name TEXT NOT NULL,
  agent_name TEXT,
  status workflow_step_status NOT NULL DEFAULT 'pending',
  input_data JSONB,
  output_data JSONB,
  ai_job_id UUID REFERENCES ai_jobs(id),
  error_message TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  UNIQUE(execution_id, step_index)
);

-- Deliverables table
CREATE TABLE deliverables (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  file_type TEXT,
  file_url TEXT,
  storage_path TEXT, -- Supabase storage path
  file_size BIGINT,
  version INTEGER NOT NULL DEFAULT 1,
  is_final BOOLEAN NOT NULL DEFAULT false,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES users(id)
);

-- Approvals table (client approval tracking)
CREATE TABLE approvals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  deliverable_id UUID REFERENCES deliverables(id),
  status TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'rejected', 'revision_requested')),
  requested_by UUID REFERENCES users(id),
  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  responded_by UUID,
  responded_at TIMESTAMPTZ,
  response_notes TEXT,
  revision_requests INTEGER NOT NULL DEFAULT 0,
  metadata JSONB DEFAULT '{}'
);

-- Notifications table
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type notification_type NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  data JSONB DEFAULT '{}',
  is_read BOOLEAN NOT NULL DEFAULT false,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Activity logs table (audit trail)
CREATE TABLE activity_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id),
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  changes JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- API keys table (for external integrations)
CREATE TABLE api_keys (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  key_hash TEXT NOT NULL,
  key_prefix TEXT NOT NULL, -- For display purposes (e.g., "sk_live_...")
  permissions JSONB DEFAULT '{}',
  expires_at TIMESTAMPTZ,
  last_used_at TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =====================================================
-- INDEXES
-- =====================================================

CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_clients_user_id ON clients(user_id);
CREATE INDEX idx_projects_client_id ON projects(client_id);
CREATE INDEX idx_projects_status ON projects(status);
CREATE INDEX idx_tasks_project_id ON tasks(project_id);
CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_tasks_type ON tasks(type);
CREATE INDEX idx_tasks_assigned_to ON tasks(assigned_to);
CREATE INDEX idx_ai_jobs_task_id ON ai_jobs(task_id);
CREATE INDEX idx_ai_jobs_status ON ai_jobs(status);
CREATE INDEX idx_ai_jobs_agent_name ON ai_jobs(agent_name);
-- Composite indexes for worker polling efficiency
CREATE INDEX idx_ai_jobs_status_created ON ai_jobs(status, created_at);
CREATE INDEX idx_ai_jobs_queued_next_run ON ai_jobs(status, next_run_at) WHERE status = 'queued';
CREATE INDEX idx_ai_jobs_running_locked ON ai_jobs(status, locked_at) WHERE status = 'running';
CREATE INDEX idx_workflow_executions_task_id ON workflow_executions(task_id);
CREATE INDEX idx_workflow_step_executions_execution_id ON workflow_step_executions(execution_id);
CREATE INDEX idx_deliverables_task_id ON deliverables(task_id);
CREATE INDEX idx_approvals_task_id ON approvals(task_id);
CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_is_read ON notifications(is_read);
CREATE INDEX idx_activity_logs_entity ON activity_logs(entity_type, entity_id);
CREATE INDEX idx_activity_logs_created_at ON activity_logs(created_at DESC);
CREATE INDEX idx_api_keys_user_id ON api_keys(user_id);

-- =====================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- =====================================================

-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflows ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_step_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE deliverables ENABLE ROW LEVEL SECURITY;
ALTER TABLE approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- USERS TABLE POLICIES
-- =====================================================

-- Users can view their own data
CREATE POLICY users_select_own ON users
  FOR SELECT
  USING (auth.uid() = id);

-- Admins can view all users
CREATE POLICY users_select_all_admin ON users
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Users can update their own data
CREATE POLICY users_update_own ON users
  FOR UPDATE
  USING (auth.uid() = id);

-- Admins can update all users
CREATE POLICY users_update_all_admin ON users
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- =====================================================
-- CLIENTS TABLE POLICIES
-- =====================================================

-- Clients can view their own client data
CREATE POLICY clients_select_own ON clients
  FOR SELECT
  USING (user_id = auth.uid());

-- Admins can view all clients
CREATE POLICY clients_select_all_admin ON clients
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Admins can insert/update/delete clients
CREATE POLICY clients_admin_all ON clients
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- =====================================================
-- PROJECTS TABLE POLICIES
-- =====================================================

-- Clients can view their own projects
CREATE POLICY projects_select_own ON projects
  FOR SELECT
  USING (
    client_id IN (
      SELECT id FROM clients WHERE user_id = auth.uid()
    )
  );

-- Admins can view all projects
CREATE POLICY projects_select_all_admin ON projects
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Admins can insert/update/delete projects
CREATE POLICY projects_admin_all ON projects
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- =====================================================
-- WORKFLOWS TABLE POLICIES
-- =====================================================

-- Everyone can view active workflows
CREATE POLICY workflows_select_active ON workflows
  FOR SELECT
  USING (is_active = true);

-- Admins can manage all workflows
CREATE POLICY workflows_admin_all ON workflows
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- =====================================================
-- TASKS TABLE POLICIES
-- =====================================================

-- Clients can view tasks in their projects
CREATE POLICY tasks_select_own ON tasks
  FOR SELECT
  USING (
    project_id IN (
      SELECT id FROM projects WHERE client_id IN (
        SELECT id FROM clients WHERE user_id = auth.uid()
      )
    )
  );

-- Admins can view all tasks
CREATE POLICY tasks_select_all_admin ON tasks
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Admins can insert/update/delete tasks
CREATE POLICY tasks_admin_all ON tasks
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Clients can update feedback on their tasks
CREATE POLICY tasks_update_feedback_client ON tasks
  FOR UPDATE
  USING (
    project_id IN (
      SELECT id FROM projects WHERE client_id IN (
        SELECT id FROM clients WHERE user_id = auth.uid()
      )
    )
  )
  WITH CHECK (
    project_id IN (
      SELECT id FROM projects WHERE client_id IN (
        SELECT id FROM clients WHERE user_id = auth.uid()
      )
    )
  );

-- =====================================================
-- AI JOBS TABLE POLICIES
-- =====================================================

-- Users can view AI jobs for their tasks
CREATE POLICY ai_jobs_select_own ON ai_jobs
  FOR SELECT
  USING (
    task_id IN (
      SELECT id FROM tasks WHERE project_id IN (
        SELECT id FROM projects WHERE client_id IN (
          SELECT id FROM clients WHERE user_id = auth.uid()
        )
      )
    )
    OR
    EXISTS (
      SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Admins can manage all AI jobs
CREATE POLICY ai_jobs_admin_all ON ai_jobs
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- =====================================================
-- WORKFLOW EXECUTIONS TABLE POLICIES
-- =====================================================

CREATE POLICY workflow_executions_select_own ON workflow_executions
  FOR SELECT
  USING (
    task_id IN (
      SELECT id FROM tasks WHERE project_id IN (
        SELECT id FROM projects WHERE client_id IN (
          SELECT id FROM clients WHERE user_id = auth.uid()
        )
      )
    )
    OR
    EXISTS (
      SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY workflow_executions_admin_all ON workflow_executions
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- =====================================================
-- WORKFLOW STEP EXECUTIONS TABLE POLICIES
-- =====================================================

CREATE POLICY workflow_step_executions_select_own ON workflow_step_executions
  FOR SELECT
  USING (
    execution_id IN (
      SELECT id FROM workflow_executions WHERE task_id IN (
        SELECT id FROM tasks WHERE project_id IN (
          SELECT id FROM projects WHERE client_id IN (
            SELECT id FROM clients WHERE user_id = auth.uid()
          )
        )
      )
    )
    OR
    EXISTS (
      SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY workflow_step_executions_admin_all ON workflow_step_executions
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- =====================================================
-- DELIVERABLES TABLE POLICIES
-- =====================================================

-- Clients can view deliverables for their tasks
CREATE POLICY deliverables_select_own ON deliverables
  FOR SELECT
  USING (
    task_id IN (
      SELECT id FROM tasks WHERE project_id IN (
        SELECT id FROM projects WHERE client_id IN (
          SELECT id FROM clients WHERE user_id = auth.uid()
        )
      )
    )
    OR
    EXISTS (
      SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Admins can manage all deliverables
CREATE POLICY deliverables_admin_all ON deliverables
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- =====================================================
-- APPROVALS TABLE POLICIES
-- =====================================================

-- Users can view approvals for their tasks
CREATE POLICY approvals_select_own ON approvals
  FOR SELECT
  USING (
    task_id IN (
      SELECT id FROM tasks WHERE project_id IN (
        SELECT id FROM projects WHERE client_id IN (
          SELECT id FROM clients WHERE user_id = auth.uid()
        )
      )
    )
    OR
    EXISTS (
      SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Clients can respond to approvals for their tasks
CREATE POLICY approvals_respond_client ON approvals
  FOR UPDATE
  USING (
    task_id IN (
      SELECT id FROM tasks WHERE project_id IN (
        SELECT id FROM projects WHERE client_id IN (
          SELECT id FROM clients WHERE user_id = auth.uid()
        )
      )
    )
  );

-- Admins can manage all approvals
CREATE POLICY approvals_admin_all ON approvals
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- =====================================================
-- NOTIFICATIONS TABLE POLICIES
-- =====================================================

-- Users can view and update their own notifications
CREATE POLICY notifications_select_own ON notifications
  FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY notifications_update_own ON notifications
  FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY notifications_delete_own ON notifications
  FOR DELETE
  USING (user_id = auth.uid());

-- Admins can insert notifications for any user
CREATE POLICY notifications_insert_admin ON notifications
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- =====================================================
-- ACTIVITY LOGS TABLE POLICIES
-- =====================================================

-- Users can view activity logs for their entities
CREATE POLICY activity_logs_select_own ON activity_logs
  FOR SELECT
  USING (
    user_id = auth.uid()
    OR
    entity_id IN (
      SELECT id FROM tasks WHERE project_id IN (
        SELECT id FROM projects WHERE client_id IN (
          SELECT id FROM clients WHERE user_id = auth.uid()
        )
      )
    )
    OR
    EXISTS (
      SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Admins can insert activity logs
CREATE POLICY activity_logs_insert_admin ON activity_logs
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- =====================================================
-- API KEYS TABLE POLICIES
-- =====================================================

-- Users can view and manage their own API keys
CREATE POLICY api_keys_select_own ON api_keys
  FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY api_keys_insert_own ON api_keys
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY api_keys_update_own ON api_keys
  FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY api_keys_delete_own ON api_keys
  FOR DELETE
  USING (user_id = auth.uid());

-- =====================================================
-- FUNCTIONS AND TRIGGERS
-- =====================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at trigger to relevant tables
CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_clients_updated_at
  BEFORE UPDATE ON clients
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_projects_updated_at
  BEFORE UPDATE ON projects
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_workflows_updated_at
  BEFORE UPDATE ON workflows
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_tasks_updated_at
  BEFORE UPDATE ON tasks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_workflow_executions_updated_at
  BEFORE UPDATE ON workflow_executions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to create user record on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO users (id, email, role, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(
      (SELECT role FROM users WHERE email = NEW.email LIMIT 1),
      'client'
    ),
    NEW.raw_user_meta_data->>'full_name'
  )
  ON CONFLICT (id) DO UPDATE SET
    email = NEW.email,
    full_name = COALESCE(NEW.raw_user_meta_data->>'full_name', users.full_name);
  
  -- Create client record for new users
  INSERT INTO clients (user_id)
  VALUES (NEW.id)
  ON CONFLICT DO NOTHING;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to handle new user signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Function to log activity
CREATE OR REPLACE FUNCTION log_activity(
  p_action TEXT,
  p_entity_type TEXT,
  p_entity_id UUID,
  p_changes JSONB DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
  INSERT INTO activity_logs (user_id, action, entity_type, entity_id, changes, ip_address)
  VALUES (
    auth.uid(),
    p_action,
    p_entity_type,
    p_entity_id,
    p_changes,
    NULL -- IP address would need to be passed from application
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to create notification
CREATE OR REPLACE FUNCTION create_notification(
  p_user_id UUID,
  p_type notification_type,
  p_title TEXT,
  p_message TEXT,
  p_data JSONB DEFAULT '{}'
)
RETURNS UUID AS $$
DECLARE
  v_notification_id UUID;
BEGIN
  INSERT INTO notifications (user_id, type, title, message, data)
  VALUES (p_user_id, p_type, p_title, p_message, p_data)
  RETURNING id INTO v_notification_id;
  
  RETURN v_notification_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get unread notification count
CREATE OR REPLACE FUNCTION get_unread_notification_count()
RETURNS INTEGER AS $$
BEGIN
  RETURN (
    SELECT COUNT(*)::INTEGER
    FROM notifications
    WHERE user_id = auth.uid() AND is_read = false
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- STORAGE BUCKETS
-- =====================================================

-- Note: Storage buckets need to be created via Supabase dashboard or API
-- The following SQL can be used to set up RLS policies for storage

-- Example storage policy (uncomment and adapt as needed):
-- CREATE POLICY "Users can view deliverables in their projects"
--   ON storage.objects FOR SELECT
--   USING (
--     bucket_id = 'deliverables'
--     AND EXISTS (
--       SELECT 1 FROM tasks t
--       JOIN projects p ON t.project_id = p.id
--       JOIN clients c ON p.client_id = c.id
--       WHERE c.user_id = auth.uid()
--     )
--   );

-- =====================================================
-- RPC FUNCTIONS FOR WORKER
-- =====================================================

/**
 * Claim next available job with row-level locking
 * Prevents multiple workers from processing the same job
 * Uses SKIP LOCKED to avoid blocking on locked rows
 */
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

/**
 * Reap stuck jobs that have been running too long
 * Returns jobs to queued status for retry
 * Call this periodically (e.g., every 5 minutes)
 */
CREATE OR REPLACE FUNCTION reap_stuck_jobs(
  timeout_minutes INTEGER DEFAULT 30
)
RETURNS SETOF ai_jobs
LANGUAGE sql
SECURITY DEFINER
AS $$
  UPDATE ai_jobs
  SET status = 'queued',
      started_at = NULL,
      error_message = COALESCE(error_message, '') || ' [Reaped: timeout after ' || timeout_minutes || ' minutes]'
  WHERE status = 'running'
    AND started_at < NOW() - (timeout_minutes || ' minutes')::INTERVAL
  RETURNING *;
$$;

/**
 * Get jobs ready for retry with exponential backoff
 * Calculates next_run_at based on retry count
 */
CREATE OR REPLACE FUNCTION get_jobs_ready_for_retry()
RETURNS SETOF ai_jobs
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT *
  FROM ai_jobs
  WHERE status = 'queued'
    AND retry_count > 0
    AND (
      -- Simple backoff: 2^retry_count seconds, capped at 10 minutes
      NOW() >= created_at + (LEAST(POWER(2, retry_count), 600) || ' seconds')::INTERVAL
    )
  ORDER BY created_at ASC;
$$;

/**
 * Get dashboard stats (for caching/optimization)
 */
CREATE OR REPLACE FUNCTION get_dashboard_stats(p_user_id UUID DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result JSONB;
BEGIN
  SELECT jsonb_build_object(
    'total_projects', (SELECT COUNT(*) FROM projects WHERE client_id IN (SELECT id FROM clients WHERE user_id = p_user_id)),
    'active_projects', (SELECT COUNT(*) FROM projects WHERE status = 'active' AND client_id IN (SELECT id FROM clients WHERE user_id = p_user_id)),
    'total_tasks', (SELECT COUNT(*) FROM tasks WHERE project_id IN (SELECT id FROM projects WHERE client_id IN (SELECT id FROM clients WHERE user_id = p_user_id))),
    'pending_tasks', (SELECT COUNT(*) FROM tasks WHERE status = 'pending'),
    'running_jobs', (SELECT COUNT(*) FROM ai_jobs WHERE status = 'running'),
    'pending_approvals', (SELECT COUNT(*) FROM approvals WHERE status = 'pending')
  ) INTO result;
  
  RETURN result;
END;
$$;

-- =====================================================
-- INDEXES FOR WORKER PERFORMANCE
-- =====================================================

-- Index for job claiming (status + created_at)
CREATE INDEX IF NOT EXISTS idx_ai_jobs_status_created ON ai_jobs(status, created_at ASC) WHERE status = 'queued';

-- Index for stuck job reaping
CREATE INDEX IF NOT EXISTS idx_ai_jobs_running_started ON ai_jobs(started_at) WHERE status = 'running';

-- Index for retry backoff
CREATE INDEX IF NOT EXISTS idx_ai_jobs_retry ON ai_jobs(status, retry_count) WHERE status = 'queued';

-- =====================================================
-- SEED DATA (Optional - for development)
-- =====================================================

-- Uncomment to insert sample workflows
-- INSERT INTO workflows (name, description, task_type, definition, created_by) VALUES
-- ('Blog Post Workflow', 'Complete blog post creation workflow', 'blog_post', 
--  '{"steps": [{"name": "research", "agent": "ResearchAgent"}, {"name": "writing", "agent": "WriterAgent"}, {"name": "editing", "agent": "EditorAgent"}, {"name": "seo", "agent": "SeoAgent"}, {"name": "approval", "type": "wait_for_approval"}, {"name": "publish", "type": "publish"}]}',
--  NULL),
-- ('SEO Audit Workflow', 'Comprehensive SEO analysis', 'seo',
--  '{"steps": [{"name": "analysis", "agent": "SeoAgent"}, {"name": "report", "agent": "WriterAgent"}, {"name": "approval", "type": "wait_for_approval"}]}',
--  NULL);
