import { type FC, type HTMLAttributes, forwardRef } from 'react';
import { cn } from '../../utils/cn';
import { Chevron02LeftIcon } from '../icons-v2-generated';
import { XmarkIcon } from '../icons-v2-generated/signs-and-symbols/xmark-icon';
import { PlusCircleIcon } from '../plus-circle-icon';
import { Button } from '../ui/button';
import { Skeleton } from '../ui/skeleton';
import { SquareAvatar as Avatar } from '../ui/square-avatar';
import { TicketStatusTag, resolveStatusTagProps } from '../ui/ticket-status-tag';
import { MspOrganizationCard } from './msp-organization-card';
import { MspOrganizationCardSkeleton } from './msp-organization-card-skeleton';
import type { ConnectionIndicatorProps, ChatContainerProps, ChatHeaderProps } from './types';

const ConnectionIndicator: FC<ConnectionIndicatorProps> = ({ status }) => {
  const getStatusStyles = () => {
    switch (status) {
      // ODS semantic status tokens — preset-defined utilities aliasing the same
      // green/yellow/red as the raw ods-attention palette (which is CSS-vars only).
      case 'connected':
        return 'bg-ods-success';
      case 'connecting':
        return 'bg-ods-warning animate-pulse';
      case 'disconnected':
        return 'bg-ods-error';
      default:
        return 'bg-ods-text-tertiary';
    }
  };

  return (
    <div className="flex items-center">
      <output
        className={cn('block h-2 w-2 rounded-full', getStatusStyles())}
        aria-label={`Connection status: ${status}`}
        title={status === 'connected' ? 'Connected' : status === 'connecting' ? 'Connecting...' : 'Disconnected'}
      />
    </div>
  );
};

const ChatContainer = forwardRef<HTMLDivElement, ChatContainerProps>(({ className, children, ...props }, ref) => {
  return (
    <div
      ref={ref}
      className={cn(
        'flex h-screen w-full flex-col',
        'bg-ods-bg text-ods-text-primary',
        'px-4 pb-8 pt-10 md:px-6 lg:px-8',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
});

ChatContainer.displayName = 'ChatContainer';

const ChatHeader = forwardRef<HTMLDivElement, ChatHeaderProps>(
  (
    {
      className,
      userName = 'Grace "Fae" Meadows',
      userAvatar,
      userIcon,
      onSettingsClick,
      onNewChat,
      onClose,
      onBack,
      showNewChat = false,
      connectionStatus = 'disconnected',
      serverUrl = null,
      headerActions,
      ticketInfo,
      mspOrganization,
      isMspLoading = false,
      fullWidth = false,
      bare = false,
      isLoading = false,
      ...props
    },
    ref,
  ) => {
    const cardClasses = bare ? '' : 'rounded-md bg-ods-card border border-ods-border';
    return (
      <div
        ref={ref}
        className={cn(
          // `fullWidth` drops the centered-narrow content column for
          // chats hosted in side panels where 600px would float in
          // the middle of a wider container.
          fullWidth ? 'relative w-full' : 'relative mx-auto w-full max-w-ods-content-narrow',
          className,
        )}
        {...props}
      >
        {onBack && (
          <Button
            onClick={onBack}
            variant="transparent"
            size="icon"
            aria-label="Back"
            leftIcon={<Chevron02LeftIcon size={24} className="text-ods-text-primary" />}
            className={cn(cardClasses, 'absolute right-full top-0 mr-[var(--spacing-system-s)] hover:bg-ods-bg-hover')}
          />
        )}
        <div className={cardClasses}>
          <div className="flex items-center justify-between gap-4 px-4 py-3">
            {isLoading ? (
              <div className="flex items-center gap-3">
                {/* 64px round avatar placeholder — matches the `w-16 h-16`
                    rounded-full avatar / userIcon block below. */}
                <Skeleton className="h-16 w-16 shrink-0 rounded-full" />
                <div className="flex flex-col gap-1">
                  {/* Name line — sized to the `text-h3` name. */}
                  <Skeleton className="h-6 w-40" />
                  {/* Server line — sized to the `text-h4` secondary row. */}
                  <Skeleton className="h-4 w-28" />
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                {userIcon ? (
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-ods-accent">
                    {userIcon}
                  </div>
                ) : (
                  <Avatar
                    src={userAvatar}
                    alt={userName}
                    fallback={userName}
                    size="xl"
                    variant="round"
                    className="bg-ods-flamingo-pink"
                  />
                )}
                <div className="flex flex-col">
                  <span className="text-h3">{userName}</span>
                  <div className="flex items-center gap-2">
                    {serverUrl && (
                      <>
                        <span className="text-ods-text-secondary text-h4">{serverUrl}</span>
                        <ConnectionIndicator status={connectionStatus} />
                      </>
                    )}
                  </div>
                </div>
              </div>
            )}
            <div className="flex items-center gap-1">
              {showNewChat && onNewChat && (
                <Button
                  onClick={onNewChat}
                  variant="transparent"
                  size="small-legacy"
                  leftIcon={<PlusCircleIcon className="h-5 w-5" whiteOverlay />}
                  className="text-ods-text-primary hover:bg-ods-bg-hover"
                >
                  New Chat
                </Button>
              )}
              {onClose && (
                <Button
                  onClick={onClose}
                  variant="transparent"
                  size="small-legacy"
                  aria-label="Close"
                  className="!p-1.5 text-ods-text-muted hover:bg-ods-bg-hover hover:text-ods-text-primary"
                >
                  <XmarkIcon size={16} />
                </Button>
              )}
              {headerActions}
            </div>
          </div>
          {/* MSP branding slot — home-screen only; `ticketInfo` (open chat)
              claims this space, so it wins when both are provided. The card
              already draws the chrome: strip the section's own ring and keep
              only the bottom rounding so its bg fits the card corners. */}
          {!ticketInfo && (isMspLoading || mspOrganization) && (
            <>
              <div className="h-px bg-ods-border" />
              {isMspLoading || !mspOrganization ? (
                <MspOrganizationCardSkeleton className={cn('rounded-none ring-0', !bare && 'rounded-b-md')} />
              ) : (
                <MspOrganizationCard
                  {...mspOrganization}
                  className={cn('rounded-none ring-0', !bare && 'rounded-b-md', mspOrganization.className)}
                />
              )}
            </>
          )}
          {ticketInfo && (
            <>
              <div className="h-px bg-ods-border" />
              <div className="flex items-center justify-between gap-4 px-4 py-2">
                <div className="flex min-w-0 flex-col">
                  <span
                    className="truncate text-heading-3"
                    title={typeof ticketInfo.title === 'string' ? ticketInfo.title : undefined}
                  >
                    {ticketInfo.title}
                  </span>
                  {ticketInfo.meta && (
                    <div
                      className="truncate text-ods-text-secondary text-h6"
                      title={typeof ticketInfo.meta === 'string' ? ticketInfo.meta : undefined}
                    >
                      {ticketInfo.meta}
                    </div>
                  )}
                </div>
                {(ticketInfo.status || ticketInfo.statusName) && (
                  <TicketStatusTag
                    {...resolveStatusTagProps({
                      status: ticketInfo.status,
                      statusKind: ticketInfo.statusKind,
                      statusName: ticketInfo.statusName,
                      statusColor: ticketInfo.statusColor,
                    })}
                  />
                )}
              </div>
            </>
          )}
        </div>
      </div>
    );
  },
);
ChatHeader.displayName = 'ChatHeader';

const ChatContent = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, children, ...props }, ref) => {
    return (
      <div ref={ref} className={cn('flex min-h-0 flex-1 flex-col', className)} {...props}>
        {children}
      </div>
    );
  },
);
ChatContent.displayName = 'ChatContent';

