/**
 * AI Client Dashboard - TypeScript Type Definitions
 */

// =====================================================
// DATABASE TYPES
// =====================================================

export type UserRole = 'admin' | 'client';
export type ProjectStatus = 'planning' | 'active' | 'on_hold' | 'completed' | 'archived';
export type TaskType = 
  | 'blog_post'
  | 'research'
  | 'seo'
  | 'dev'
  | 'design'
  | 'video'
  | 'social_media'
  | 'email_campaign'
  | 'landing_page'
  | 'other';
export type TaskStatus = 
  | 'pending'
  | 'running'
  | 'waiting_approval'
  | 'approved'
  | 'rejected'
  | 'completed'
  | 'failed'
  | 'cancelled';
export type JobStatus = 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';
export type WorkflowStepStatus = 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
export type NotificationType = 
  | 'task_assigned'
  | 'task_completed'
  | 'approval_required'
  | 'approval_response'
  | 'system'
  | 'error';
export type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'revision_requested';

// =====================================================
// USER & CLIENT
// =====================================================

export interface User {
  id: string;
  email: string;
  full_name: string | null;
  role: UserRole;
  avatar_url: string | null;
  company_name: string | null;
  timezone: string;
  language: string;
  created_at: string;
  updated_at: string;
}

export interface Client {
  id: string;
  user_id: string;
  company_name: string | null;
  industry: string | null;
  website: string | null;
  notes: string | null;
  settings: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

// =====================================================
// PROJECTS & TASKS
// =====================================================

export interface Project {
  id: string;
  client_id: string;
  name: string;
  description: string | null;
  status: ProjectStatus;
  start_date: string | null;
  end_date: string | null;
  deadline: string | null;
  budget: number | null;
  currency: string;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

export interface Task {
  id: string;
  project_id: string;
  workflow_id: string | null;
  name: string;
  description: string | null;
  type: TaskType;
  status: TaskStatus;
  priority: number;
  deadline: string | null;
  estimated_hours: number | null;
  actual_hours: number | null;
  assigned_to: string | null;
  assigned_agent: string | null;
  parent_task_id: string | null;
  metadata: Record<string, unknown>;
  input_data: Record<string, unknown> | null;
  output_data: Record<string, unknown> | null;
  client_feedback: string | null;
  admin_notes: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
}

// =====================================================
// AI JOBS
// =====================================================

export interface AIJob {
  id: string;
  task_id: string;
  agent_name: string;
  model: string;
  provider: LLMProvider;
  status: JobStatus;
  prompt: string;
  system_prompt: string | null;
  input_data: Record<string, unknown>;
  output_data: Record<string, unknown> | null;
  token_usage: TokenUsage | null;
  execution_time_ms: number | null;
  error_message: string | null;
  logs: JobLog[];
  retry_count: number;
  max_retries: number;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
  created_by: string | null;
}

export interface TokenUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

export interface JobLog {
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'debug';
  message: string;
  data?: Record<string, unknown>;
}

// =====================================================
// WORKFLOWS
// =====================================================

export interface Workflow {
  id: string;
  name: string;
  description: string | null;
  task_type: TaskType;
  definition: WorkflowDefinition;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

export interface WorkflowDefinition {
  name: string;
  description?: string;
  steps: WorkflowStepDefinition[];
}

export interface WorkflowStepDefinition {
  name: string;
  agent?: string;
  type?: 'ai' | 'wait_for_approval' | 'publish' | 'custom';
  timeout_seconds?: number;
  retry_count?: number;
  condition?: string; // Conditional execution expression
  config?: Record<string, unknown>;
}

export interface WorkflowExecution {
  id: string;
  task_id: string;
  workflow_id: string;
  status: TaskStatus;
  current_step: number;
  total_steps: number;
  context: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
}

export interface WorkflowStepExecution {
  id: string;
  execution_id: string;
  step_index: number;
  step_name: string;
  agent_name: string | null;
  status: WorkflowStepStatus;
  input_data: Record<string, unknown> | null;
  output_data: Record<string, unknown> | null;
  ai_job_id: string | null;
  error_message: string | null;
  started_at: string | null;
  completed_at: string | null;
}

// =====================================================
// DELIVERABLES & APPROVALS
// =====================================================

export interface Deliverable {
  id: string;
  task_id: string;
  name: string;
  description: string | null;
  file_type: string | null;
  file_url: string | null;
  storage_path: string | null;
  file_size: number | null;
  version: number;
  is_final: boolean;
  metadata: Record<string, unknown>;
  created_at: string;
  created_by: string | null;
}

export interface Approval {
  id: string;
  task_id: string;
  deliverable_id: string | null;
  status: ApprovalStatus;
  requested_by: string | null;
  requested_at: string;
  responded_by: string | null;
  responded_at: string | null;
  response_notes: string | null;
  revision_requests: number;
  metadata: Record<string, unknown>;
}

// =====================================================
// NOTIFICATIONS & ACTIVITY
// =====================================================

export interface Notification {
  id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  message: string;
  data: Record<string, unknown>;
  is_read: boolean;
  read_at: string | null;
  created_at: string;
}

export interface ActivityLog {
  id: string;
  user_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string;
  changes: Record<string, unknown> | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
}

// =====================================================
// AI AGENT TYPES
// =====================================================

export type LLMProvider = 'openai' | 'anthropic' | 'google' | 'xai' | 'ollama';

export interface AgentConfig {
  name: string;
  provider: LLMProvider;
  model: string;
  systemPrompt: string;
  temperature?: number;
  maxTokens?: number;
  timeoutMs?: number;
  baseURL?: string;
}

export interface AgentInput {
  taskId: string;
  inputData: Record<string, unknown>;
  context?: Record<string, unknown>;
  previousOutputs?: AgentOutput[];
}

export interface AgentOutput {
  success: boolean;
  data: Record<string, unknown>;
  summary?: string;
  metadata?: {
    tokenUsage?: TokenUsage;
    executionTimeMs?: number;
    model?: string;
    failureStage?: string;
    failureType?: string;
  };
  error?: string;
}

export interface AgentExecutionResult {
  jobId: string;
  output: AgentOutput;
  logs: JobLog[];
}

// =====================================================
// API RESPONSE TYPES
// =====================================================

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// =====================================================
// DASHBOARD TYPES
// =====================================================

export interface DashboardStats {
  totalProjects: number;
  activeProjects: number;
  totalTasks: number;
  pendingTasks: number;
  completedTasks: number;
  runningAiJobs: number;
  pendingApprovals: number;
  unreadNotifications: number;
}

export interface ProjectTimeline {
  projectId: string;
  milestones: TimelineMilestone[];
}

export interface TimelineMilestone {
  id: string;
  name: string;
  date: string;
  status: 'completed' | 'upcoming' | 'overdue';
  taskId?: string;
}

// =====================================================
// FORM TYPES
// =====================================================

export interface CreateProjectForm {
  name: string;
  description?: string;
  status?: ProjectStatus;
  start_date?: string;
  deadline?: string;
  budget?: number;
  currency?: string;
}

export interface CreateTaskForm {
  name: string;
  description?: string;
  type: TaskType;
  priority?: number;
  deadline?: string;
  estimated_hours?: number;
  assigned_agent?: string;
  workflow_id?: string;
  input_data?: Record<string, unknown>;
}

export interface ApprovalResponse {
  status: 'approved' | 'rejected' | 'revision_requested';
  notes?: string;
}
