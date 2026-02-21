/**
 * Tasks Page - List and create tasks
 */

'use client';

import { useState } from 'react';
import DashboardLayout from '@/components/dashboard-layout';
import { Card, CardContent, StatusBadge, Button } from '@/components/ui';
import { useTasks } from '@/hooks/use-tasks';
import { useProjects } from '@/hooks/use-projects';
import { formatDate, getTaskTypeIcon } from '@/lib/utils/helpers';
import Link from 'next/link';
import type { TaskStatus, TaskType } from '@/types';

const TASK_TYPES: { value: TaskType; label: string }[] = [
  { value: 'blog_post', label: 'Blog Post' },
  { value: 'research', label: 'Research' },
  { value: 'seo', label: 'SEO' },
  { value: 'dev', label: 'Development' },
  { value: 'design', label: 'Design' },
  { value: 'video', label: 'Video' },
  { value: 'social_media', label: 'Social Media' },
  { value: 'email_campaign', label: 'Email Campaign' },
  { value: 'landing_page', label: 'Landing Page' },
  { value: 'other', label: 'Other' },
];

const STATUS_FILTERS: { value: TaskStatus | ''; label: string; color: string }[] = [
  { value: '', label: 'All', color: 'gray' },
  { value: 'pending', label: 'Pending', color: 'yellow' },
  { value: 'running', label: 'Running', color: 'blue' },
  { value: 'waiting_approval', label: 'Approval', color: 'purple' },
  { value: 'completed', label: 'Completed', color: 'green' },
  { value: 'failed', label: 'Failed', color: 'red' },
];

export default function TasksPage() {
  const [filterStatus, setFilterStatus] = useState<TaskStatus | ''>('');
  const [showModal, setShowModal] = useState(false);

  const { tasks, loading, error, createTask } = useTasks({
    status: filterStatus || undefined,
  });

  const { projects } = useProjects();

  // Build a project lookup map
  const projectMap = Object.fromEntries(projects.map((p) => [p.id, p]));

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Tasks</h1>
            <p className="text-sm text-gray-500 mt-1">{tasks.length} task(s)</p>
          </div>
          <Button variant="primary" onClick={() => setShowModal(true)} disabled={projects.length === 0}>
            + New Task
          </Button>
        </div>

        {projects.length === 0 && !loading && (
          <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-700">
            You need to create a project before adding tasks.{' '}
            <Link href="/projects" className="underline font-medium">Create a project</Link>
          </div>
        )}

        {/* Status filter */}
        <div className="flex gap-2 flex-wrap">
          {STATUS_FILTERS.map((s) => (
            <button
              key={s.value}
              onClick={() => setFilterStatus(s.value as TaskStatus | '')}
              className={`px-3 py-1.5 text-sm rounded-full border transition-colors ${
                filterStatus === s.value
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-blue-300'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>

        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">{error}</div>
        )}

        {/* Tasks list */}
        {loading ? (
          <div className="flex justify-center py-20">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
          </div>
        ) : tasks.length === 0 ? (
          <div className="text-center py-20">
            <div className="text-4xl mb-3">📋</div>
            <h3 className="text-lg font-medium text-gray-900">No tasks yet</h3>
            <p className="text-gray-500 mt-1">
              {filterStatus ? 'No tasks with this status.' : 'Create your first task to get started.'}
            </p>
            {!filterStatus && projects.length > 0 && (
              <Button variant="primary" className="mt-4" onClick={() => setShowModal(true)}>
                Create Task
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {tasks.map((task) => {
              const project = projectMap[task.project_id];
              return (
                <Link key={task.id} href={`/tasks/${task.id}`}>
                  <Card className="hover:shadow-md transition-shadow cursor-pointer">
                    <CardContent>
                      <div className="flex items-center gap-4">
                        <span className="text-2xl flex-shrink-0">{getTaskTypeIcon(task.type)}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-medium text-gray-900 truncate">{task.name}</h3>
                            <StatusBadge status={task.status} size="sm" />
                          </div>
                          <div className="flex items-center gap-3 mt-1 text-xs text-gray-500 flex-wrap">
                            {project && (
                              <span className="flex items-center gap-1">
                                <span>📁</span> {project.name}
                              </span>
                            )}
                            {task.assigned_agent && (
                              <span>Agent: {task.assigned_agent.replace('Agent', '')}</span>
                            )}
                            {task.priority && (
                              <span>Priority: {task.priority}/10</span>
                            )}
                            <span>{formatDate(task.created_at)}</span>
                          </div>
                          {task.description && (
                            <p className="text-sm text-gray-500 mt-1 line-clamp-1">{task.description}</p>
                          )}
                        </div>
                        <div className="flex-shrink-0">
                          <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        )}
      </div>

      {/* New Task Modal */}
      {showModal && (
        <NewTaskModal
          projects={projects}
          onClose={() => setShowModal(false)}
          onCreate={async (data) => {
            await createTask(data);
            setShowModal(false);
          }}
        />
      )}
    </DashboardLayout>
  );
}

// ─── New Task Modal ───────────────────────────────────────────────────────────

interface NewTaskModalProps {
  projects: Array<{ id: string; name: string }>;
  onClose: () => void;
  onCreate: (data: Record<string, unknown>) => Promise<void>;
}

function NewTaskModal({ projects, onClose, onCreate }: NewTaskModalProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [projectId, setProjectId] = useState(projects[0]?.id || '');
  const [type, setType] = useState<TaskType>('other');
  const [priority, setPriority] = useState(5);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !projectId) return;
    setLoading(true);
    setError('');
    try {
      await onCreate({
        name: name.trim(),
        description: description.trim() || null,
        project_id: projectId,
        type,
        priority,
        status: 'pending',
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create task');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">New Task</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">{error}</div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Task Name *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
              placeholder="Write blog post about AI..."
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm resize-none"
              placeholder="Describe the task..."
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Project *</label>
            <select
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as TaskType)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
              >
                {TASK_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Priority: {priority}/10
              </label>
              <input
                type="range"
                min={1}
                max={10}
                value={priority}
                onChange={(e) => setPriority(Number(e.target.value))}
                className="w-full mt-2"
              />
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <Button type="button" variant="outline" className="flex-1" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" className="flex-1" isLoading={loading}>
              Create Task
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
