"use client";

import React from 'react';
import { cn } from "../utils/cn";
import { getProxiedImageUrl } from '../utils/image-proxy';
import { SquareAvatar } from './ui/square-avatar';

interface UserDisplayProps {
  name: string;
  avatarUrl?: string | null;
  /** optional secondary text (e.g., relative timestamp) */
  subtitle?: string | null;
  /** Avatar size in px (defaults 32) */
  size?: number;
  /** Avatar corner treatment, forwarded to SquareAvatar. Default 'square'. */
  shape?: 'square' | 'round';
  /** Compact typography (14px/20px rows — video-bite overlay density). */
  compact?: boolean;
  className?: string;
}

/**
 * Reusable horizontal avatar + name (+ optional subtitle) row that follows
 * the visual pattern used in CommentCard headers.
 */
export function UserDisplay({ name, avatarUrl, subtitle, size = 32, shape = 'square', compact = false, className }: UserDisplayProps) {
  return (
    <div className={cn('flex items-center gap-2 min-w-0', className)}>
      <SquareAvatar
        src={avatarUrl ? getProxiedImageUrl(avatarUrl) || avatarUrl : undefined}
        fallback={name}
        alt={name}
        sizePx={size}
        variant={shape}
      />
      <div className="min-w-0 flex-1">
        <p className={cn(
          "text-ods-text-primary truncate",
          compact ? 'text-h6' : 'text-h4',
        )}>
          {name}
        </p>
        {subtitle && (
          <span className={cn(
            "text-h6 text-ods-text-secondary truncate block",
          )}>
            {subtitle}
          </span>
        )}
      </div>
    </div>
  );
} 