'use client';

import { forwardRef, type ReactNode } from 'react';
import { cn } from '../../../utils/cn';
import { ChatsIcon, Chevrons03LeftIcon, Chevrons03RightIcon, MonitorOffIcon } from '../../icons-v2-generated';
import { OpenFrameLogo } from '../../icons/openframe-logo';
import { Button } from '../../ui/button/button';
import { SquareAvatar } from '../../ui/square-avatar';
import {
  REMOTE_SESSION_DRAG_HANDLE_CLASS,
  RemoteSessionDragger,
  RemoteSessionOrgLogo,
  RemoteSessionStatusRow,
} from './remote-session-parts';
import type { RemoteSessionDragHandlers, RemoteSessionParty, RemoteSessionViewer } from './types';

export interface RemoteSessionBlockFrameProps {
  /** The summary or the chat panel. */
  children: ReactNode;
  /** The chat panel has a fixed height; the summary hugs its content. */
  expanded?: boolean;
  onHide: () => void;
  className?: string;
}

/**
 * The session block's card: 440 px wide, the open panel on top and the
 * "Hide this Block" bar at the bottom. The ref is the rendered surface, which
 * a desktop host sizes its window to.
 */
export const RemoteSessionBlockFrame = forwardRef<HTMLDivElement, RemoteSessionBlockFrameProps>(
  ({ children, expanded = false, onHide, className }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          'flex w-[440px] shrink-0 flex-col overflow-hidden rounded-md border border-ods-border bg-ods-bg',
          expanded && 'h-[680px]',
          className,
        )}
      >
        {children}
        <button
          type="button"
          className="flex h-12 w-full shrink-0 items-center gap-[var(--spacing-system-xs)] border-t border-ods-border bg-ods-card px-[var(--spacing-system-m)]"
          onClick={onHide}
        >
          <Chevrons03RightIcon size={24} />
          <span className="min-w-0 flex-1 truncate text-left text-ods-text-secondary text-h4">Hide this Block</span>
          <OpenFrameLogo className="size-6 shrink-0" />
        </button>
      </div>
    );
  },
);
RemoteSessionBlockFrame.displayName = 'RemoteSessionBlockFrame';

/** The red End Session action shared by the summary and the chat panel. */
export function RemoteSessionEndButton({ onEndSession }: { onEndSession: () => void }) {
  return (
    <Button
      variant="outline"
      fullWidth
      leftIcon={<MonitorOffIcon size={24} color="currentColor" className="text-ods-error" />}
      onClick={onEndSession}
    >
      End Session
    </Button>
  );
}

export interface RemoteSessionSummaryProps {
  party: RemoteSessionParty;
  /** Elapsed session time, e.g. from `useRemoteSessionTimer`. */
  elapsed: string;
  showRecordingTag?: boolean;
  /** Everyone in the session while colleagues watch it, the host included; hidden when empty. */
  viewers?: RemoteSessionViewer[];
  onOpenChat: () => void;
  onEndSession: () => void;
  /** Makes the header row and the dragger move the window. */
  dragHandlers?: RemoteSessionDragHandlers;
}

/** The compact block: who is connected and for how long, Open Chat / End Session. */
export function RemoteSessionSummary({
  party,
  elapsed,
  showRecordingTag = false,
  viewers,
  onOpenChat,
  onEndSession,
  dragHandlers,
}: RemoteSessionSummaryProps) {
  const technician = party.technicianName;
  return (
    <div className="relative flex flex-col gap-[var(--spacing-system-m)] p-[var(--spacing-system-m)]">
      <RemoteSessionDragger dragHandlers={dragHandlers} />
      <div
        className={cn(
          'flex w-full items-center gap-[var(--spacing-system-xs)] pr-[var(--spacing-system-mf)]',
          dragHandlers && REMOTE_SESSION_DRAG_HANDLE_CLASS,
        )}
        {...dragHandlers}
      >
        {technician ? (
          <SquareAvatar
            variant="round"
            sizePx={48}
            src={party.technicianAvatarUrl ?? undefined}
            fallback={technician}
          />
        ) : (
          <RemoteSessionOrgLogo name={party.organizationName} logoUrl={party.organizationLogoUrl} sizePx={48} />
        )}
        <div className="flex min-w-0 flex-1 flex-col">
          <p className="w-full truncate text-ods-text-primary text-h4">
            {technician ? `${technician} connected` : 'IT support team is connected'}{' '}
            <span className="text-ods-text-secondary">({elapsed})</span>
          </p>
          <p className="w-full truncate text-ods-text-secondary text-h4">{party.organizationName}</p>
        </div>
      </div>
      <RemoteSessionStatusRow showRecordingTag={showRecordingTag} viewers={viewers} />
      <div className="flex w-full items-stretch gap-[var(--spacing-system-m)]">
        <Button
          variant="outline"
          fullWidth
          leftIcon={<ChatsIcon size={24} color="currentColor" />}
          onClick={onOpenChat}
        >
          Open Chat
        </Button>
        <RemoteSessionEndButton onEndSession={onEndSession} />
      </div>
    </div>
  );
}

export interface RemoteSessionMinimizedChipProps {
  party: RemoteSessionParty;
  onExpand: () => void;
  /** Lets the chip move the window too; the host tells a drag from a click. */
  dragHandlers?: RemoteSessionDragHandlers;
}

/** The hidden block: the technician's avatar (or the organization's logo) and a chevron to bring it back. */
export const RemoteSessionMinimizedChip = forwardRef<HTMLButtonElement, RemoteSessionMinimizedChipProps>(
  ({ party, onExpand, dragHandlers }, ref) => {
    const technician = party.technicianName;
    return (
      <button
        ref={ref}
        type="button"
        aria-label="Show session block"
        className={cn(
          'flex shrink-0 flex-col overflow-hidden rounded-md border border-ods-border',
          dragHandlers && REMOTE_SESSION_DRAG_HANDLE_CLASS,
        )}
        onClick={onExpand}
        {...dragHandlers}
      >
        {technician ? (
          <SquareAvatar
            sizePx={48}
            src={party.technicianAvatarUrl ?? undefined}
            fallback={technician}
            className="rounded-none"
          />
        ) : (
          <RemoteSessionOrgLogo
            name={party.organizationName}
            logoUrl={party.organizationLogoUrl}
            sizePx={48}
            className="rounded-none border-0"
          />
        )}
        <span className="flex h-9 w-12 items-center justify-center border-t border-ods-border bg-ods-card">
          <Chevrons03LeftIcon size={24} />
        </span>
      </button>
    );
  },
);
RemoteSessionMinimizedChip.displayName = 'RemoteSessionMinimizedChip';
