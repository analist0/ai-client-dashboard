/**
 * Project Detail Page
 */

'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import DashboardLayout from '@/components/dashboard-layout';
import { Card, CardHeader, CardTitle, CardContent, StatusBadge, Button, Timeline } from '@/components/ui';
import { useTasks } from '@/hooks/use-tasks';
import { formatDate, formatRelativeTime, getTaskTypeIcon } from '@/lib/utils/helpers';
import type { Project, Task } from '@/types';
import Link from 'next/link';

export default function ProjectDetailPage() {
  const params = useParams();
  const projectId = params.id as string;
  const { tasks, loading } = useTasks({ projectId });
  const [project, setProject] = useState<Project | null>(null);

  // Fetch project details
  useEffect(() => {
    // In a real app, fetch from API
    // For now, we'll use a placeholder
    setProject({
      id: projectId,
      client_id: 'client-1',
      name: 'Sample Project',
      description: 'This is a sample project description.',
      status: 'active',
      start_date: new Date().toISOString(),
      deadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      currency: 'USD',
      metadata: {},
    } as Project);
  }, [projectId]);

  // Calculate task stats
  const taskStats = {
    total: tasks.length,
    pending: tasks.filter((t) => t.status === 'pending').length,
    running: tasks.filter((t) => t.status === 'running').length,
    completed: tasks.filter((t) => t.status === 'completed').length,
  };

  const progress = taskStats.total > 0 
    ? Math.round((taskStats.completed / taskStats.total) * 100) 
    : 0;

  // Build timeline
  const timelineItems = tasks
    .filter((t) => t.deadline)
    .sort((a, b) => new Date(a.deadline!).getTime() - new Date(b.deadline!).getTime())
    .slice(0, 5)
    .map((task) => ({
      date: formatDate(task.deadline!),
      title: task.name,
      status: task.status === 'completed' ? 'completed' : 
              task.status === 'running' ? 'current' : 'upcoming' as const,
      description: `${task.type} task`,
    }));

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <Link
              href="/dashboard"
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              ← Back to Dashboard
            </Link>
            <h1 className="mt-2 text-2xl font-bold text-gray-900">
              {project?.name || 'Loading...'}
            </h1>
          </div>
          <Button variant="primary">New Task</Button>
        </div>

        {/* Project Info */}
        {project && (
          <Card>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div>
                  <p className="text-sm text-gray-500">Status</p>
                  <StatusBadge status={project.status} className="mt-1" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Start Date</p>
                  <p className="mt-1 font-medium">{formatDate(project.start_date)}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Deadline</p>
                  <p className="mt-1 font-medium">{formatDate(project.deadline)}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Progress</p>
                  <p className="mt-1 font-medium">{progress}%</p>
                </div>
              </div>
              {project.description && (
                <div className="mt-6 pt-6 border-t border-gray-200">
                  <p className="text-gray-600">{project.description}</p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Task Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatBox label="Total Tasks" value={taskStats.total} color="blue" />
          <StatBox label="Pending" value={taskStats.pending} color="yellow" />
          <StatBox label="In Progress" value={taskStats.running} color="purple" />
          <StatBox label="Completed" value={taskStats.completed} color="green" />
        </div>

        {/* Tasks List */}
        <Card>
          <CardHeader>
            <CardTitle as="h2">Tasks</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center h-32">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600" />
              </div>
            ) : tasks.length === 0 ? (
              <p className="text-gray-500 text-center py-8">No tasks in this project yet</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead>
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Task</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Deadline</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">AI Agent</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {tasks.map((task) => (
                      <tr key={task.id} className="hover:bg-gray-50">
                        <td className="px-4 py-4">
                          <Link
                            href={`/tasks/${task.id}`}
                            className="font-medium text-gray-900 hover:text-blue-600"
                          >
                            {task.name}
                          </Link>
                        </td>
                        <td className="px-4 py-4">
                          <span className="text-sm text-gray-600">{task.type}</span>
                        </td>
                        <td className="px-4 py-4">
                          <StatusBadge status={task.status} size="sm" />
                        </td>
                        <td className="px-4 py-4">
                          <span className="text-sm text-gray-600">
                            {task.deadline ? formatRelativeTime(task.deadline) : '-'}
                          </span>
                        </td>
                        <td className="px-4 py-4">
                          {task.assigned_agent ? (
                            <span className="text-sm text-gray-600">
                              {task.assigned_agent.replace('Agent', '')}
                            </span>
                          ) : (
                            <span className="text-sm text-gray-400">-</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Timeline */}
        {timelineItems.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle as="h2">Timeline</CardTitle>
            </CardHeader>
            <CardContent>
              <Timeline items={timelineItems} />
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}

// =====================================================
// STAT BOX COMPONENT
// =====================================================

interface StatBoxProps {
  label: string;
  value: number;
  color: 'blue' | 'green' | 'yellow' | 'purple' | 'red';
}

function StatBox({ label, value, color }: StatBoxProps) {
  const colorStyles = {
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-600',
    yellow: 'bg-yellow-50 text-yellow-600',
    purple: 'bg-purple-50 text-purple-600',
    red: 'bg-red-50 text-red-600',
  };

  return (
    <div className={cn('p-4 rounded-lg', colorStyles[color])}>
      <p className="text-sm font-medium opacity-80">{label}</p>
      <p className="mt-1 text-2xl font-bold">{value}</p>
    </div>
  );
}

function cn(...classes: (string | boolean | undefined | null)[]) {
  return classes.filter(Boolean).join(' ');
}
