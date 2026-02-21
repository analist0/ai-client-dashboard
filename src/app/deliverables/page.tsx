/**
 * Deliverables Page
 * View and download project deliverables
 */

'use client';

import { useEffect, useState } from 'react';
import DashboardLayout from '@/components/dashboard-layout';
import { Card, CardHeader, CardTitle, CardContent, Badge, Button } from '@/components/ui';
import { createBrowserClient } from '@/lib/supabase/client';
import { cn, formatDate, formatFileSize } from '@/lib/utils/helpers';

interface DeliverableRow {
  id: string;
  name: string;
  task_name: string;
  file_type: string | null;
  file_url: string | null;
  file_size: number | null;
  version: number;
  is_final: boolean;
  created_at: string;
}

export default function DeliverablesPage() {
  const [deliverables, setDeliverables] = useState<DeliverableRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createBrowserClient();

    supabase
      .from('deliverables')
      .select('id, name, file_type, file_url, file_size, version, is_final, created_at, tasks(name)')
      .order('created_at', { ascending: false })
      .then(({ data, error: fetchError }) => {
        if (fetchError) {
          setError('Failed to load deliverables');
        } else {
          setDeliverables(
            (data || []).map((d) => ({
              id: d.id,
              name: d.name,
              task_name: (d.tasks as { name: string } | null)?.name ?? 'Unknown task',
              file_type: d.file_type,
              file_url: d.file_url,
              file_size: d.file_size,
              version: d.version,
              is_final: d.is_final,
              created_at: d.created_at,
            }))
          );
        }
        setLoading(false);
      });
  }, []);

  const totalSize = deliverables.reduce((acc, d) => acc + (d.file_size || 0), 0);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Deliverables</h1>
          <p className="text-gray-500 mt-1">
            Download and review completed project deliverables
          </p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-48">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
          </div>
        ) : error ? (
          <div className="rounded-lg bg-red-50 p-4 text-red-700">{error}</div>
        ) : (
          <>
            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard label="Total Files" value={deliverables.length} color="blue" />
              <StatCard label="Final Versions" value={deliverables.filter((d) => d.is_final).length} color="green" />
              <StatCard label="Drafts" value={deliverables.filter((d) => !d.is_final).length} color="yellow" />
              <StatCard label="Total Size" value={formatFileSize(totalSize)} color="purple" />
            </div>

            {/* Deliverables List */}
            <Card>
              <CardHeader>
                <CardTitle as="h2">All Deliverables</CardTitle>
              </CardHeader>
              <CardContent>
                {deliverables.length === 0 ? (
                  <p className="text-gray-500 text-center py-8">No deliverables yet</p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {deliverables.map((deliverable) => (
                      <DeliverableCard key={deliverable.id} deliverable={deliverable} />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}

// =====================================================
// DELIVERABLE CARD COMPONENT
// =====================================================

function DeliverableCard({ deliverable }: { deliverable: DeliverableRow }) {
  const getFileIcon = (type: string | null) => {
    const icons: Record<string, string> = {
      document: '📄',
      pdf: '📕',
      image: '🖼️',
      video: '🎬',
      audio: '🎵',
      archive: '📦',
    };
    return icons[type ?? ''] || '📎';
  };

  return (
    <div className="p-4 border border-gray-200 rounded-lg hover:border-blue-300 hover:shadow-md transition-all">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <span className="text-3xl">{getFileIcon(deliverable.file_type)}</span>
          <div className="flex-1 min-w-0">
            <h3 className="font-medium text-gray-900 truncate">{deliverable.name}</h3>
            <p className="text-sm text-gray-500 truncate">{deliverable.task_name}</p>
          </div>
        </div>
        {deliverable.is_final && <Badge variant="success">Final</Badge>}
      </div>

      <div className="mt-4 flex items-center justify-between text-sm text-gray-500">
        <span>v{deliverable.version}</span>
        <span>{formatFileSize(deliverable.file_size)}</span>
        <span>{formatDate(deliverable.created_at)}</span>
      </div>

      <div className="mt-4 flex gap-2">
        {deliverable.file_url ? (
          <a href={deliverable.file_url} download className="flex-1">
            <Button variant="primary" size="sm" className="w-full">
              Download
            </Button>
          </a>
        ) : (
          <Button variant="primary" size="sm" className="flex-1" disabled>
            No file
          </Button>
        )}
        <Button variant="outline" size="sm">Preview</Button>
      </div>
    </div>
  );
}

// =====================================================
// STAT CARD COMPONENT
// =====================================================

function StatCard({ label, value, color }: { label: string; value: string | number; color: string }) {
  const colorStyles: Record<string, string> = {
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-600',
    yellow: 'bg-yellow-50 text-yellow-600',
    purple: 'bg-purple-50 text-purple-600',
  };

  return (
    <div className={cn('p-4 rounded-lg', colorStyles[color])}>
      <p className="text-sm font-medium opacity-80">{label}</p>
      <p className="mt-1 text-2xl font-bold">{value}</p>
    </div>
  );
}