/**
 * `ChatFooter` props.
 *
 * Layout API:
 *   - `fullWidth` (preferred) — drop the inner-wrapper
 *     `max-w-ods-content-narrow` so the footer fills the parent.
 *   - `contentClassName` (legacy escape hatch) — explicit class names
 *     applied to the inner wrapper. Use only when `fullWidth` is too
 *     coarse (e.g. custom max-w value).
 */
export interface ChatFooterProps extends HTMLAttributes<HTMLDivElement> {
  /** Same `fullWidth` semantics as `ChatHeaderProps.fullWidth` — drops
   *  the inner wrapper's `max-w-ods-content-narrow` so the footer
   *  spans the full parent width. */
  fullWidth?: boolean;
  /** @deprecated Prefer `fullWidth` for the full-panel-width use case.
   *  This prop remains supported for callers that need a NON-binary
   *  override (custom max-w value, custom padding, etc.). */
  contentClassName?: string;
}

const ChatFooter = forwardRef<HTMLDivElement, ChatFooterProps>(
  ({ className, contentClassName, fullWidth = false, children, ...props }, ref) => {
    return (
      <div ref={ref} className={cn('w-full flex-shrink-0 px-0 pb-0 pt-2 md:px-0', className)} {...props}>
        <div
          className={cn(
            // `fullWidth=true` opts out of the centered-narrow column;
            // `fullWidth=false` (default) preserves the legacy 600px
            // max-width. `contentClassName` is appended last so a
            // legacy caller passing it can still tweak after the
            // fullWidth decision.
            fullWidth ? 'w-full' : 'mx-auto w-full max-w-ods-content-narrow',
            contentClassName,
          )}
        >
          {children}
        </div>
      </div>
    );
  },
);
ChatFooter.displayName = 'ChatFooter';

export { ChatContainer, ChatHeader, ChatContent, ChatFooter };
