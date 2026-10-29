'use client';

import {
  ChatOffIcon,
  ChatTextIcon,
  Chevron02DownIcon,
  Collapse02Icon,
  Ellipsis01Icon,
  MonitorIcon,
  Settings01Icon,
} from '../../icons-v2-generated';
import { OpenframeLogoIcon } from '../../icons-v2-generated/logos/openframe-logo-icon';
import { ActionsMenuDropdown, type ActionsMenuGroup } from '../../ui/actions-menu';
import { Button } from '../../ui/button/button';

export interface RemoteDesktopFullscreenToolbarProps {
  deviceName: string;
  displayMenuGroups: ActionsMenuGroup[];
  currentDisplayLabel: string;
  actionsMenuGroups: ActionsMenuGroup[];
  onOpenSettings: () => void;
  onExitFullscreen: () => void;
  /** Session chat toggle - omitted when the session has no chat. */
  chatOpen?: boolean;
  onToggleChat?: () => void;
}

/**
 * Compact overlay chrome for the fullscreen remote-desktop mode (Figma 1-70992):
 * a floating semi-transparent bar at top-center (device name, display switcher,
 * actions / exit-fullscreen / settings) plus a dimmed OpenFrame logo in the
 * top-left corner of the stream. Rendered inside the fullscreen container,
 * absolutely positioned over the screen.
 */
export function RemoteDesktopFullscreenToolbar({
  deviceName,
  displayMenuGroups,
  currentDisplayLabel,
  actionsMenuGroups,
  onOpenSettings,
  onExitFullscreen,
  chatOpen = false,
  onToggleChat,
}: RemoteDesktopFullscreenToolbarProps) {
  return (
    <>
      <OpenframeLogoIcon
        color="var(--color-text-on-accent)"
        secondaryColor="var(--color-text-primary)"
        className="absolute left-[var(--spacing-system-mf)] top-[var(--spacing-system-mf)] z-10 h-6 w-6 opacity-50"
      />
      <div
        className={
          'absolute left-1/2 top-0 z-10 w-[calc(100%-7rem)] -translate-x-1/2 ' +
          'flex items-center gap-[var(--spacing-system-xs)] ' +
          'rounded-b-[6px] border-x border-b border-ods-border bg-ods-overlay ' +
          'py-[var(--spacing-system-xsf)] pl-[var(--spacing-system-mf)] pr-[var(--spacing-system-xsf)]'
        }
      >
        <div className="flex min-w-0 flex-1 items-center gap-[var(--spacing-system-xsf)]">
          <span className="truncate text-ods-text-primary text-h6">{deviceName}</span>
          {displayMenuGroups.length > 0 && (
            <ActionsMenuDropdown
              groups={displayMenuGroups}
              customTrigger={
                <Button variant="outline" size="small" type="button" aria-label="Switch display" className="shrink-0">
                  <MonitorIcon />
                  <span className="whitespace-nowrap">{currentDisplayLabel}</span>
                  <Chevron02DownIcon />
                </Button>
              }
            />
          )}
        </div>
        <div className="flex flex-shrink-0 items-center gap-[var(--spacing-system-xs)]">
          {onToggleChat && (
            <Button
              variant="outline"
              size="small"
              onClick={onToggleChat}
              leftIcon={chatOpen ? <ChatOffIcon className="h-4 w-4" /> : <ChatTextIcon className="h-4 w-4" />}
            >
              <span className="text-h5">{chatOpen ? 'Close Chat' : 'Open Chat'}</span>
            </Button>
          )}
          <ActionsMenuDropdown
            groups={actionsMenuGroups}
            customTrigger={
              <Button
                variant="outline"
                size="icon-sm"
                aria-label="Actions"
                leftIcon={<Ellipsis01Icon className="h-4 w-4" />}
              />
            }
          />
          <Button
            variant="outline"
            size="icon-sm"
            aria-label="Exit fullscreen"
            onClick={onExitFullscreen}
            leftIcon={<Collapse02Icon className="h-4 w-4" />}
          />
          <Button
            variant="outline"
            size="icon-sm"
            aria-label="Settings"
            onClick={onOpenSettings}
            leftIcon={<Settings01Icon className="h-4 w-4" />}
          />
        </div>
      </div>
    </>
  );
}
