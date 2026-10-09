'use client';

import type { ReactNode } from 'react';
import {
  ChatOffIcon,
  ChatTextIcon,
  Chevron02DownIcon,
  Collapse02Icon,
  Expand02Icon,
  MonitorIcon,
  Settings01Icon,
} from '../../icons-v2-generated';
import { PageLayout } from '../../layout/page-layout';
import { ActionsMenuDropdown, type ActionsMenuGroup } from '../../ui/actions-menu';
import { Button } from '../../ui/button/button';
import { Skeleton } from '../../ui/skeleton';
import { TruncateText } from '../../ui/truncate-text';
import { RemoteDesktopFullscreenToolbar } from './remote-desktop-fullscreen-toolbar';

/** The page chrome both the view and its skeleton render in. */
const PAGE_CLASS = 'h-full overflow-hidden px-[var(--spacing-system-l)] pb-[var(--spacing-system-l)]';

/** The header card: the device row, and under it the display row when there is one to pick. */
const CONTROLS_BAR_CLASS =
  'flex flex-shrink-0 flex-col overflow-hidden rounded-md border border-ods-border bg-ods-card';

const CONTROLS_ROW_CLASS =
  'flex items-center justify-between gap-[var(--spacing-system-mf)] px-[var(--spacing-system-mf)] py-[var(--spacing-system-xs)]';

export interface RemoteDesktopViewProps {
  /** First line of the device header. */
  deviceName: string;
  /** The device's customer, on the second line of the header; "Unknown Customer" when absent. */
  organizationName?: string | null;
  /** The "Back" control over the header; left out, the page has none (a picture of the page has nowhere to go back to). */
  onBack?: () => void;
  /**
   * The compact chrome over a window-filling screen. The host owns the browser's
   * fullscreen state and passes it here.
   */
  fullscreen?: boolean;
  onEnterFullscreen: () => void;
  onExitFullscreen: () => void;
  /**
   * The display switcher's menu, one entry per separate display. The switcher is
   * the full-width row under the device row (Figma 2155:109503), and it is left
   * out while this is empty: one display, or an agent that reports none.
   */
  displayMenuGroups?: ActionsMenuGroup[];
  /** The switcher's label, e.g. "Display 2", or "Display" before the agent has named one. */
  currentDisplayLabel: string;
  actionsMenuGroups: ActionsMenuGroup[];
  onOpenSettings: () => void;
  /** Session chat toggle - both omitted when the session has no chat. */
  chatOpen?: boolean;
  onToggleChat?: () => void;
  /**
   * What fills the screen box: the host's live canvas with its status overlays.
   * The box is `relative`, so the content positions itself against it, and it
   * keeps its place in the tree across `fullscreen`, so a canvas a stream is
   * attached to is never remounted.
   */
  screen: ReactNode;
  /**
   * The open chat panel, or nothing while it is closed. Rendered beside the
   * screen, and over it in fullscreen: the host passes the panel in the matching
   * variant (`side` or `overlay`).
   */
  chat?: ReactNode;
  /** Dialogs the page owns (settings, shortcuts), rendered after the session. */
  children?: ReactNode;
}

/**
 * The remote desktop page: the device header with the session controls, the
 * screen and the session chat. Everything that talks to the device (the
 * connection, the stream, input) is the host's, passed in through `screen`.
 */
