/**
 * Main Dashboard Page
 */

'use client';

import { useState, useEffect } from 'react';
import DashboardLayout from '@/components/dashboard-layout';
import { ErrorBoundary } from '@/components/error-boundary';
import { Card, CardHeader, CardTitle, CardContent, StatusBadge, ProgressBar } from '@/components/ui';
import { useAuth } from '@/hooks/use-auth';
import { useProjects } from '@/hooks/use-projects';
import { useTasks } from '@/hooks/use-tasks';
import { cn, formatDate, formatRelativeTime, getTaskTypeIcon, getAgentIcon } from '@/lib/utils/helpers';
import { createBrowserClient } from '@/lib/supabase/client';
import type { Task } from '@/types';
import Link from 'next/link';

// Agent name → display label
const AGENT_NAMES = ['ResearchAgent', 'WriterAgent', 'EditorAgent', 'SeoAgent', 'PlannerAgent'] as const;

type AgentStat = { running: number; completedToday: number; failed: number };

export default function DashboardPage() {
  const { user, loading: authLoading } = useAuth();
  const { projects, loading: projectsLoading } = useProjects({ limit: 5 });
  const { tasks, loading: tasksLoading } = useTasks({ limit: 10 });
  const [agentStats, setAgentStats] = useState<Record<string, AgentStat>>({});

  // Fetch per-agent job counts (24 h window)
  useEffect(() => {
    const supabase = createBrowserClient();
    const since = new Date(Date.now() - 86_400_000).toISOString();
    supabase
      .from('ai_jobs')
      .select('agent_name, status')
      .gte('created_at', since)
      .then(({ data }) => {
        const stats: Record<string, AgentStat> = {};
        for (const row of data || []) {
          const key = row.agent_name as string;
          if (!stats[key]) stats[key] = { running: 0, completedToday: 0, failed: 0 };
          if (row.status === 'running') stats[key].running++;
          else if (row.status === 'completed') stats[key].completedToday++;
          else if (row.status === 'failed') stats[key].failed++;
        }
        setAgentStats(stats);
      });
  }, []);

  // Group tasks by project for per-project progress calculation
  const tasksByProject = tasks.reduce<Record<string, Task[]>>((acc, t) => {
    if (!acc[t.project_id]) acc[t.project_id] = [];
    acc[t.project_id].push(t);
    return acc;
  }, {});

  const getProjectProgress = (projectId: string): number | null => {
    const pts = tasksByProject[projectId];
    if (!pts || pts.length === 0) return null;
    return Math.round((pts.filter((t) => t.status === 'completed').length / pts.length) * 100);
  };

  // Calculate stats
  const stats = {
    totalProjects: projects.length,
    activeProjects: projects.filter((p) => p.status === 'active').length,
    totalTasks: tasks.length,
    pendingTasks: tasks.filter((t) => t.status === 'pending').length,
    runningTasks: tasks.filter((t) => t.status === 'running').length,
    completedTasks: tasks.filter((t) => t.status === 'completed').length,
  };

  if (authLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-8">
        {/* Welcome Header */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Welcome back, {user?.full_name?.split(' ')[0] || 'User'}!
          </h1>
          <p className="mt-1 text-gray-500">
            Here&apos;s an overview of your projects and tasks.
          </p>
        </div>

        {/* Stats Grid */}
        <ErrorBoundary>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="Active Projects"
            value={stats.activeProjects}
            total={stats.totalProjects}
            icon="📁"
            color="blue"
          />
          <StatCard
            title="Pending Tasks"
            value={stats.pendingTasks}
            total={stats.totalTasks}
            icon="📋"
            color="yellow"
          />
          <StatCard
            title="In Progress"
            value={stats.runningTasks}
            icon="⚡"
            color="purple"
          />
          <StatCard
            title="Completed"
            value={stats.completedTasks}
            total={stats.totalTasks}
            icon="✅"
            color="green"
          />
        </div>
        </ErrorBoundary>

        {/* Recent Projects & Tasks */}
        <ErrorBoundary>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Recent Projects */}
          <Card>
            <CardHeader>
              <CardTitle as="h2">Recent Projects</CardTitle>
              <Link href="/dashboard#projects" className="text-sm text-blue-600 hover:underline">
                View all
              </Link>
            </CardHeader>
            <CardContent>
              {projectsLoading ? (
                <div className="flex items-center justify-center h-32">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600" />
                </div>
              ) : projects.length === 0 ? (
                <p className="text-gray-500 text-center py-8">No projects yet</p>
              ) : (
                <div className="space-y-4">
                  {projects.map((project) => (
                    <Link
                      key={project.id}
                      href={`/projects/${project.id}`}
                      className="block p-4 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          <h3 className="font-medium text-gray-900 truncate">{project.name}</h3>
                          <p className="text-sm text-gray-500 mt-1">
                            {formatDate(project.created_at)}
                          </p>
                        </div>
                        <StatusBadge status={project.status} />
                      </div>
                      {(() => {
                        const progress = getProjectProgress(project.id);
                        return progress !== null ? (
                          <div className="mt-3">
                            <ProgressBar value={progress} size="sm" showLabel />
                          </div>
                        ) : null;
                      })()}
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recent Tasks */}
          <Card>
            <CardHeader>
              <CardTitle as="h2">Recent Tasks</CardTitle>
              <Link href="/dashboard#tasks" className="text-sm text-blue-600 hover:underline">
                View all
              </Link>
            </CardHeader>
            <CardContent>
              {tasksLoading ? (
                <div className="flex items-center justify-center h-32">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600" />
                </div>
              ) : tasks.length === 0 ? (
                <p className="text-gray-500 text-center py-8">No tasks yet</p>
              ) : (
                <div className="space-y-3">
                  {tasks.map((task) => (
                    <Link
                      key={task.id}
                      href={`/tasks/${task.id}`}
                      className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
                    >
                      <span className="text-xl">{getTaskTypeIcon(task.type)}</span>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium text-gray-900 truncate text-sm">
                          {task.name}
                        </h3>
                        <div className="flex items-center gap-2 mt-1">
                          {task.assigned_agent && (
                            <span className="text-xs text-gray-500 flex items-center gap-1">
                              <span>{getAgentIcon(task.assigned_agent)}</span>
                              {task.assigned_agent.replace('Agent', '')}
                            </span>
                          )}
                          {task.deadline && (
                            <span className="text-xs text-gray-400">
                              {formatRelativeTime(task.deadline)}
                            </span>
                          )}
                        </div>
                      </div>
                      <StatusBadge status={task.status} size="sm" />
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
        </ErrorBoundary>

        {/* AI Activity */}
        <ErrorBoundary>
        <Card>
          <CardHeader>
            <CardTitle as="h2">AI Agent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              {AGENT_NAMES.map((agent) => {
                const s = agentStats[agent];
                const statusLabel = s?.running
                  ? `${s.running} running`
                  : s?.completedToday
                  ? `${s.completedToday} today`
                  : 'Idle';
                const statusColor = s?.running
                  ? 'text-blue-600'
                  : s?.failed
                  ? 'text-red-500'
                  : 'text-gray-400';
                return (
                  <div
                    key={agent}
                    className="flex flex-col items-center p-4 rounded-lg bg-gray-50"
                  >
                    <span className="text-3xl mb-2">{getAgentIcon(agent)}</span>
                    <span className="text-sm font-medium text-gray-900">
                      {agent.replace('Agent', '')}
                    </span>
                    <span className={cn('text-xs mt-1', statusColor)}>{statusLabel}</span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
        </ErrorBoundary>
      </div>
    </DashboardLayout>
  );
}

// =====================================================
// STAT CARD COMPONENT
// =====================================================

interface StatCardProps {
  title: string;
  value: number;
  total?: number;
  icon: string;
  color: 'blue' | 'green' | 'yellow' | 'purple' | 'red';
}

function StatCard({ title, value, total, icon, color }: StatCardProps) {
  const colorStyles = {
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-600',
    yellow: 'bg-yellow-50 text-yellow-600',
    purple: 'bg-purple-50 text-purple-600',
    red: 'bg-red-50 text-red-600',
  };

  return (
    <Card padding="lg">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-500">{title}</p>
          <p className="mt-2 text-3xl font-bold text-gray-900">
            {value}
            {total !== undefined && total > 0 && (
              <span className="text-lg text-gray-400 font-normal"> / {total}</span>
            )}
          </p>
        </div>
        <div className={cn('p-3 rounded-lg text-2xl', colorStyles[color])}>
          {icon}
        </div>
      </div>
    </Card>
  );
}

