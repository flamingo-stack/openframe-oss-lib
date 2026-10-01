'use client';

import { type CSSProperties, type ReactNode, useEffect, useState } from 'react';
import { cn } from '../../../utils/cn';
import { DraggerIcon, RecordingIcon } from '../../icons-v2-generated';
import { OpenFrameLogo } from '../../icons/openframe-logo';
import { SquareAvatar } from '../../ui/square-avatar';
import type { RemoteSessionDragHandlers } from './types';

/**
 * The remote session surfaces are fixed-size desktop windows (440 / 600 px
 * wide), so the responsive ODS scale would step their typography and spacing
 * down to the mobile values below the 800 px breakpoint. The scope pins the
 * scale to its desktop values; everything inside keeps the regular utilities.
 */
const DESKTOP_SCALE = {
  '--spacing-system-xs': '0.5rem',
  '--spacing-system-s': '0.75rem',
  '--spacing-system-m': '1rem',
  '--spacing-system-l': '1.5rem',
  '--spacing-system-xl': '2.5rem',
  '--font-size-h1-title': '3.5rem',
  '--font-size-h2-sub-title': '2rem',
  '--font-size-h3-body': '1.125rem',
  '--font-size-h4-body': '1.125rem',
  '--font-size-h5-caption': '0.875rem',
  '--font-size-h6-caption': '0.875rem',
  '--font-line-space-h1-main-title': '4rem',
  '--font-line-space-h2-sub-title': '2.5rem',
  '--font-line-space-h3-body': '1.5rem',
  '--font-line-space-h4-body': '1.5rem',
  '--font-line-space-h5-caption': '1.25rem',
  '--font-line-space-h6-caption': '1.25rem',
} as CSSProperties;

export interface RemoteSessionScopeProps {
  children: ReactNode;
  className?: string;
}

/**
 * Root of every remote session surface: the desktop type and spacing scale,
 * and the OpenFrame brand whatever the host app's tenant branding is - the
 * "you are being helped" surfaces are OpenFrame-branded by design.
 */
export function RemoteSessionScope({ children, className }: RemoteSessionScopeProps) {
  return (
    <div data-app-type="openframe" style={DESKTOP_SCALE} className={className}>
      {children}
    </div>
  );
}

export interface RemoteSessionOrgLogoProps {
  name: string;
  logoUrl?: string | null;
  /** Width and height in px. */
  sizePx: number;
  className?: string;
}

/** Organization logo tile; the OpenFrame mark when there is no logo. */
export function RemoteSessionOrgLogo({ name, logoUrl, sizePx, className }: RemoteSessionOrgLogoProps) {
  if (logoUrl) {
    return (
      <SquareAvatar
        variant="square"
        fit="contain"
        sizePx={sizePx}
        src={logoUrl}
        alt={name}
        fallback={name}
        className={cn('shrink-0 rounded-md border border-ods-border bg-ods-card', className)}
      />
    );
  }
  return (
    <div
      role="img"
      aria-label={name}
      style={{ width: sizePx, height: sizePx }}
      className={cn(
        'flex shrink-0 items-center justify-center rounded-md border border-ods-border bg-ods-card',
        className,
      )}
    >
      <OpenFrameLogo className="size-1/2" />
    </div>
  );
}

/** The green SESSION RECORDING tag. */
export function RemoteSessionRecordingTag() {
  return (
    <div className="flex h-8 items-center gap-[var(--spacing-system-xs)] self-start rounded-md bg-ods-success-secondary p-[var(--spacing-system-xsf)]">
      <RecordingIcon size={16} color="currentColor" className="text-ods-success" />
      <span className="text-ods-success text-h5">Session Recording</span>
    </div>
  );
}

/** Grab cursor on the surfaces the window is moved by. */
export const REMOTE_SESSION_DRAG_HANDLE_CLASS = 'cursor-grab active:cursor-grabbing';

/** The dragger glyph in the top-right corner of a block header: the visible handle for moving it. */
export function RemoteSessionDragger({ dragHandlers }: { dragHandlers?: RemoteSessionDragHandlers }) {
  return (
    <span
      aria-hidden
      className={cn(
        'absolute right-[var(--spacing-system-xsf)] top-[var(--spacing-system-xsf)] text-ods-text-secondary',
        dragHandlers && REMOTE_SESSION_DRAG_HANDLE_CLASS,
      )}
      {...dragHandlers}
    >
      <DraggerIcon size={24} color="currentColor" />
    </span>
  );
}

/** `m:ss` for an elapsed duration; `h:mm:ss` from the first hour on. */
export function formatRemoteSessionElapsed(elapsedMs: number): string {
  const total = Math.max(0, Math.floor(elapsedMs / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = String(total % 60).padStart(2, '0');
  return hours > 0 ? `${hours}:${String(minutes).padStart(2, '0')}:${seconds}` : `${minutes}:${seconds}`;
}

/** The session's elapsed time since `startedAt` (ISO), ticking once a second. */
export function useRemoteSessionTimer(startedAt: string): string {
  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNowMs(Date.now()), 1_000);
    return () => clearInterval(timer);
  }, []);
  return formatRemoteSessionElapsed(nowMs - Date.parse(startedAt));
}
