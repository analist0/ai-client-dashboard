/**
 * Task Detail Page
 * - Loads task details on mount
 * - Live-updates via Supabase Realtime (ai_jobs, approvals, workflow_executions)
 * - Approval buttons call /api/approvals/[id] to resume the workflow server-side
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import DashboardLayout from '@/components/dashboard-layout';
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  StatusBadge,
  Button,
} from '@/components/ui';
import { useTasks } from '@/hooks/use-tasks';
import { useTaskRealtime } from '@/hooks/use-task-realtime';
import {
  formatDuration,
  formatRelativeTime,
  getTaskTypeIcon,
  getAgentIcon,
} from '@/lib/utils/helpers';
import type { Task, AIJob, Approval } from '@/types';
import Link from 'next/link';

export default function TaskDetailPage() {
  const params = useParams();
  const taskId = params.id as string;
  const { getTaskWithDetails, updateTask } = useTasks();

  const [task, setTask] = useState<Task | null>(null);
  const [aiJobs, setAiJobs] = useState<AIJob[]>([]);
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState('');
  const [isSubmittingFeedback, setIsSubmittingFeedback] = useState(false);
  const [approvalLoading, setApprovalLoading] = useState(false);
  const [approvalError, setApprovalError] = useState<string | null>(null);

  const loadTask = useCallback(async () => {
    const details = await getTaskWithDetails(taskId);
    if (details) {
      setTask(details.task);
      setAiJobs(details.aiJobs as unknown as AIJob[]);
      setApprovals(details.approvals as unknown as Approval[]);
    }
    setLoading(false);
  }, [taskId, getTaskWithDetails]);

  // Initial load
  useEffect(() => {
    setLoading(true);
    loadTask();
  }, [loadTask]);

  // Live updates — re-fetch when DB changes for this task
  useTaskRealtime({ taskId, onUpdate: loadTask });

  const handleSubmitFeedback = async () => {
    if (!task || !feedback.trim()) return;
    setIsSubmittingFeedback(true);
    await updateTask(taskId, { client_feedback: feedback });
    setFeedback('');
    setIsSubmittingFeedback(false);
  };

  const handleApprovalResponse = async (
    approvalId: string,
    status: 'approved' | 'rejected' | 'revision_requested',
    notes?: string
  ) => {
    setApprovalLoading(true);
    setApprovalError(null);
    try {
      const res = await fetch(`/api/approvals/${approvalId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, notes }),
      });
      if (!res.ok) {
        const data = await res.json();
        setApprovalError(data.error ?? 'Approval failed');
      }
      // Realtime will trigger loadTask automatically
    } catch (err) {
      setApprovalError(String(err));
    } finally {
      setApprovalLoading(false);
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        </div>
      </DashboardLayout>
    );
  }

  if (!task) {
    return (
      <DashboardLayout>
        <div className="text-center py-12">
          <h1 className="text-xl font-bold text-gray-900">Task not found</h1>
          <Link href="/dashboard" className="mt-4 inline-block text-blue-600 hover:underline">
            Back to Dashboard
          </Link>
        </div>
      </DashboardLayout>
    );
  }

  const pendingApproval = approvals.find((a) => a.status === 'pending');

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <Link href="/dashboard" className="text-sm text-gray-500 hover:text-gray-700">
              ← Back to Dashboard
            </Link>
            <div className="flex items-center gap-3 mt-2">
              <h1 className="text-2xl font-bold text-gray-900">{task.name}</h1>
              <StatusBadge status={task.status} />
            </div>
          </div>
        </div>

        {/* Task Info Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <InfoCard label="Type" value={task.type} icon={getTaskTypeIcon(task.type)} />
          <InfoCard
            label="Priority"
            value={`${task.priority}/10`}
            color={task.priority >= 8 ? 'red' : task.priority >= 5 ? 'yellow' : 'green'}
          />
          <InfoCard
            label="Deadline"
            value={task.deadline ? formatRelativeTime(task.deadline) : 'Not set'}
          />
          <InfoCard
            label="AI Agent"
            value={task.assigned_agent?.replace('Agent', '') || 'Not assigned'}
            icon={task.assigned_agent ? getAgentIcon(task.assigned_agent) : undefined}
          />
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left — Task Details */}
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle as="h2">Description</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600">{task.description || 'No description provided.'}</p>
              </CardContent>
            </Card>

            {task.output_data && Object.keys(task.output_data).length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle as="h2">Output</CardTitle>
                </CardHeader>
                <CardContent>
                  <pre className="p-4 bg-gray-50 rounded-lg overflow-x-auto text-sm">
                    {JSON.stringify(task.output_data, null, 2)}
                  </pre>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader>
                <CardTitle as="h2">Your Feedback</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {task.client_feedback && (
                  <div className="p-4 bg-blue-50 rounded-lg">
                    <p className="text-sm text-gray-600">{task.client_feedback}</p>
                    <p className="text-xs text-gray-400 mt-2">
                      Submitted {formatRelativeTime(task.updated_at)}
                    </p>
                  </div>
                )}
                <textarea
                  value={feedback}
                  onChange={(e) => setFeedback(e.target.value)}
                  placeholder="Add your feedback here..."
                  className="w-full p-3 border border-gray-300 rounded-lg resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  rows={3}
                />
                <Button
                  onClick={handleSubmitFeedback}
                  isLoading={isSubmittingFeedback}
                  disabled={!feedback.trim()}
                >
                  Submit Feedback
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Right — AI Jobs & Approvals */}
          <div className="space-y-6">
            {/* Approval Card */}
            {pendingApproval && (
              <Card>
                <CardHeader>
                  <CardTitle as="h2" className="text-red-600">
                    Approval Required
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-gray-600">
                    This task is waiting for your review and approval.
                  </p>
                  {approvalError && (
                    <p className="text-sm text-red-600 bg-red-50 p-2 rounded">{approvalError}</p>
                  )}
                  <div className="flex flex-col gap-2">
                    <Button
                      variant="primary"
                      isLoading={approvalLoading}
                      onClick={() => handleApprovalResponse(pendingApproval.id, 'approved')}
                    >
                      ✓ Approve
                    </Button>
                    <Button
                      variant="outline"
                      isLoading={approvalLoading}
                      onClick={() =>
                        handleApprovalResponse(pendingApproval.id, 'revision_requested')
                      }
                    >
                      ↻ Request Revision
                    </Button>
                    <Button
                      variant="danger"
                      isLoading={approvalLoading}
                      onClick={() => handleApprovalResponse(pendingApproval.id, 'rejected')}
                    >
                      ✗ Reject
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* AI Execution History */}
            <Card>
              <CardHeader>
                <CardTitle as="h2">AI Execution History</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {aiJobs.length === 0 ? (
                  <p className="text-sm text-gray-500 text-center py-4">
                    No AI jobs executed yet
                  </p>
                ) : (
                  aiJobs.map((job) => (
                    <div key={job.id} className="p-3 border border-gray-200 rounded-lg">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">
                          {getAgentIcon(job.agent_name)} {job.agent_name.replace('Agent', '')}
                        </span>
                        <StatusBadge status={job.status} size="sm" />
                      </div>
                      <div className="mt-2 text-xs text-gray-500 space-y-1">
                        <p>Model: {job.model}</p>
                        {job.execution_time_ms && (
                          <p>Duration: {formatDuration(job.execution_time_ms)}</p>
                        )}
                        {job.token_usage && (
                          <p>Tokens: {(job.token_usage as { total_tokens?: number }).total_tokens}</p>
                        )}
                        {job.error_message && (
                          <p className="text-red-500 truncate" title={job.error_message as string}>
                            Error: {job.error_message}
                          </p>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

// =====================================================
// INFO CARD
// =====================================================

interface InfoCardProps {
  label: string;
  value: string | number;
  icon?: string;
  color?: 'blue' | 'green' | 'yellow' | 'red' | 'purple';
}

function InfoCard({ label, value, icon, color = 'blue' }: InfoCardProps) {
  const colorStyles = {
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-600',
    yellow: 'bg-yellow-50 text-yellow-600',
    red: 'bg-red-50 text-red-600',
    purple: 'bg-purple-50 text-purple-600',
  };

  return (
    <Card padding="md">
      <div className="flex items-center gap-3">
        {icon && (
          <div className={cn('p-2 rounded-lg text-lg', colorStyles[color])}>{icon}</div>
        )}
        <div>
          <p className="text-xs text-gray-500 uppercase">{label}</p>
          <p className="font-medium text-gray-900">{value}</p>
        </div>
      </div>
    </Card>
  );
}

function cn(...classes: (string | boolean | undefined | null)[]) {
  return classes.filter(Boolean).join(' ');
}
