/**
 * useProjects Hook
 * Handles project data fetching and mutations
 */

'use client';

import { useEffect, useState, useCallback } from 'react';
import { createBrowserClient } from '@/lib/supabase/client';
import type { Project, ProjectStatus } from '@/types';

interface UseProjectsOptions {
  clientId?: string;
  status?: ProjectStatus;
  limit?: number;
  enabled?: boolean;
}

export function useProjects(options: UseProjectsOptions = {}) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [total] = useState(0);

  const {
    clientId,
    status,
    limit = 50,
    enabled = true,
  } = options;

  const supabase = createBrowserClient();

  // Fetch projects
  const fetchProjects = useCallback(async () => {
    if (!enabled) return;

    setLoading(true);
    setError(null);

    try {
      let query = supabase
        .from('projects')
        .select('*', { count: 'exact' });

      if (clientId) {
        query = query.eq('client_id', clientId);
      }

      if (status) {
        query = query.eq('status', status);
      }

      const { data, error: fetchError } = await query
        .order('created_at', { ascending: false })
        .limit(limit);

      if (fetchError) throw fetchError;

      setProjects(data as unknown as Project[]);
      // Note: count might not be accurate with RLS
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch projects');
    } finally {
      setLoading(false);
    }
  }, [clientId, status, limit, enabled, supabase]);

  // Initial fetch
  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  // Get single project
  const getProject = useCallback(async (projectId: string): Promise<Project | null> => {
    try {
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .eq('id', projectId)
        .single();

      if (error) throw error;
      return data as unknown as Project;
    } catch {
      return null;
    }
  }, [supabase]);

  // Create project
  const createProject = useCallback(async (project: Partial<Project>): Promise<Project | null> => {
    try {
      const { data, error } = await supabase
        .from('projects')
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .insert(project as any)
        .select()
        .single();

      if (error) throw error;

      setProjects((prev) => [data as unknown as Project, ...prev]);
      return data as unknown as Project;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create project');
      return null;
    }
  }, [supabase]);

  // Update project
  const updateProject = useCallback(async (
    projectId: string,
    updates: Partial<Project>
  ): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('projects')
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .update(updates as any)
        .eq('id', projectId);

      if (error) throw error;

      setProjects((prev) =>
        prev.map((p) => (p.id === projectId ? { ...p, ...updates } : p))
      );
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update project');
      return false;
    }
  }, [supabase]);

  // Delete project
  const deleteProject = useCallback(async (projectId: string): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('projects')
        .delete()
        .eq('id', projectId);

      if (error) throw error;

      setProjects((prev) => prev.filter((p) => p.id !== projectId));
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete project');
      return false;
    }
  }, [supabase]);

  // Get project stats
  const getStats = useCallback(async () => {
    try {
      const { data, error } = await supabase.rpc('get_project_stats', {
        p_client_id: clientId,
      });

      if (error) throw error;
      return data;
    } catch {
      // Fallback: calculate from fetched projects
      return {
        total: projects.length,
        active: projects.filter((p) => p.status === 'active').length,
        completed: projects.filter((p) => p.status === 'completed').length,
      };
    }
  }, [clientId, projects, supabase]);

  return {
    projects,
    loading,
    error,
    total,
    fetchProjects,
    getProject,
    createProject,
    updateProject,
    deleteProject,
    getStats,
  };
}
