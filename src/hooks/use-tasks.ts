/**
 * useTasks Hook
 * Handles task data fetching and mutations
 */

'use client';

import { useEffect, useState, useCallback } from 'react';
import { createBrowserClient } from '@/lib/supabase/client';
import type { Task, TaskStatus, TaskType } from '@/types';

interface UseTasksOptions {
  projectId?: string;
  status?: TaskStatus;
  type?: TaskType;
  assignedTo?: string;
  limit?: number;
  enabled?: boolean;
}

export function useTasks(options: UseTasksOptions = {}) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const {
    projectId,
    status,
    type,
    assignedTo,
    limit = 100,
    enabled = true,
  } = options;

  const supabase = createBrowserClient();

  // Fetch tasks
  const fetchTasks = useCallback(async () => {
    if (!enabled) return;

    setLoading(true);
    setError(null);

    try {
      let query = supabase
        .from('tasks')
        .select('*');

      if (projectId) {
        query = query.eq('project_id', projectId);
      }

      if (status) {
        query = query.eq('status', status);
      }

      if (type) {
        query = query.eq('type', type);
      }

      if (assignedTo) {
        query = query.eq('assigned_to', assignedTo);
      }

      const { data, error: fetchError } = await query
        .order('priority', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(limit);

      if (fetchError) throw fetchError;
      setTasks(data as unknown as Task[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch tasks');
    } finally {
      setLoading(false);
    }
  }, [projectId, status, type, assignedTo, limit, enabled, supabase]);

  // Initial fetch
  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  // Get single task
  const getTask = useCallback(async (taskId: string): Promise<Task | null> => {
    try {
      const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .eq('id', taskId)
        .single();

      if (error) throw error;
      return data as unknown as Task;
    } catch {
      return null;
    }
  }, [supabase]);

  // Create task
  const createTask = useCallback(async (task: Partial<Task>): Promise<Task | null> => {
    try {
      const { data, error } = await supabase
        .from('tasks')
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .insert(task as any)
        .select()
        .single();

      if (error) throw error;

      setTasks((prev) => [data as unknown as Task, ...prev]);
      return data as unknown as Task;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create task');
      return null;
    }
  }, [supabase]);

  // Update task
  const updateTask = useCallback(async (
    taskId: string,
    updates: Partial<Task>
  ): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('tasks')
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .update(updates as any)
        .eq('id', taskId);

      if (error) throw error;

      setTasks((prev) =>
        prev.map((t) => (t.id === taskId ? { ...t, ...updates } : t))
      );
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update task');
      return false;
    }
  }, [supabase]);

  // Delete task
  const deleteTask = useCallback(async (taskId: string): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('tasks')
        .delete()
        .eq('id', taskId);

      if (error) throw error;

      setTasks((prev) => prev.filter((t) => t.id !== taskId));
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete task');
      return false;
    }
  }, [supabase]);

  // Submit client feedback
  const submitFeedback = useCallback(async (
    taskId: string,
    feedback: string
  ): Promise<boolean> => {
    return updateTask(taskId, { client_feedback: feedback });
  }, [updateTask]);

  // Request approval (admin only)
  const requestApproval = useCallback(async (taskId: string): Promise<boolean> => {
    try {
      // Update task status
      await updateTask(taskId, { status: 'waiting_approval' });

      // Create approval record
      const { error } = await supabase
        .from('approvals')
        .insert({
          task_id: taskId,
          status: 'pending',
        });

      if (error) throw error;
      return true;
    } catch {
      return false;
    }
  }, [updateTask, supabase]);

  // Respond to approval (client)
  const respondToApproval = useCallback(async (
    taskId: string,
    status: 'approved' | 'rejected' | 'revision_requested',
    notes?: string
  ): Promise<boolean> => {
    try {
      // Update approval
      const { error: approvalError } = await supabase
        .from('approvals')
        .update({
          status,
          response_notes: notes,
          responded_at: new Date().toISOString(),
        })
        .eq('task_id', taskId)
        .eq('status', 'pending');

      if (approvalError) throw approvalError;

      // Update task status
      const newTaskStatus = status === 'approved' 
        ? 'completed' 
        : status === 'rejected' 
          ? 'failed' 
          : 'running';

      await updateTask(taskId, { status: newTaskStatus as TaskStatus });

      return true;
    } catch {
      return false;
    }
  }, [updateTask, supabase]);

  // Trigger AI job for task
  const triggerAiJob = useCallback(async (
    taskId: string,
    agentName: string,
    inputData: Record<string, unknown>
  ): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('ai_jobs')
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .insert({
          task_id: taskId,
          agent_name: agentName,
          model: 'gpt-4o',
          provider: 'openai',
          status: 'queued' as const,
          prompt: JSON.stringify(inputData),
          input_data: inputData as unknown as null,
        });

      if (error) throw error;

      // Update task status
      await updateTask(taskId, { status: 'running' });

      return true;
    } catch {
      return false;
    }
  }, [updateTask, supabase]);

  // Get task with related data
  const getTaskWithDetails = useCallback(async (taskId: string) => {
    try {
      // Fetch task
      const task = await getTask(taskId);
      if (!task) return null;

      // Fetch AI jobs
      const { data: aiJobs } = await supabase
        .from('ai_jobs')
        .select('*')
        .eq('task_id', taskId)
        .order('created_at', { ascending: false });

      // Fetch approvals
      const { data: approvals } = await supabase
        .from('approvals')
        .select('*')
        .eq('task_id', taskId)
        .order('requested_at', { ascending: false });

      // Fetch deliverables
      const { data: deliverables } = await supabase
        .from('deliverables')
        .select('*')
        .eq('task_id', taskId)
        .order('created_at', { ascending: false });

      // Fetch workflow execution
      const { data: workflowExecution } = await supabase
        .from('workflow_executions')
        .select('*')
        .eq('task_id', taskId)
        .single();

      return {
        task,
        aiJobs: aiJobs || [],
        approvals: approvals || [],
        deliverables: deliverables || [],
        workflowExecution,
      };
    } catch {
      return null;
    }
  }, [getTask, supabase]);

  return {
    tasks,
    loading,
    error,
    fetchTasks,
    getTask,
    getTaskWithDetails,
    createTask,
    updateTask,
    deleteTask,
    submitFeedback,
    requestApproval,
    respondToApproval,
    triggerAiJob,
  };
}
