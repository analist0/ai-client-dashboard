/**
 * AI Logs Page
 * View all AI job executions
 */

'use client';

import { useState } from 'react';
import DashboardLayout from '@/components/dashboard-layout';
import { Card, CardHeader, CardTitle, CardContent, StatusBadge, Badge, Button } from '@/components/ui';
import { useRealtimeAiJobs } from '@/hooks/use-realtime';
import { formatDate, formatDuration, getAgentIcon } from '@/lib/utils/helpers';
import type { AIJob } from '@/types';

export default function AILogsPage() {
  const { data: rawAiJobs, loading, refresh } = useRealtimeAiJobs();
  const aiJobs = rawAiJobs as AIJob[];
  const [selectedJob, setSelectedJob] = useState<AIJob | null>(null);
  const [filter, setFilter] = useState<'all' | 'completed' | 'failed' | 'running'>('all');

  const filteredJobs = aiJobs.filter((job: AIJob) => {
    if (filter === 'all') return true;
    return job.status === filter;
  });

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">AI Execution Logs</h1>
            <p className="text-gray-500 mt-1">
              View all AI agent job executions and their results
            </p>
          </div>
          <Button onClick={refresh} variant="outline">
            Refresh
          </Button>
        </div>

        {/* Filters */}
        <div className="flex gap-2">
          {(['all', 'completed', 'running', 'failed'] as const).map((status) => (
            <button
              key={status}
              onClick={() => setFilter(status)}
              className={cn(
                'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                filter === status
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              )}
            >
              {status.charAt(0).toUpperCase() + status.slice(1)}
            </button>
          ))}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard
            label="Total Jobs"
            value={aiJobs.length}
            color="blue"
          />
          <StatCard
            label="Completed"
            value={aiJobs.filter((j) => j.status === 'completed').length}
            color="green"
          />
          <StatCard
            label="Running"
            value={aiJobs.filter((j) => j.status === 'running').length}
            color="purple"
          />
          <StatCard
            label="Failed"
            value={aiJobs.filter((j) => j.status === 'failed').length}
            color="red"
          />
        </div>

        {/* Jobs List */}
        <Card>
          <CardHeader>
            <CardTitle as="h2">Execution History</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center h-32">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600" />
              </div>
            ) : filteredJobs.length === 0 ? (
              <p className="text-gray-500 text-center py-8">No AI jobs found</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead>
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Agent</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Model</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Duration</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tokens</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Time</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {filteredJobs.map((job: AIJob) => (
                      <tr
                        key={job.id}
                        className="hover:bg-gray-50 cursor-pointer"
                        onClick={() => setSelectedJob(job)}
                      >
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-2">
                            <span className="text-lg">{getAgentIcon(job.agent_name)}</span>
                            <span className="font-medium text-gray-900">
                              {job.agent_name.replace('Agent', '')}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <Badge variant="info">{job.model}</Badge>
                        </td>
                        <td className="px-4 py-4">
                          <StatusBadge status={job.status} size="sm" />
                        </td>
                        <td className="px-4 py-4">
                          <span className="text-sm text-gray-600">
                            {formatDuration(job.execution_time_ms)}
                          </span>
                        </td>
                        <td className="px-4 py-4">
                          <span className="text-sm text-gray-600">
                            {job.token_usage?.total_tokens || '-'}
                          </span>
                        </td>
                        <td className="px-4 py-4">
                          <span className="text-sm text-gray-600">
                            {formatDate(job.created_at)}
                          </span>
                        </td>
                        <td className="px-4 py-4">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedJob(job);
                            }}
                          >
                            View
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Job Detail Modal */}
        {selectedJob && (
          <div
            className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4"
            onClick={() => setSelectedJob(null)}
          >
            <div
              className="bg-white rounded-xl max-w-2xl w-full max-h-[80vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-bold">
                    {getAgentIcon(selectedJob.agent_name)} {selectedJob.agent_name}
                  </h2>
                  <button
                    onClick={() => setSelectedJob(null)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
              <div className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <InfoRow label="Status" value={<StatusBadge status={selectedJob.status} />} />
                  <InfoRow label="Model" value={selectedJob.model} />
                  <InfoRow label="Provider" value={selectedJob.provider} />
                  <InfoRow label="Duration" value={formatDuration(selectedJob.execution_time_ms)} />
                  <InfoRow
                    label="Token Usage"
                    value={`${selectedJob.token_usage?.prompt_tokens || 0} → ${selectedJob.token_usage?.completion_tokens || 0}`}
                  />
                  <InfoRow label="Created" value={formatDate(selectedJob.created_at)} />
                </div>

                {selectedJob.error_message && (
                  <div className="p-4 bg-red-50 rounded-lg">
                    <h4 className="font-medium text-red-800 mb-2">Error</h4>
                    <p className="text-sm text-red-600">{selectedJob.error_message}</p>
                  </div>
                )}

                {selectedJob.output_data && (
                  <div>
                    <h4 className="font-medium mb-2">Output</h4>
                    <pre className="p-4 bg-gray-50 rounded-lg overflow-x-auto text-sm">
                      {JSON.stringify(selectedJob.output_data, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

// =====================================================
// HELPER COMPONENTS
// =====================================================

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  const colorStyles: Record<string, string> = {
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-600',
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

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-sm text-gray-500">{label}</p>
      <p className="font-medium">{value}</p>
    </div>
  );
}

function cn(...classes: (string | boolean | undefined | null)[]) {
  return classes.filter(Boolean).join(' ');
}
