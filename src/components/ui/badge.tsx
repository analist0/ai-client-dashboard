/**
 * Badge Component
 */

'use client';

import { cn, getStatusColor } from '@/lib/utils/helpers';

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'default' | 'success' | 'warning' | 'error' | 'info' | 'status';
  status?: string; // For status-based coloring
  size?: 'sm' | 'md';
  className?: string;
}

export function Badge({
  children,
  variant = 'default',
  status,
  size = 'sm',
  className,
}: BadgeProps) {
  const sizeStyles = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-2.5 py-1 text-sm',
  };

  const variantStyles = {
    default: 'bg-gray-100 text-gray-800',
    success: 'bg-green-100 text-green-800',
    warning: 'bg-yellow-100 text-yellow-800',
    error: 'bg-red-100 text-red-800',
    info: 'bg-blue-100 text-blue-800',
    status: status ? getStatusColor(status, 'text') : 'bg-gray-100 text-gray-800',
  };

  const bgStyles = {
    default: 'bg-gray-100',
    success: 'bg-green-100',
    warning: 'bg-yellow-100',
    error: 'bg-red-100',
    info: 'bg-blue-100',
    status: status ? getStatusColor(status, 'bg') : 'bg-gray-100',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center font-medium rounded-full',
        sizeStyles[size],
        variant === 'status' ? bgStyles.status : variantStyles[variant],
        className
      )}
    >
      {children}
    </span>
  );
}

/**
 * StatusBadge Component
 * Specialized badge for displaying status with indicator dot
 */
interface StatusBadgeProps {
  status: string;
  label?: string;
  showDot?: boolean;
  size?: 'sm' | 'md';
  className?: string;
}

export function StatusBadge({
  status,
  label,
  showDot = true,
  size = 'sm',
  className,
}: StatusBadgeProps) {
  const dotColors: Record<string, string> = {
    pending: 'bg-yellow-500',
    running: 'bg-blue-500',
    completed: 'bg-green-500',
    failed: 'bg-red-500',
    cancelled: 'bg-gray-500',
    waiting_approval: 'bg-purple-500',
    approved: 'bg-green-500',
    rejected: 'bg-red-500',
    revision_requested: 'bg-orange-500',
    planning: 'bg-gray-500',
    active: 'bg-green-500',
    on_hold: 'bg-yellow-500',
    archived: 'bg-gray-500',
    queued: 'bg-gray-500',
  };

  const statusLabels: Record<string, string> = {
    pending: 'Pending',
    running: 'Running',
    completed: 'Completed',
    failed: 'Failed',
    cancelled: 'Cancelled',
    waiting_approval: 'Waiting Approval',
    approved: 'Approved',
    rejected: 'Rejected',
    revision_requested: 'Revision Requested',
    planning: 'Planning',
    active: 'Active',
    on_hold: 'On Hold',
    archived: 'Archived',
    queued: 'Queued',
  };

  const dotColor = dotColors[status] || 'bg-gray-500';
  const displayLabel = label || statusLabels[status] || status;

  return (
    <Badge status={status} className={cn('gap-1.5', className)}>
      {showDot && <span className={cn('w-1.5 h-1.5 rounded-full', dotColor)} />}
      <span>{displayLabel}</span>
    </Badge>
  );
}
