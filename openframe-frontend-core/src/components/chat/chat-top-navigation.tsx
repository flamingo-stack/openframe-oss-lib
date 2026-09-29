'use client';

import { forwardRef, type HTMLAttributes, type ReactNode } from 'react';
import { cn } from '../../utils/cn';
import { Settings01Icon, SidebarIcon } from '../icons-v2-generated';
import { Skeleton } from '../ui/skeleton';
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
   *  would flash before the tenant's branding lands. */
  isLoading?: boolean;
}

const edgeButtonClass = cn(
  'flex size-14 shrink-0 items-center justify-center border-ods-border text-ods-text-secondary',
  'hover:text-ods-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ods-focus',
  '[&_svg]:size-6',
);

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
      isLoading,
      ...props
    },
    ref,
  ) => (
    <header ref={ref} className={cn('flex shrink-0 flex-col bg-ods-bg', className)} {...props}>
      {before}
      <div className="flex h-14 items-stretch border-b border-ods-border">
        {onToggleSidebar && (
          <button
            type="button"
            onClick={onToggleSidebar}
            aria-label={sidebarOpen ? 'Hide sidebar' : 'Show sidebar'}
            aria-expanded={sidebarOpen}
            className={cn(edgeButtonClass, 'border-r')}
          >
            <SidebarIcon />
          </button>
        )}
        <div className="flex min-w-0 flex-1 items-center gap-[var(--spacing-system-m)] px-[var(--spacing-system-m)]">
          {isLoading ? (
            <>
              <Skeleton className="size-10 shrink-0 rounded-full" />
              <div className="flex min-w-0 flex-1 flex-col gap-[var(--spacing-system-xxs)]">
                <Skeleton className="h-5 w-24" />
                <Skeleton className="h-4 w-32" />
              </div>
            </>
          ) : (
            <>
              <SquareAvatar src={avatarUrl ?? undefined} alt={name} fallback={name} size="md" variant="round" />
              <div className="flex min-w-0 flex-1 flex-col">
                <p className="truncate text-ods-text-primary text-h3">{name}</p>
                {subtitle && <p className="truncate text-ods-text-secondary text-h6">{subtitle}</p>}
              </div>
            </>
          )}
          {actions && <div className="flex shrink-0 items-center gap-[var(--spacing-system-xs)]">{actions}</div>}
        </div>
        {onOpenSettings && (
          <button
            type="button"
            onClick={onOpenSettings}
            aria-label="Settings"
            className={cn(edgeButtonClass, 'border-l')}
          >
            <Settings01Icon />
          </button>
        )}
      </div>
    </header>
  ),
);

ChatTopNavigation.displayName = 'ChatTopNavigation';

export { ChatTopNavigation };
