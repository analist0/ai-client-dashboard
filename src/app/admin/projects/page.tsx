/**
 * Admin Projects Page
 * Admin interface for managing projects
 */

'use client';

import { useState } from 'react';
import DashboardLayout from '@/components/dashboard-layout';
import { Card, CardHeader, CardTitle, CardContent, StatusBadge, Button } from '@/components/ui';
import { useProjects } from '@/hooks/use-projects';
import { formatDate } from '@/lib/utils/helpers';
import type { Project, ProjectStatus } from '@/types';

export default function AdminProjectsPage() {
  const { projects, loading, createProject, updateProject, deleteProject } = useProjects();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Admin - Projects</h1>
            <p className="text-gray-500 mt-1">Manage all client projects</p>
          </div>
          <Button onClick={() => setShowCreateModal(true)}>
            + New Project
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <StatCard label="Total" value={projects.length} color="blue" />
          <StatCard label="Planning" value={projects.filter(p => p.status === 'planning').length} color="gray" />
          <StatCard label="Active" value={projects.filter(p => p.status === 'active').length} color="green" />
          <StatCard label="On Hold" value={projects.filter(p => p.status === 'on_hold').length} color="yellow" />
          <StatCard label="Completed" value={projects.filter(p => p.status === 'completed').length} color="purple" />
        </div>

        {/* Projects Table */}
        <Card>
          <CardHeader>
            <CardTitle as="h2">All Projects</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center h-32">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600" />
              </div>
            ) : projects.length === 0 ? (
              <p className="text-gray-500 text-center py-8">No projects found</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead>
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Project</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Client</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Deadline</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Budget</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {projects.map((project) => (
                      <tr key={project.id} className="hover:bg-gray-50">
                        <td className="px-4 py-4">
                          <div>
                            <p className="font-medium text-gray-900">{project.name}</p>
                            <p className="text-sm text-gray-500">{formatDate(project.created_at)}</p>
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <span className="text-sm text-gray-600">Client {project.client_id.slice(0, 8)}...</span>
                        </td>
                        <td className="px-4 py-4">
                          <StatusBadge status={project.status} size="sm" />
                        </td>
                        <td className="px-4 py-4">
                          <span className="text-sm text-gray-600">
                            {project.deadline ? formatDate(project.deadline) : '-'}
                          </span>
                        </td>
                        <td className="px-4 py-4">
                          <span className="text-sm text-gray-600">
                            {project.budget ? `$${project.budget.toLocaleString()}` : '-'}
                          </span>
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setEditingProject(project)}
                            >
                              Edit
                            </Button>
                            <Button
                              size="sm"
                              variant="danger"
                              onClick={() => deleteProject(project.id)}
                            >
                              Delete
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Create/Edit Modal */}
      {(showCreateModal || editingProject) && (
        <ProjectModal
          project={editingProject}
          onClose={() => {
            setShowCreateModal(false);
            setEditingProject(null);
          }}
          onSave={async (data) => {
            if (editingProject) {
              await updateProject(editingProject.id, data);
            } else {
              await createProject(data as Partial<Project>);
            }
            setShowCreateModal(false);
            setEditingProject(null);
          }}
        />
      )}
    </DashboardLayout>
  );
}

// =====================================================
// STAT CARD COMPONENT
// =====================================================

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  const colorStyles: Record<string, string> = {
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-600',
    yellow: 'bg-yellow-50 text-yellow-600',
    purple: 'bg-purple-50 text-purple-600',
    gray: 'bg-gray-50 text-gray-600',
  };

  return (
    <div className={cn('p-4 rounded-lg', colorStyles[color])}>
      <p className="text-sm font-medium opacity-80">{label}</p>
      <p className="mt-1 text-2xl font-bold">{value}</p>
    </div>
  );
}

// =====================================================
// PROJECT MODAL COMPONENT
// =====================================================

interface ProjectModalProps {
  project: Project | null;
  onClose: () => void;
  onSave: (data: Partial<Project>) => void;
}

function ProjectModal({ project, onClose, onSave }: ProjectModalProps) {
  const [name, setName] = useState(project?.name || '');
  const [description, setDescription] = useState(project?.description || '');
  const [status, setStatus] = useState<ProjectStatus>(project?.status || 'planning');
  const [deadline, setDeadline] = useState(project?.deadline?.split('T')[0] || '');
  const [budget, setBudget] = useState(project?.budget?.toString() || '');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      name,
      description,
      status,
      deadline: deadline || null,
      budget: budget ? parseFloat(budget) : null,
    });
  };

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl max-w-lg w-full"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-xl font-bold">
            {project ? 'Edit Project' : 'Create Project'}
          </h2>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Project Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Status
            </label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as ProjectStatus)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="planning">Planning</option>
              <option value="active">Active</option>
              <option value="on_hold">On Hold</option>
              <option value="completed">Completed</option>
              <option value="archived">Archived</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Deadline
              </label>
              <input
                type="date"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Budget ($)
              </label>
              <input
                type="number"
                value={budget}
                onChange={(e) => setBudget(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          <div className="flex gap-3 pt-4">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1">
              Cancel
            </Button>
            <Button type="submit" variant="primary" className="flex-1">
              {project ? 'Save Changes' : 'Create Project'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

function cn(...classes: (string | boolean | undefined | null)[]) {
  return classes.filter(Boolean).join(' ');
}
