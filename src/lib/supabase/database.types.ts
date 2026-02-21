/**
 * Supabase Database Types
 * Auto-generated types matching the database schema
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          email: string;
          full_name: string | null;
          role: 'admin' | 'client';
          avatar_url: string | null;
          company_name: string | null;
          timezone: string;
          language: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email: string;
          full_name?: string | null;
          role?: 'admin' | 'client';
          avatar_url?: string | null;
          company_name?: string | null;
          timezone?: string;
          language?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          full_name?: string | null;
          role?: 'admin' | 'client';
          avatar_url?: string | null;
          company_name?: string | null;
          timezone?: string;
          language?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
      clients: {
        Row: {
          id: string;
          user_id: string;
          company_name: string | null;
          industry: string | null;
          website: string | null;
          notes: string | null;
          settings: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          company_name?: string | null;
          industry?: string | null;
          website?: string | null;
          notes?: string | null;
          settings?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          company_name?: string | null;
          industry?: string | null;
          website?: string | null;
          notes?: string | null;
          settings?: Json;
          created_at?: string;
          updated_at?: string;
        };
      };
      projects: {
        Row: {
          id: string;
          client_id: string;
          name: string;
          description: string | null;
          status: 'planning' | 'active' | 'on_hold' | 'completed' | 'archived';
          start_date: string | null;
          end_date: string | null;
          deadline: string | null;
          budget: number | null;
          currency: string;
          metadata: Json;
          created_at: string;
          updated_at: string;
          created_by: string | null;
        };
        Insert: {
          id?: string;
          client_id: string;
          name: string;
          description?: string | null;
          status?: 'planning' | 'active' | 'on_hold' | 'completed' | 'archived';
          start_date?: string | null;
          end_date?: string | null;
          deadline?: string | null;
          budget?: number | null;
          currency?: string;
          metadata?: Json;
          created_at?: string;
          updated_at?: string;
          created_by?: string | null;
        };
        Update: {
          id?: string;
          client_id?: string;
          name?: string;
          description?: string | null;
          status?: 'planning' | 'active' | 'on_hold' | 'completed' | 'archived';
          start_date?: string | null;
          end_date?: string | null;
          deadline?: string | null;
          budget?: number | null;
          currency?: string;
          metadata?: Json;
          created_at?: string;
          updated_at?: string;
          created_by?: string | null;
        };
      };
      workflows: {
        Row: {
          id: string;
          name: string;
          description: string | null;
          task_type: TaskType;
          definition: Json;
          is_active: boolean;
          created_at: string;
          updated_at: string;
          created_by: string | null;
        };
        Insert: {
          id?: string;
          name: string;
          description?: string | null;
          task_type: TaskType;
          definition: Json;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
          created_by?: string | null;
        };
        Update: {
          id?: string;
          name?: string;
          description?: string | null;
          task_type?: TaskType;
          definition?: Json;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
          created_by?: string | null;
        };
      };
      tasks: {
        Row: {
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
          metadata: Json;
          input_data: Json | null;
          output_data: Json | null;
          client_feedback: string | null;
          admin_notes: string | null;
          created_at: string;
          updated_at: string;
          completed_at: string | null;
        };
        Insert: {
          id?: string;
          project_id: string;
          workflow_id?: string | null;
          name: string;
          description?: string | null;
          type: TaskType;
          status?: TaskStatus;
          priority?: number;
          deadline?: string | null;
          estimated_hours?: number | null;
          actual_hours?: number | null;
          assigned_to?: string | null;
          assigned_agent?: string | null;
          parent_task_id?: string | null;
          metadata?: Json;
          input_data?: Json | null;
          output_data?: Json | null;
          client_feedback?: string | null;
          admin_notes?: string | null;
          created_at?: string;
          updated_at?: string;
          completed_at?: string | null;
        };
        Update: {
          id?: string;
          project_id?: string;
          workflow_id?: string | null;
          name?: string;
          description?: string | null;
          type?: TaskType;
          status?: TaskStatus;
          priority?: number;
          deadline?: string | null;
          estimated_hours?: number | null;
          actual_hours?: number | null;
          assigned_to?: string | null;
          assigned_agent?: string | null;
          parent_task_id?: string | null;
          metadata?: Json;
          input_data?: Json | null;
          output_data?: Json | null;
          client_feedback?: string | null;
          admin_notes?: string | null;
          created_at?: string;
          updated_at?: string;
          completed_at?: string | null;
        };
      };
      ai_jobs: {
        Row: {
          id: string;
          task_id: string;
          agent_name: string;
          model: string;
          provider: string;
          status: 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';
          prompt: string;
          system_prompt: string | null;
          input_data: Json;
          output_data: Json | null;
          token_usage: Json | null;
          execution_time_ms: number | null;
          error_message: string | null;
          failure_stage: string | null;
          failure_type: string | null;
          logs: Json;
          retry_count: number;
          max_retries: number;
          created_at: string;
          started_at: string | null;
          completed_at: string | null;
          created_by: string | null;
        };
        Insert: {
          id?: string;
          task_id: string;
          agent_name: string;
          model: string;
          provider: string;
          status?: 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';
          prompt: string;
          system_prompt?: string | null;
          input_data?: Json;
          output_data?: Json | null;
          token_usage?: Json | null;
          execution_time_ms?: number | null;
          error_message?: string | null;
          failure_stage?: string | null;
          failure_type?: string | null;
          logs?: Json;
          retry_count?: number;
          max_retries?: number;
          created_at?: string;
          started_at?: string | null;
          completed_at?: string | null;
          created_by?: string | null;
        };
        Update: {
          id?: string;
          task_id?: string;
          agent_name?: string;
          model?: string;
          provider?: string;
          status?: 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';
          prompt?: string;
          system_prompt?: string | null;
          input_data?: Json;
          output_data?: Json | null;
          token_usage?: Json | null;
          execution_time_ms?: number | null;
          error_message?: string | null;
          failure_stage?: string | null;
          failure_type?: string | null;
          logs?: Json;
          retry_count?: number;
          max_retries?: number;
          created_at?: string;
          started_at?: string | null;
          completed_at?: string | null;
          created_by?: string | null;
        };
      };
      workflow_executions: {
        Row: {
          id: string;
          task_id: string;
          workflow_id: string;
          status: TaskStatus;
          current_step: number;
          total_steps: number;
          context: Json;
          created_at: string;
          updated_at: string;
          completed_at: string | null;
        };
        Insert: {
          id?: string;
          task_id: string;
          workflow_id: string;
          status?: TaskStatus;
          current_step?: number;
          total_steps?: number;
          context?: Json;
          created_at?: string;
          updated_at?: string;
          completed_at?: string | null;
        };
        Update: {
          id?: string;
          task_id?: string;
          workflow_id?: string;
          status?: TaskStatus;
          current_step?: number;
          total_steps?: number;
          context?: Json;
          created_at?: string;
          updated_at?: string;
          completed_at?: string | null;
        };
      };
      workflow_step_executions: {
        Row: {
          id: string;
          execution_id: string;
          step_index: number;
          step_name: string;
          agent_name: string | null;
          status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
          input_data: Json | null;
          output_data: Json | null;
          ai_job_id: string | null;
          error_message: string | null;
          started_at: string | null;
          completed_at: string | null;
        };
        Insert: {
          id?: string;
          execution_id: string;
          step_index: number;
          step_name: string;
          agent_name?: string | null;
          status?: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
          input_data?: Json | null;
          output_data?: Json | null;
          ai_job_id?: string | null;
          error_message?: string | null;
          started_at?: string | null;
          completed_at?: string | null;
        };
        Update: {
          id?: string;
          execution_id?: string;
          step_index?: number;
          step_name?: string;
          agent_name?: string | null;
          status?: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
          input_data?: Json | null;
          output_data?: Json | null;
          ai_job_id?: string | null;
          error_message?: string | null;
          started_at?: string | null;
          completed_at?: string | null;
        };
      };
      deliverables: {
        Row: {
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
          metadata: Json;
          created_at: string;
          created_by: string | null;
        };
        Insert: {
          id?: string;
          task_id: string;
          name: string;
          description?: string | null;
          file_type?: string | null;
          file_url?: string | null;
          storage_path?: string | null;
          file_size?: number | null;
          version?: number;
          is_final?: boolean;
          metadata?: Json;
          created_at?: string;
          created_by?: string | null;
        };
        Update: {
          id?: string;
          task_id?: string;
          name?: string;
          description?: string | null;
          file_type?: string | null;
          file_url?: string | null;
          storage_path?: string | null;
          file_size?: number | null;
          version?: number;
          is_final?: boolean;
          metadata?: Json;
          created_at?: string;
          created_by?: string | null;
        };
      };
      approvals: {
        Row: {
          id: string;
          task_id: string;
          deliverable_id: string | null;
          status: string;
          requested_by: string | null;
          requested_at: string;
          responded_by: string | null;
          responded_at: string | null;
          response_notes: string | null;
          revision_requests: number;
          metadata: Json;
        };
        Insert: {
          id?: string;
          task_id: string;
          deliverable_id?: string | null;
          status: string;
          requested_by?: string | null;
          requested_at?: string;
          responded_by?: string | null;
          responded_at?: string | null;
          response_notes?: string | null;
          revision_requests?: number;
          metadata?: Json;
        };
        Update: {
          id?: string;
          task_id?: string;
          deliverable_id?: string | null;
          status?: string;
          requested_by?: string | null;
          requested_at?: string;
          responded_by?: string | null;
          responded_at?: string | null;
          response_notes?: string | null;
          revision_requests?: number;
          metadata?: Json;
        };
      };
      notifications: {
        Row: {
          id: string;
          user_id: string;
          type: string;
          title: string;
          message: string;
          data: Json;
          is_read: boolean;
          read_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          type: string;
          title: string;
          message: string;
          data?: Json;
          is_read?: boolean;
          read_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          type?: string;
          title?: string;
          message?: string;
          data?: Json;
          is_read?: boolean;
          read_at?: string | null;
          created_at?: string;
        };
      };
      activity_logs: {
        Row: {
          id: string;
          user_id: string | null;
          action: string;
          entity_type: string;
          entity_id: string;
          changes: Json | null;
          ip_address: string | null;
          user_agent: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string | null;
          action: string;
          entity_type: string;
          entity_id: string;
          changes?: Json | null;
          ip_address?: string | null;
          user_agent?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string | null;
          action?: string;
          entity_type?: string;
          entity_id?: string;
          changes?: Json | null;
          ip_address?: string | null;
          user_agent?: string | null;
          created_at?: string;
        };
      };
      api_keys: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          key_hash: string;
          key_prefix: string;
          permissions: Json;
          expires_at: string | null;
          last_used_at: string | null;
          is_active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          key_hash: string;
          key_prefix: string;
          permissions?: Json;
          expires_at?: string | null;
          last_used_at?: string | null;
          is_active?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          name?: string;
          key_hash?: string;
          key_prefix?: string;
          permissions?: Json;
          expires_at?: string | null;
          last_used_at?: string | null;
          is_active?: boolean;
          created_at?: string;
        };
      };
    };
    Views: Record<string, never>;
    Functions: {
      get_unread_notification_count: {
        Args: Record<string, never>;
        Returns: number;
      };
      get_project_stats: {
        Args: { p_client_id?: string };
        Returns: { total: number; active: number; completed: number };
      };
    };
    Enums: {
      user_role: 'admin' | 'client';
      project_status: 'planning' | 'active' | 'on_hold' | 'completed' | 'archived';
      task_type:
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
      task_status:
        | 'pending'
        | 'running'
        | 'waiting_approval'
        | 'approved'
        | 'rejected'
        | 'completed'
        | 'failed'
        | 'cancelled';
      job_status: 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';
      workflow_step_status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
      notification_type:
        | 'task_assigned'
        | 'task_completed'
        | 'approval_required'
        | 'approval_response'
        | 'system'
        | 'error';
    };
  };
}

// Type aliases for convenience
export type TaskType = Database['public']['Enums']['task_type'];
export type TaskStatus = Database['public']['Enums']['task_status'];
export type ProjectStatus = Database['public']['Enums']['project_status'];
export type UserRole = Database['public']['Enums']['user_role'];
export type JobStatus = Database['public']['Enums']['job_status'];
export type WorkflowStepStatus = Database['public']['Enums']['workflow_step_status'];
export type NotificationType = Database['public']['Enums']['notification_type'];

// Row types
export type UserRow = Database['public']['Tables']['users']['Row'];
export type ClientRow = Database['public']['Tables']['clients']['Row'];
export type ProjectRow = Database['public']['Tables']['projects']['Row'];
export type TaskRow = Database['public']['Tables']['tasks']['Row'];
export type AIJobRow = Database['public']['Tables']['ai_jobs']['Row'];
export type WorkflowRow = Database['public']['Tables']['workflows']['Row'];
export type WorkflowExecutionRow = Database['public']['Tables']['workflow_executions']['Row'];
export type WorkflowStepExecutionRow = Database['public']['Tables']['workflow_step_executions']['Row'];
export type DeliverableRow = Database['public']['Tables']['deliverables']['Row'];
export type ApprovalRow = Database['public']['Tables']['approvals']['Row'];
export type NotificationRow = Database['public']['Tables']['notifications']['Row'];
export type ActivityLogRow = Database['public']['Tables']['activity_logs']['Row'];
