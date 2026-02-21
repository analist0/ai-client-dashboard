/**
 * useTaskRealtime
 * Subscribes to live changes for a task's ai_jobs, approvals, and workflow_executions.
 * Calls onUpdate whenever any of those tables change for the given taskId.
 */

'use client';

import { useEffect, useRef } from 'react';
import { createBrowserClient } from '@/lib/supabase/client';
import type { RealtimeChannel } from '@supabase/supabase-js';

interface UseTaskRealtimeOptions {
  taskId: string;
  onUpdate: () => void;
}

export function useTaskRealtime({ taskId, onUpdate }: UseTaskRealtimeOptions) {
  const channelRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    if (!taskId) return;

    const supabase = createBrowserClient();

    const channel = supabase
      .channel(`task-${taskId}`)
      // ai_jobs changes for this task
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'ai_jobs',
          filter: `task_id=eq.${taskId}`,
        },
        () => onUpdate()
      )
      // approvals changes for this task
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'approvals',
          filter: `task_id=eq.${taskId}`,
        },
        () => onUpdate()
      )
      // tasks row change (status, output_data)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'tasks',
          filter: `id=eq.${taskId}`,
        },
        () => onUpdate()
      )
      // workflow_executions changes for this task
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'workflow_executions',
          filter: `task_id=eq.${taskId}`,
        },
        () => onUpdate()
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
    };
  }, [taskId, onUpdate]);
}
