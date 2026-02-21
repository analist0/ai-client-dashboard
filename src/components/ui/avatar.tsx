/**
 * Avatar Component
 */

'use client';

import { cn, getInitials } from '@/lib/utils/helpers';
import Image from 'next/image';

interface AvatarProps {
  src?: string | null;
  name?: string | null;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  showFallback?: boolean;
}

export function Avatar({ src, name, size = 'md', className, showFallback = true }: AvatarProps) {
  const sizeStyles = {
    sm: 'w-6 h-6 text-xs',
    md: 'w-8 h-8 text-sm',
    lg: 'w-10 h-10 text-base',
    xl: 'w-12 h-12 text-lg',
  };

  const initials = name ? getInitials(name) : '?';

  if (src) {
    return (
      <div
        className={cn(
          'relative rounded-full overflow-hidden bg-gray-200',
          sizeStyles[size],
          className
        )}
      >
        <Image
          src={src}
          alt={name || 'Avatar'}
          fill
          className="object-cover"
        />
      </div>
    );
  }

  if (showFallback) {
    return (
      <div
        className={cn(
          'flex items-center justify-center rounded-full bg-gradient-to-br from-blue-400 to-blue-600 text-white font-medium',
          sizeStyles[size],
          className
        )}
        title={name || undefined}
      >
        {initials}
      </div>
    );
  }

  return (
    <div
      className={cn(
        'flex items-center justify-center rounded-full bg-gray-200 text-gray-500',
        sizeStyles[size],
        className
      )}
    >
      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
      </svg>
    </div>
  );
}

/**
 * AvatarGroup Component
 */
interface AvatarGroupProps {
  avatars: { src?: string | null; name?: string | null }[];
  size?: 'sm' | 'md' | 'lg';
  max?: number;
  className?: string;
}

export function AvatarGroup({ avatars, size = 'md', max = 4, className }: AvatarGroupProps) {
  const displayAvatars = avatars.slice(0, max);
  const remaining = avatars.length - max;

  return (
    <div className={cn('flex -space-x-2', className)}>
      {displayAvatars.map((avatar, index) => (
        <Avatar
          key={index}
          src={avatar.src}
          name={avatar.name}
          size={size}
          className="ring-2 ring-white"
        />
      ))}
      {remaining > 0 && (
        <div
          className={cn(
            'flex items-center justify-center rounded-full bg-gray-100 text-gray-600 font-medium ring-2 ring-white',
            size === 'sm' ? 'w-6 h-6 text-xs' : size === 'md' ? 'w-8 h-8 text-sm' : 'w-10 h-10 text-base'
          )}
        >
          +{remaining}
        </div>
      )}
    </div>
  );
}
