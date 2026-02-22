/**
 * useRealtime Hook
 * Generic hook for subscribing to realtime Supabase changes
 */

'use client';

import { useEffect, useState, useCallback } from 'react';
import { createBrowserClient } from '@/lib/supabase/client';

interface UseRealtimeOptions<T> {
  table: string;
  filter?: string; // e.g., 'status=eq.running'
  orderBy?: string;
  ascending?: boolean;
  limit?: number;
  onChange?: (items: T[]) => void;
}

export function useRealtime<T>({
  table,
  filter,
  orderBy,
  ascending = true,
  limit = 100,
  onChange,
}: UseRealtimeOptions<T>) {
  const [data, setData] = useState<T[]>([]);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const supabase = createBrowserClient();

  // Initial fetch
  const fetchData = useCallback(async () => {
    try {
      let query = supabase.from(table).select('*');

      if (filter) {
        const [column, , value] = filter.split(/[.=]/);
        query = query.eq(column, value);
      }

      if (orderBy) {
        query = query.order(orderBy, { ascending });
      }

      query = query.limit(limit);

      const { data: result, error: fetchError } = await query;

      if (fetchError) throw fetchError;
      setData(result as unknown as T[]);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch data');
    }
  }, [table, filter, orderBy, ascending, limit, supabase]);

  // Setup realtime subscription
  useEffect(() => {
    fetchData();

    const channelName = `${table}_channel`;
    const channel = supabase.channel(channelName);

    // Subscribe to table changes
    channel.on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table,
        ...(filter && (() => {
          const [column, , value] = filter.split(/[.=]/);
          return { filter: `${column}=eq.${value}` };
        })()),
      },
      (payload) => {
        if (payload.eventType === 'INSERT') {
          setData((prev) => {
            const newData = [payload.new as unknown as T, ...prev];
            if (onChange) onChange(newData);
            return limit ? newData.slice(0, limit) : newData;
          });
        } else if (payload.eventType === 'UPDATE') {
          setData((prev) => {
            const newData = prev.map((item) =>
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              (item as any).id === (payload.new as any).id
                ? { ...item, ...payload.new }
                : item
            );
            if (onChange) onChange(newData);
            return newData;
          });
        } else if (payload.eventType === 'DELETE') {
          setData((prev) => {
            const newData = prev.filter(
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              (item) => (item as any).id !== (payload.old as any).id
            );
            if (onChange) onChange(newData);
            return newData;
          });
        }
      }
    );

    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        setConnected(true);
      } else if (status === 'CHANNEL_ERROR') {
        setConnected(false);
        setError('Realtime connection error');
      }
    });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [table, filter, supabase, fetchData, onChange, limit]);

  // Refresh data manually
  const refresh = useCallback(() => {
    return fetchData();
  }, [fetchData]);

  return {
    data,
    connected,
    loading: data.length === 0 && !error,
    error,
    refresh,
  };
}

// =====================================================
// SPECIALIZED REALTIME HOOKS
// =====================================================

/**
 * Realtime tasks hook
 */
export function useRealtimeTasks(projectId?: string) {
  return useRealtime({
    table: 'tasks',
    filter: projectId ? `project_id=eq.${projectId}` : undefined,
    orderBy: 'priority',
    ascending: false,
  });
}

/**
 * Realtime AI jobs hook
 */
export function useRealtimeAiJobs(taskId?: string) {
  return useRealtime({
    table: 'ai_jobs',
    filter: taskId ? `task_id=eq.${taskId}` : undefined,
    orderBy: 'created_at',
    ascending: false,
  });
}

/**
 * Realtime workflow executions hook
 */
export function useRealtimeWorkflowExecutions(taskId?: string) {
  return useRealtime({
    table: 'workflow_executions',
    filter: taskId ? `task_id=eq.${taskId}` : undefined,
    orderBy: 'created_at',
    ascending: false,
  });
}
