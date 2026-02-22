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

  // Resolve client_id for the current user (create client record if needed)
  const resolveClientId = useCallback(async (): Promise<string | null> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    // Look up existing client record
    const { data: existing } = await supabase
      .from('clients')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (existing) return existing.id;

    // Create a default client record for this user
    const { data: created, error } = await supabase
      .from('clients')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .insert({ user_id: user.id } as any)
      .select('id')
      .single();

    if (error || !created) return null;
    return created.id;
  }, [supabase]);

  // Create project
  const createProject = useCallback(async (project: Partial<Project>): Promise<Project | null> => {
    try {
      // Resolve client_id if not provided
      const client_id = project.client_id || (await resolveClientId());
      if (!client_id) throw new Error('Could not resolve client. Are you logged in?');

      const { data, error } = await supabase
        .from('projects')
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .insert({ ...project, client_id } as any)
        .select()
        .single();

      if (error) throw error;

      setProjects((prev) => [data as unknown as Project, ...prev]);
      return data as unknown as Project;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to create project';
      setError(msg);
      throw new Error(msg);
    }
  }, [supabase, resolveClientId]);

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
