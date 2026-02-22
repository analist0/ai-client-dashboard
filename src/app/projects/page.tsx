/**
 * Projects Page - List and create projects
 */

'use client';

import { useState } from 'react';
import DashboardLayout from '@/components/dashboard-layout';
import { Card, CardContent, StatusBadge, Button } from '@/components/ui';
import { useProjects } from '@/hooks/use-projects';
import { formatDate } from '@/lib/utils/helpers';
import Link from 'next/link';
import type { ProjectStatus } from '@/types';

const PROJECT_STATUSES: { value: ProjectStatus | ''; label: string }[] = [
  { value: '', label: 'All' },
  { value: 'planning', label: 'Planning' },
  { value: 'active', label: 'Active' },
  { value: 'on_hold', label: 'On Hold' },
  { value: 'completed', label: 'Completed' },
  { value: 'archived', label: 'Archived' },
];

export default function ProjectsPage() {
  const [filterStatus, setFilterStatus] = useState<ProjectStatus | ''>('');
  const [showModal, setShowModal] = useState(false);

  const { projects, loading, error, createProject, fetchProjects } = useProjects({
    status: filterStatus || undefined,
  });

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Projects</h1>
            <p className="text-sm text-gray-500 mt-1">{projects.length} project(s)</p>
          </div>
          <Button variant="primary" onClick={() => setShowModal(true)}>
            + New Project
          </Button>
        </div>

        {/* Status filter */}
        <div className="flex gap-2 flex-wrap">
          {PROJECT_STATUSES.map((s) => (
            <button
              key={s.value}
              onClick={() => setFilterStatus(s.value as ProjectStatus | '')}
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

        {/* Error */}
        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
            {error}
          </div>
        )}

        {/* Projects grid */}
        {loading ? (
          <div className="flex justify-center py-20">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
          </div>
        ) : projects.length === 0 ? (
          <div className="text-center py-20">
            <div className="text-4xl mb-3">📁</div>
            <h3 className="text-lg font-medium text-gray-900">No projects yet</h3>
            <p className="text-gray-500 mt-1">Create your first project to get started.</p>
            <Button variant="primary" className="mt-4" onClick={() => setShowModal(true)}>
              Create Project
            </Button>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {projects.map((project) => (
              <Link key={project.id} href={`/projects/${project.id}`}>
                <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
                  <CardContent>
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <h3 className="font-semibold text-gray-900 leading-tight">{project.name}</h3>
                      <StatusBadge status={project.status || 'planning'} />
                    </div>
                    {project.description && (
                      <p className="text-sm text-gray-500 line-clamp-2 mb-3">{project.description}</p>
                    )}
                    <div className="flex items-center justify-between text-xs text-gray-400 mt-auto pt-3 border-t border-gray-100">
                      <span>Created {formatDate(project.created_at)}</span>
                      {project.deadline && (
                        <span className="text-orange-500">Due {formatDate(project.deadline)}</span>
                      )}
                    </div>
                    {project.budget && (
                      <p className="text-xs text-green-600 font-medium mt-2">
                        Budget: {project.currency || 'USD'} {Number(project.budget).toLocaleString()}
                      </p>
                    )}
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* New Project Modal */}
      {showModal && (
        <NewProjectModal
          onClose={() => setShowModal(false)}
          onCreate={async (data) => {
            const result = await createProject(data);
            if (result) {
              setShowModal(false);
              fetchProjects();
            }
            return result;
          }}
        />
      )}
    </DashboardLayout>
  );
}

// ─── New Project Modal ────────────────────────────────────────────────────────

interface NewProjectModalProps {
  onClose: () => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onCreate: (data: Record<string, unknown>) => Promise<any>;
}

function NewProjectModal({ onClose, onCreate }: NewProjectModalProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<ProjectStatus>('planning');
  const [deadline, setDeadline] = useState('');
  const [budget, setBudget] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    setError('');
    try {
      await onCreate({
        name: name.trim(),
        description: description.trim() || null,
        status,
        deadline: deadline || null,
        budget: budget ? parseFloat(budget) : null,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create project');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">New Project</h2>
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
            <label className="block text-sm font-medium text-gray-700 mb-1">Project Name *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
              placeholder="My Awesome Project"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm resize-none"
              placeholder="What is this project about?"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as ProjectStatus)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
              >
                <option value="planning">Planning</option>
                <option value="active">Active</option>
                <option value="on_hold">On Hold</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Deadline</label>
              <input
                type="date"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Budget (USD)</label>
            <input
              type="number"
              value={budget}
              onChange={(e) => setBudget(e.target.value)}
              min="0"
              step="0.01"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
              placeholder="0.00"
            />
          </div>
          <div className="flex gap-3 pt-2">
            <Button type="button" variant="outline" className="flex-1" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" className="flex-1" isLoading={loading}>
              Create Project
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
