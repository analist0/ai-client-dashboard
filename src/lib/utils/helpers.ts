/**
 * Utility Functions
 */

import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Merge Tailwind classes conditionally
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Format date to readable string
 */
export function formatDate(date: string | Date | null | undefined, options?: Intl.DateTimeFormatOptions): string {
  if (!date) return '';
  
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return '';
  
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    ...options,
  });
}

/**
 * Format relative time (e.g., "2 hours ago")
 */
export function formatRelativeTime(date: string | Date | null | undefined): string {
  if (!date) return '';
  
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return '';
  
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  
  return formatDate(date);
}

/**
 * Format file size
 */
export function formatFileSize(bytes: number | null | undefined): string {
  if (!bytes) return '0 B';
  
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let unitIndex = 0;
  let size = bytes;
  
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }
  
  return `${size.toFixed(1)} ${units[unitIndex]}`;
}

/**
 * Format duration in milliseconds to readable string
 */
export function formatDuration(ms: number | null | undefined): string {
  if (!ms) return '0s';
  
  if (ms < 1000) return `${ms}ms`;
  
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  
  if (minutes < 60) return `${minutes}m ${remainingSeconds}s`;
  
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  
  return `${hours}h ${remainingMinutes}m`;
}

/**
 * Truncate text with ellipsis
 */
export function truncate(text: string, length: number): string {
  if (text.length <= length) return text;
  return text.slice(0, length) + '...';
}

/**
 * Generate initials from name
 */
export function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

/**
 * Get status color classes
 */
export function getStatusColor(status: string, type: 'bg' | 'text' | 'border' = 'bg'): string {
  const colors: Record<string, Record<string, string>> = {
    pending: { bg: 'bg-yellow-100', text: 'text-yellow-800', border: 'border-yellow-200' },
    running: { bg: 'bg-blue-100', text: 'text-blue-800', border: 'border-blue-200' },
    completed: { bg: 'bg-green-100', text: 'text-green-800', border: 'border-green-200' },
    failed: { bg: 'bg-red-100', text: 'text-red-800', border: 'border-red-200' },
    cancelled: { bg: 'bg-gray-100', text: 'text-gray-800', border: 'border-gray-200' },
    waiting_approval: { bg: 'bg-purple-100', text: 'text-purple-800', border: 'border-purple-200' },
    approved: { bg: 'bg-green-100', text: 'text-green-800', border: 'border-green-200' },
    rejected: { bg: 'bg-red-100', text: 'text-red-800', border: 'border-red-200' },
    revision_requested: { bg: 'bg-orange-100', text: 'text-orange-800', border: 'border-orange-200' },
    planning: { bg: 'bg-gray-100', text: 'text-gray-800', border: 'border-gray-200' },
    active: { bg: 'bg-green-100', text: 'text-green-800', border: 'border-green-200' },
    on_hold: { bg: 'bg-yellow-100', text: 'text-yellow-800', border: 'border-yellow-200' },
    archived: { bg: 'bg-gray-100', text: 'text-gray-800', border: 'border-gray-200' },
    queued: { bg: 'bg-gray-100', text: 'text-gray-800', border: 'border-gray-200' },
  };
  
  return colors[status]?.[type] || 'bg-gray-100';
}

/**
 * Get task type icon
 */
export function getTaskTypeIcon(type: string): string {
  const icons: Record<string, string> = {
    blog_post: '📝',
    research: '🔍',
    seo: '📊',
    dev: '💻',
    design: '🎨',
    video: '🎬',
    social_media: '📱',
    email_campaign: '📧',
    landing_page: '🌐',
    other: '📋',
  };
  
  return icons[type] || '📋';
}

/**
 * Get agent icon
 */
export function getAgentIcon(agentName: string): string {
  const icons: Record<string, string> = {
    ResearchAgent: '🔍',
    WriterAgent: '✍️',
    EditorAgent: '📝',
    SeoAgent: '📊',
    PlannerAgent: '📋',
  };
  
  return icons[agentName] || '🤖';
}

/**
 * Calculate progress percentage
 */
export function calculateProgress(current: number, total: number): number {
  if (total === 0) return 0;
  return Math.round((current / total) * 100);
}

/**
 * Debounce function
 */
export function debounce<T extends (...args: unknown[]) => unknown>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;
  
  return (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

/**
 * Deep clone an object
 */
export function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

/**
 * Check if value is empty (null, undefined, empty string, empty array, empty object)
 */
export function isEmpty(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === 'string') return value.trim() === '';
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === 'object') return Object.keys(value).length === 0;
  return false;
}

/**
 * Generate a random ID
 */
export function generateId(prefix = ''): string {
  const id = Math.random().toString(36).substring(2, 15);
  return prefix ? `${prefix}_${id}` : id;
}

/**
 * Parse JSON safely
 */
export function safeJsonParse<T>(json: string | null | undefined, defaultValue: T): T {
  if (!json) return defaultValue;
  try {
    return JSON.parse(json) as T;
  } catch {
    return defaultValue;
  }
}

/**
 * Get domain from URL
 */
export function getDomain(url: string): string {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname.replace('www.', '');
  } catch {
    return url;
  }
}

/**
 * Validate email format
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Sleep for specified milliseconds
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Group array by key
 */
export function groupBy<T>(array: T[], key: keyof T | ((item: T) => string)): Record<string, T[]> {
  return array.reduce((acc, item) => {
    const groupKey = typeof key === 'function' ? key(item) : String(item[key]);
    if (!acc[groupKey]) {
      acc[groupKey] = [];
    }
    acc[groupKey].push(item);
    return acc;
  }, {} as Record<string, T[]>);
}

/**
 * Sort array by key
 */
export function sortBy<T>(array: T[], key: keyof T | ((item: T) => number | string), order: 'asc' | 'desc' = 'asc'): T[] {
  return [...array].sort((a, b) => {
    const aVal = typeof key === 'function' ? key(a) : a[key];
    const bVal = typeof key === 'function' ? key(b) : b[key];
    
    if (aVal < bVal) return order === 'asc' ? -1 : 1;
    if (aVal > bVal) return order === 'asc' ? 1 : -1;
    return 0;
  });
}
