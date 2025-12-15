"use client";

import React from 'react';
import { cn } from "../utils/cn";
import { SquareAvatar } from './square-avatar';

interface UserDisplayProps {
  name: string;
  avatarUrl?: string | null;
  /** optional secondary text (e.g., relative timestamp) */
  subtitle?: string | null;
  /** Avatar size in px (defaults 32) */
  size?: number;
  className?: string;
}

/**
 * Reusable horizontal avatar + name (+ optional subtitle) row that follows
 * the visual pattern used in CommentCard headers.
 */
export function UserDisplay({ name, avatarUrl, subtitle, size = 32, className }: UserDisplayProps) {
  return (
    <div className={cn('flex items-center gap-2 min-w-0', className)}>
      <SquareAvatar src={avatarUrl ?? undefined} fallbackName={name} size={size} />
      <div className="min-w-0 flex-1">
        <p className="font-['DM_Sans'] text-lg leading-[22px] text-ods-text-primary truncate">
          {name}
        </p>
        {subtitle && (
          <span className="font-['DM_Sans'] text-md leading-[16px] text-ods-text-secondary truncate">
            {subtitle}
          </span>
        )}
      </div>
    </div>
  );
} 