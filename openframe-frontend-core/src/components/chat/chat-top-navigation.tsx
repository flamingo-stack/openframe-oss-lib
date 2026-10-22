'use client';

import { forwardRef, type HTMLAttributes, type ReactNode } from 'react';
import { cn } from '../../utils/cn';
import { Settings01Icon, SidebarIcon } from '../icons-v2-generated';
import { TextLineSkeleton } from '../loading/unified-skeleton';
import { Button } from '../ui/button';
import { useLoadingScope } from '../ui/loading-scope';
import { SquareAvatar } from '../ui/square-avatar';

export interface ChatTopNavigationProps extends HTMLAttributes<HTMLElement> {
  /** Who the user is talking to. */
  name: string;
  /** Line under the name (e.g. "Your AI Assistant", "IT Technician"). */
  subtitle?: string;
  avatarUrl?: string | null;
  /** Actions after the identity (e.g. "Request a Technician"). */
  actions?: ReactNode;
  /** Shows the sidebar toggle at the start of the bar. */
  onToggleSidebar?: () => void;
  /** Whether the sidebar is currently shown; drives the toggle's state. */
  sidebarOpen?: boolean;
  /** Shows the settings button at the end of the bar. */
  onOpenSettings?: () => void;
  /** Content above the bar, full width (e.g. a "Back to ..." strip). */
  before?: ReactNode;
  /** Identity still resolving: placeholders instead of a default name that
   *  would flash before the tenant's branding lands. A loading scope does the same. The subtitle's bar is drawn
   *  only when the bar has a subtitle (`subtitle` given, `''` while it is read). */
  isLoading?: boolean;
}

/** An edge button is a bar cell (`Button variant="cell"`), square: the bar's 56px. */
const EDGE_CELL_CLASS = 'w-14';

/**
 * Top bar of the fae chat v2 layout (Figma `chat-top-navigation`): an optional
 * sidebar toggle, the counterpart's avatar, name and role, the host's actions
 * and an optional settings button, split by vertical dividers.
 */
const ChatTopNavigation = forwardRef<HTMLElement, ChatTopNavigationProps>(
  (
    {
      className,
      name,
      subtitle,
      avatarUrl,
      actions,
      onToggleSidebar,
      sidebarOpen,
      onOpenSettings,
      before,
      isLoading: isLoadingProp,
      ...props
    },
    ref,
  ) => {
    // ONE switch: in a page's loading state (or while the host reads the identity) the identity is its skeleton.
    const isLoading = useLoadingScope() || isLoadingProp;
    return (
      <header ref={ref} className={cn('flex shrink-0 flex-col bg-ods-bg', className)} {...props}>
        {before}
        <div className="flex h-14 items-stretch divide-x divide-ods-border border-b border-ods-border">
          {onToggleSidebar && (
            <Button
              variant="cell"
              type="button"
              onClick={onToggleSidebar}
              aria-label={sidebarOpen ? 'Hide sidebar' : 'Show sidebar'}
              aria-expanded={sidebarOpen}
              className={EDGE_CELL_CLASS}
            >
              <SidebarIcon />
            </Button>
          )}
          <div className="flex min-w-0 flex-1 items-center gap-[var(--spacing-system-m)] px-[var(--spacing-system-m)]">
            <SquareAvatar
              loading={isLoading}
              src={avatarUrl ?? undefined}
              alt={name}
              fallback={name}
              size="md"
              variant="round"
            />
            {isLoading ? (
              <div className="flex min-w-0 flex-1 flex-col">
                <TextLineSkeleton type="h3" className="w-24" />
                {subtitle !== undefined && <TextLineSkeleton type="h6" className="w-32" />}
              </div>
            ) : (
              <div className="flex min-w-0 flex-1 flex-col">
                <p className="truncate text-ods-text-primary text-h3">{name}</p>
                {subtitle && <p className="truncate text-ods-text-secondary text-h6">{subtitle}</p>}
              </div>
            )}
            {actions && <div className="flex shrink-0 items-center gap-[var(--spacing-system-xs)]">{actions}</div>}
          </div>
          {onOpenSettings && (
            <Button
              variant="cell"
              type="button"
              onClick={onOpenSettings}
              aria-label="Settings"
              className={EDGE_CELL_CLASS}
            >
              <Settings01Icon />
            </Button>
          )}
        </div>
      </header>
    );
  },
);

ChatTopNavigation.displayName = 'ChatTopNavigation';

export { ChatTopNavigation };
