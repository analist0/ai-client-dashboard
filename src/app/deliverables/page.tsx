/**
 * Deliverables Page
 * View and download project deliverables
 */

'use client';

import DashboardLayout from '@/components/dashboard-layout';
import { Card, CardHeader, CardTitle, CardContent, Badge, Button } from '@/components/ui';
import { formatDate, formatFileSize } from '@/lib/utils/helpers';

// Mock data - in production, fetch from API
const mockDeliverables = [
  {
    id: '1',
    name: 'Blog Post - AI Trends 2024',
    task_name: 'Write AI Trends Blog Post',
    file_type: 'document',
    file_url: '#',
    file_size: 256000,
    version: 1,
    is_final: true,
    created_at: new Date().toISOString(),
  },
  {
    id: '2',
    name: 'SEO Audit Report',
    task_name: 'SEO Analysis',
    file_type: 'pdf',
    file_url: '#',
    file_size: 1024000,
    version: 2,
    is_final: true,
    created_at: new Date(Date.now() - 86400000).toISOString(),
  },
  {
    id: '3',
    name: 'Landing Page Copy',
    task_name: 'Create Landing Page Content',
    file_type: 'document',
    file_url: '#',
    file_size: 128000,
    version: 3,
    is_final: false,
    created_at: new Date(Date.now() - 172800000).toISOString(),
  },
];

export default function DeliverablesPage() {
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

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label="Total Files" value={mockDeliverables.length} color="blue" />
          <StatCard label="Final Versions" value={mockDeliverables.filter(d => d.is_final).length} color="green" />
          <StatCard label="Drafts" value={mockDeliverables.filter(d => !d.is_final).length} color="yellow" />
          <StatCard label="Total Size" value={formatFileSize(mockDeliverables.reduce((acc, d) => acc + (d.file_size || 0), 0))} color="purple" />
        </div>

        {/* Deliverables List */}
        <Card>
          <CardHeader>
            <CardTitle as="h2">All Deliverables</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {mockDeliverables.map((deliverable) => (
                <DeliverableCard key={deliverable.id} deliverable={deliverable} />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}

// =====================================================
// DELIVERABLE CARD COMPONENT
// =====================================================

interface DeliverableCardProps {
  deliverable: {
    id: string;
    name: string;
    task_name: string;
    file_type: string;
    file_url: string;
    file_size: number | null;
    version: number;
    is_final: boolean;
    created_at: string;
  };
}

function DeliverableCard({ deliverable }: DeliverableCardProps) {
  const getFileIcon = (type: string) => {
    const icons: Record<string, string> = {
      document: '📄',
      pdf: '📕',
      image: '🖼️',
      video: '🎬',
      audio: '🎵',
      archive: '📦',
    };
    return icons[type] || '📎';
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
        {deliverable.is_final && (
          <Badge variant="success">Final</Badge>
        )}
      </div>

      <div className="mt-4 flex items-center justify-between text-sm text-gray-500">
        <span>v{deliverable.version}</span>
        <span>{formatFileSize(deliverable.file_size)}</span>
        <span>{formatDate(deliverable.created_at)}</span>
      </div>

      <div className="mt-4 flex gap-2">
        <Button variant="primary" size="sm" className="flex-1">
          Download
        </Button>
        <Button variant="outline" size="sm">
          Preview
        </Button>
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

function cn(...classes: (string | boolean | undefined | null)[]) {
  return classes.filter(Boolean).join(' ');
}
