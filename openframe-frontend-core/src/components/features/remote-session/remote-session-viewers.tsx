'use client';

import { useState } from 'react';
import { cn } from '../../../utils/cn';
import { Chevron02DownIcon, Chevron02UpIcon } from '../../icons-v2-generated';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../../ui/dropdown-menu';
import { SquareAvatar } from '../../ui/square-avatar';
import type { RemoteSessionViewer } from './types';

function viewerLabel(viewer: RemoteSessionViewer): string {
  if (viewer.isHost) return `${viewer.name} (host)`;
  if (viewer.isYou) return `${viewer.name} (you)`;
  return viewer.name;
}

/** The host first, everyone else in the order the backend reports them. */
function hostFirst(viewers: RemoteSessionViewer[]): RemoteSessionViewer[] {
  return [...viewers.filter(viewer => viewer.isHost), ...viewers.filter(viewer => !viewer.isHost)];
}

export interface RemoteSessionViewersProps {
  /** Everyone in the session, the host included. */
  viewers: RemoteSessionViewer[];
  /** Faces shown before the rest collapse into "+N". */
  max?: number;
  className?: string;
}

/**
 * Who is in a live session: an avatar stack (the host ringed in the accent
 * colour) that opens the full list. Shown to the host, to the watchers and to
 * the end user.
 */
export function RemoteSessionViewers({ viewers, max = 4, className }: RemoteSessionViewersProps) {
  const [open, setOpen] = useState(false);
  if (viewers.length === 0) return null;

  const ordered = hostFirst(viewers);
  const faces = ordered.slice(0, max);
  const overflow = ordered.length - faces.length;
  const Chevron = open ? Chevron02UpIcon : Chevron02DownIcon;

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger
        aria-label={`In this session: ${ordered.map(viewerLabel).join(', ')}`}
        className={cn(
          'flex shrink-0 items-center gap-[var(--spacing-system-xxs)] rounded-md outline-none',
          'focus-visible:ring-2 focus-visible:ring-ods-focus',
          className,
        )}
      >
        <span className="flex items-center">
          {faces.map((viewer, index) => (
            <SquareAvatar
              key={viewer.id}
              variant="round"
              sizePx={32}
              src={viewer.avatarUrl ?? undefined}
              alt={viewer.name}
              fallback={viewer.name}
              className={cn(
                'relative bg-ods-bg',
                viewer.isHost ? 'ring-2 ring-ods-accent' : 'ring-1 ring-ods-border',
                index > 0 && '-ml-2',
              )}
              style={{ zIndex: faces.length - index + 1 }}
            />
          ))}
          {overflow > 0 && (
            <span className="relative -ml-2 flex size-8 shrink-0 items-center justify-center rounded-full bg-ods-bg text-ods-text-secondary ring-1 ring-ods-border text-h6">
              +{overflow}
            </span>
          )}
        </span>
        <span className="flex size-8 items-center justify-center rounded-md text-ods-text-primary">
          <Chevron size={16} color="currentColor" />
        </span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[280px] p-0">
        {ordered.map(viewer => (
          <DropdownMenuItem
            key={viewer.id}
            className={cn(
              'gap-[var(--spacing-system-xsf)] rounded-none border-b border-ods-border bg-ods-bg last:border-b-0',
              'py-[var(--spacing-system-s)] pl-[var(--spacing-system-mf)] pr-[var(--spacing-system-xs)] text-h4',
            )}
          >
            <SquareAvatar
              variant="round"
              sizePx={24}
              src={viewer.avatarUrl ?? undefined}
              alt=""
              fallback={viewer.name}
              className="shrink-0"
            />
            <span className="min-w-0 flex-1 truncate">{viewerLabel(viewer)}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