export function RemoteDesktopView({
  deviceName,
  organizationName,
  onBack,
  fullscreen = false,
  onEnterFullscreen,
  onExitFullscreen,
  displayMenuGroups = [],
  currentDisplayLabel,
  actionsMenuGroups,
  onOpenSettings,
  chatOpen = false,
  onToggleChat,
  screen,
  chat,
  children,
}: RemoteDesktopViewProps) {
  const controlsBar = (
    <div className={CONTROLS_BAR_CLASS}>
      <div className={CONTROLS_ROW_CLASS}>
        <div className="flex min-w-0 items-center gap-[var(--spacing-system-mf)]">
          <div className="flex-shrink-0 rounded-md border border-ods-border bg-ods-card p-[var(--spacing-system-xsf)]">
            <MonitorIcon className="h-4 w-4 text-ods-text-primary" />
          </div>
          <div className="flex min-w-0 flex-col">
            <TruncateText>{deviceName}</TruncateText>
            <TruncateText
              variant="h6"
              tone="secondary"
            >{`Desktop • ${organizationName || 'Unknown Customer'}`}</TruncateText>
          </div>
        </div>
        <div className="flex flex-shrink-0 items-center gap-[var(--spacing-system-xs)]">
          {onToggleChat && (
            <Button
              variant="outline"
              onClick={onToggleChat}
              leftIcon={
                chatOpen ? (
                  <ChatOffIcon className="h-4 w-4 md:h-6 md:w-6" />
                ) : (
                  <ChatTextIcon className="h-4 w-4 md:h-6 md:w-6" />
                )
              }
            >
              {/* A narrow page keeps the icon and drops the words: the bar never pushes the device's name out. */}
              <span className="sr-only content-md:not-sr-only">{chatOpen ? 'Close Chat' : 'Open Chat'}</span>
            </Button>
          )}
          <ActionsMenuDropdown groups={actionsMenuGroups} triggerAriaLabel="Actions" />
          <Button
            variant="outline"
            size="icon"
            aria-label="Settings"
            onClick={onOpenSettings}
            leftIcon={<Settings01Icon />}
          />
          <Button
            variant="outline"
            size="icon"
            aria-label={fullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
            onClick={fullscreen ? onExitFullscreen : onEnterFullscreen}
            leftIcon={fullscreen ? <Collapse02Icon /> : <Expand02Icon />}
          />
        </div>
      </div>
      {/* The monitor selector is a row of its own under the device row, the full
          width of the card (Figma 2155:109503): the label never competes with the
          device's name for the header's width. Hidden with one display or none. */}
      {displayMenuGroups.length > 0 && (
        <ActionsMenuDropdown
          groups={displayMenuGroups}
          align="start"
          customTrigger={
            <button
              type="button"
              aria-label="Switch display"
              className="flex w-full items-center gap-[var(--spacing-system-xs)] border-t border-ods-border p-[var(--spacing-system-sf)] text-left text-ods-text-primary outline-none transition-colors hover:bg-ods-bg-hover focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ods-focus"
            >
              <MonitorIcon className="h-6 w-6 shrink-0" />
              <span className="min-w-0 flex-1 truncate text-h4">{currentDisplayLabel}</span>
              <Chevron02DownIcon className="h-6 w-6 shrink-0" />
            </button>
          }
        />
      )}
    </div>
  );

  return (
    <PageLayout
      className={PAGE_CLASS}
      backButton={onBack ? { label: 'Back', onClick: onBack } : undefined}
      showHeader={!fullscreen}
    >
      <div className={fullscreen ? 'fixed inset-0 z-50 flex flex-col bg-black' : 'contents'}>
        {fullscreen ? (
          <RemoteDesktopFullscreenToolbar
            deviceName={deviceName}
            displayMenuGroups={displayMenuGroups}
            currentDisplayLabel={currentDisplayLabel}
            actionsMenuGroups={actionsMenuGroups}
            onOpenSettings={onOpenSettings}
            onExitFullscreen={onExitFullscreen}
            chatOpen={onToggleChat ? chatOpen : undefined}
            onToggleChat={onToggleChat}
          />
        ) : (
          controlsBar
        )}
        {/* One wrapper in both modes: the screen must keep its DOM node across
            the fullscreen toggle (the host attaches a stream to its canvas once),
            so the tree shape never changes. The chat keeps ONE place in the tree
            too, so its draft and scroll survive the toggle: beside the screen as
            the `side` panel, and in fullscreen the `overlay` panel positions
            itself over the screen against this wrapper (the screen fills it). */}
        <div className={`relative flex min-h-0 min-w-0 flex-1 ${fullscreen ? '' : 'gap-[var(--spacing-system-mf)]'}`}>
          <div className={`relative min-h-0 min-w-0 flex-1 overflow-hidden bg-black ${fullscreen ? '' : 'rounded-lg'}`}>
            {screen}
          </div>
          {chat}
        </div>
      </div>

      {children}
    </PageLayout>
  );
}

/** The page while the device is still loading: the header bar as placeholders over an empty screen. */
export function RemoteDesktopViewSkeleton({ onBack }: Pick<RemoteDesktopViewProps, 'onBack'>) {
  return (
    <PageLayout className={PAGE_CLASS} backButton={onBack ? { label: 'Back', onClick: onBack } : undefined}>
      <div className={CONTROLS_BAR_CLASS}>
        <div className={CONTROLS_ROW_CLASS}>
          <div className="flex min-w-0 items-center gap-[var(--spacing-system-mf)]">
            <Skeleton className="h-9 w-9 flex-shrink-0 rounded-md" />
            <div className="flex min-w-0 flex-col gap-[var(--spacing-system-xxs)]">
              <Skeleton className="h-5 w-48" />
              <Skeleton className="h-4 w-36" />
            </div>
          </div>
          <div className="flex flex-shrink-0 items-center gap-[var(--spacing-system-xs)]">
            <Skeleton className="h-11 w-11 rounded-lg md:h-12 md:w-12" />
            <Skeleton className="h-11 w-11 rounded-lg md:h-12 md:w-12" />
            <Skeleton className="h-11 w-11 rounded-lg md:h-12 md:w-12" />
          </div>
        </div>
      </div>

      <div className="min-h-0 min-w-0 flex-1 rounded-lg bg-black" />
    </PageLayout>
  );
}
