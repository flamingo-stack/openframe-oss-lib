'use client';

import { RemoteDesktopChatPanel, RemoteDesktopView } from '../../features/remote-session';
import { CheckCircleIcon, PrinterIcon } from '../../icons-v2-generated';
import { REMOTE_SESSION_CHAT_FIXTURE, REMOTE_SESSION_VIEW_FIXTURE } from '../fixtures/remote-session';
import type { ProductScreenViewProps } from '../types';

const noop = () => {};
const keepDraft = async () => false;

/**
 * What the stream shows: the device's desktop with the print queue open after
 * the spooler was restarted. A drawing, standing in for the host's live canvas.
 */
function DesktopPicture() {
  return (
    <div className="absolute inset-0 flex flex-col bg-ods-bg">
      <div className="flex min-h-0 flex-1 items-center justify-center p-[var(--spacing-system-l)]">
        <div className="flex w-full max-w-[480px] flex-col overflow-hidden rounded-md border border-ods-border bg-ods-card shadow-lg">
          <div className="flex items-center gap-[var(--spacing-system-xs)] border-b border-ods-border bg-ods-bg-surface px-[var(--spacing-system-sf)] py-[var(--spacing-system-xs)]">
            <PrinterIcon className="h-4 w-4 text-ods-text-secondary" />
            <span className="min-w-0 flex-1 truncate text-ods-text-primary text-h5">Print queue</span>
            <span className="size-2 rounded-full bg-ods-border" />
            <span className="size-2 rounded-full bg-ods-border" />
            <span className="size-2 rounded-full bg-ods-border" />
          </div>
          <div className="flex items-center gap-[var(--spacing-system-sf)] p-[var(--spacing-system-mf)]">
            <CheckCircleIcon className="h-6 w-6 flex-shrink-0 text-ods-success" />
            <div className="flex min-w-0 flex-col">
              <span className="text-ods-text-primary text-h4">Print Spooler restarted</span>
              <span className="text-ods-text-secondary text-h6">0 jobs waiting</span>
            </div>
          </div>
        </div>
      </div>
      <div className="flex flex-shrink-0 items-center gap-[var(--spacing-system-xs)] border-t border-ods-border bg-ods-card px-[var(--spacing-system-sf)] py-[var(--spacing-system-xs)]">
        <span className="size-4 rounded-sm bg-ods-border" />
        <span className="size-4 rounded-sm bg-ods-border" />
        <span className="flex items-center gap-[var(--spacing-system-xxs)] rounded-sm bg-ods-bg-surface px-[var(--spacing-system-xs)] py-[var(--spacing-system-xxs)]">
          <PrinterIcon className="h-4 w-4 text-ods-text-secondary" />
          <span className="text-ods-text-secondary text-h6">Print queue</span>
        </span>
      </div>
    </div>
  );
}

/** The product's remote desktop page mid-session; the narrow rendering hides the session chat. */
export default function RemoteSessionScreen({ compact = false }: ProductScreenViewProps) {
  return (
    <div className="h-full bg-ods-bg">
      <RemoteDesktopView
        {...REMOTE_SESSION_VIEW_FIXTURE}
        onBack={noop}
        onEnterFullscreen={noop}
        onExitFullscreen={noop}
        onOpenSettings={noop}
        chatOpen={!compact}
        onToggleChat={noop}
        screen={<DesktopPicture />}
        chat={
          compact ? null : (
            // The side column needs the room of the wide layout; a narrow frame keeps the screen alone.
            <div className="hidden min-h-0 content-md:flex">
              <RemoteDesktopChatPanel
                {...REMOTE_SESSION_CHAT_FIXTURE}
                sending={false}
                onSend={keepDraft}
                variant="side"
              />
            </div>
          )
        }
      />
    </div>
  );
}
