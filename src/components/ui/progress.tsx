/**
 * Progress Bar Component
 */

'use client';

import { cn, calculateProgress } from '@/lib/utils/helpers';

interface ProgressBarProps {
  value: number;
  max?: number;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'default' | 'success' | 'warning' | 'error';
  showLabel?: boolean;
  label?: string;
  className?: string;
  animated?: boolean;
}

export function ProgressBar({
  value,
  max = 100,
  size = 'md',
  variant = 'default',
  showLabel = false,
  label,
  className,
  animated = true,
}: ProgressBarProps) {
  const percentage = calculateProgress(value, max);

  const sizeStyles = {
    sm: 'h-1',
    md: 'h-2',
    lg: 'h-3',
  };

  const variantStyles = {
    default: 'bg-blue-600',
    success: 'bg-green-600',
    warning: 'bg-yellow-600',
    error: 'bg-red-600',
  };

  return (
    <div className={cn('w-full', className)}>
      {(showLabel || label) && (
        <div className="flex justify-between items-center mb-1">
          {label && <span className="text-sm text-gray-600">{label}</span>}
          {showLabel && (
            <span className="text-sm text-gray-500">{percentage}%</span>
          )}
        </div>
      )}
      <div className={cn('w-full bg-gray-200 rounded-full overflow-hidden', sizeStyles[size])}>
        <div
          className={cn(
            'h-full rounded-full transition-all duration-300',
            variantStyles[variant],
            animated && 'animate-pulse'
          )}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}

/**
 * Step Progress Component
 */
interface StepProgressProps {
  steps: { name: string; status?: 'pending' | 'current' | 'completed' }[];
  className?: string;
}

export function StepProgress({ steps, className }: StepProgressProps) {
  return (
    <div className={cn('flex items-center', className)}>
      {steps.map((step, index) => {
        const isLast = index === steps.length - 1;
        const isCompleted = step.status === 'completed';
        const isCurrent = step.status === 'current';
        const isPending = step.status === 'pending' || !step.status;

        return (
          <div key={index} className="flex items-center">
            {/* Step Circle */}
            <div
              className={cn(
                'flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium',
                isCompleted && 'bg-green-600 text-white',
                isCurrent && 'bg-blue-600 text-white',
                isPending && 'bg-gray-200 text-gray-500'
              )}
            >
              {isCompleted ? (
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                    clipRule="evenodd"
                  />
                </svg>
              ) : (
                index + 1
              )}
            </div>

            {/* Step Label */}
            {!isLast && (
              <span className={cn(
                'ml-2 mr-4 text-sm',
                isCompleted || isCurrent ? 'text-gray-900' : 'text-gray-500'
              )}>
                {step.name}
              </span>
            )}

            {/* Connector Line */}
            {!isLast && (
              <div
                className={cn(
                  'w-8 h-0.5',
                  isCompleted ? 'bg-green-600' : 'bg-gray-200'
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

/**
 * Timeline Component
 */
interface TimelineItem {
  date: string;
  title: string;
  description?: string;
  status?: 'completed' | 'current' | 'upcoming';
}

interface TimelineProps {
  items: TimelineItem[];
  className?: string;
}

export function Timeline({ items, className }: TimelineProps) {
  return (
    <div className={cn('relative', className)}>
      {/* Timeline Line */}
      <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-200" />

      {/* Timeline Items */}
      <div className="space-y-6">
        {items.map((item, index) => (
          <div key={index} className="relative flex gap-4">
            {/* Timeline Dot */}
            <div
              className={cn(
                'relative z-10 w-8 h-8 rounded-full flex items-center justify-center border-4',
                item.status === 'completed' && 'bg-green-600 border-green-200',
                item.status === 'current' && 'bg-blue-600 border-blue-200',
                item.status === 'upcoming' && 'bg-white border-gray-200'
              )}
            >
              {item.status === 'completed' && (
                <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                    clipRule="evenodd"
                  />
                </svg>
              )}
            </div>

            {/* Content */}
            <div className="flex-1 -mt-1">
              <div className="flex items-center gap-2">
                <h4 className={cn(
                  'font-medium',
                  item.status === 'completed' ? 'text-gray-900' :
                  item.status === 'current' ? 'text-blue-600' : 'text-gray-500'
                )}>
                  {item.title}
                </h4>
                <span className="text-sm text-gray-500">{item.date}</span>
              </div>
              {item.description && (
                <p className="text-sm text-gray-600 mt-1">{item.description}</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
