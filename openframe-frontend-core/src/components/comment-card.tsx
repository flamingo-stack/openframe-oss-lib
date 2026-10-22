'use client';

import { cn } from '../utils/cn';
import { formatRelativeTime } from '../utils/date-utils';
import { useAuth } from './auth-stub';
import { TrashIcon } from './icons-v2-generated';
import { TextLineSkeleton, UnifiedSkeleton } from './loading/unified-skeleton';
import { Button } from './ui/button';
import { loadingItemProps, useLoadingScope } from './ui/loading-scope';
import { UserSummary } from './user-summary-stub';
import {
  VENDOR_DISPLAY_BUTTON_FRAME_CLASS,
  VENDOR_DISPLAY_BUTTON_LOGO_CLASS,
  VendorDisplayButton,
} from './vendor-display-button';

/** The comment shape every comment surface renders (vendor reviews, design-doc and prompt threads). */
export interface CommentCardComment {
  id: string;
  content: string;
  title?: string;
  type?: 'pro' | 'con';
  importance?: 'Critical' | 'Important' | 'Nice-to-have';
  createdAt: string;
  vendor?: {
    id: number;
    title: string;
    slug: string;
    logo: string | null;
    category?: string | null;
  };
  user?: {
    id: string;
    name: string;
    profilePicture: string | null;
    msp?: {
      id: string | number;
      name?: string | null;
      icon_url?: string | null;
    };
  };
  canDelete?: boolean;
}

interface CommentCardBaseProps {
  onViewProduct?: (vendorSlug: string) => void;
  onDeleteComment?: (commentId: string) => void;
  /** @deprecated Superseded by `leadWith`; the component ignores it. */
  showVendorInfo?: boolean;
  compact?: boolean;
  /**
   * Which HEADER this tile leads with — the only thing that ever varied by
   * surface. Two states, because there are two headers: the profile page shows
   * a person's comments, so it leads with the VENDOR each one is about;
   * everywhere else the vendor is the page and the commenter is the news.
   * Every BEHAVIOUR is a prop, so a new surface never needs a new member here.
   */
  leadWith?: 'vendor' | 'commenter';
  /**
   * Read the body in FULL (thread reading) instead of the fixed-height,
   * three-line list tile. Defaults to the list tile.
   */
  fullBody?: boolean;
  /** Rendered under the body — badges + per-surface actions (design-doc threads). */
  footer?: React.ReactNode;
  /** Rendered after the card — nested replies + reply composer (design-doc threads). */
  children?: React.ReactNode;
  /** While `loading` with no comment: the card draws its title row (titled reviews). Default true. */
  titleRow?: boolean;
  /** List markers (`data-loading-item`), on the card's frame in both forms. */
  [marker: `data-${string}`]: unknown;
}

/**
 * A comment (`comment`), or, while it is read, `loading` with no comment: the card draws its skeleton in its own boxes,
 * with the `footer` it is given (the host's static controls). A loading scope draws the skeleton too.
 */
type CommentCardProps = CommentCardBaseProps &
  ({ comment: CommentCardComment; loading?: false } | { comment?: undefined; loading: true });

// The card's boxes, read by the card AND its skeleton, so the two are one size at every width.
const COMMENT_CARD_FRAME =
  'group box-border w-full max-w-full overflow-hidden rounded-lg border border-ods-border bg-ods-card p-4 transition-all hover:border-ods-accent';
const COMMENT_CARD_HEADER =
  'mb-3 flex w-full flex-col gap-3 min-[420px]:flex-row min-[420px]:items-center min-[420px]:justify-between min-[420px]:gap-2';
const COMMENT_CARD_LEAD = 'flex min-w-0 flex-1 items-center gap-2';
const COMMENT_CARD_ACTIONS = 'flex justify-start gap-2 min-[420px]:justify-end';
const COMMENT_CARD_TIME = 'flex-shrink-0 whitespace-nowrap text-ods-text-secondary text-h6';
const COMMENT_CARD_CONTENT = 'w-full max-w-full space-y-2 overflow-hidden';
/** The card's footer row (a thread's reply count, badges and Reply), loaded and loading. */
const COMMENT_CARD_FOOTER = 'flex flex-wrap items-center gap-2 pt-2';
const commentTitleRow = (compact: boolean) => (compact ? 'flex h-[20px] items-center' : 'flex h-[24px] items-center');
const commentBodyRow = (compact: boolean) => (compact ? 'flex h-[60px] items-center' : 'flex h-[72px] items-center');
/** The commenter header's avatar (UserSummary `compact`, `avatarSize`). */
const COMMENT_CARD_AVATAR_PX = 48;
/**
 * How many `text-h4` lines a thread comment read in full (`fullBody`) typically takes while it is read: a short
 * thread comment wraps to about two lines. A typical count, not a measured one: the loaded body takes its own height.
 */
const COMMENT_CARD_FULL_BODY_LINES = 2;

export function CommentCard({
  comment,
  onViewProduct,
  onDeleteComment,
  compact = false,
  leadWith = 'commenter',
  fullBody = false,
  footer,
  children,
  loading,
  titleRow = true,
  ...markers
}: CommentCardProps) {
  const { user: currentUser } = useAuth();
  const inScope = useLoadingScope();

  // Use unified date formatting function
  const formatActivityTime = (timestamp: string) => {
    return formatRelativeTime(timestamp);
  };

  // Check if current user can delete this comment
  /**
   * Deletability is the CALLER's rule, never a per-surface branch in here: an
   * explicit `comment.canDelete` always wins (design docs compute own-or-DRI
   * with their gate module and hand it in), and the default is the only rule
   * this component can honestly know by itself — your own comment.
   */
  const canUserDeleteComment = (shown: CommentCardComment) => {
    if (!currentUser) return false;
    if (typeof shown.canDelete === 'boolean') return shown.canDelete;
    return !!shown.user && currentUser.id === shown.user.id;
  };

  if (inScope || loading) {
    return (
      <>
        <CommentCardSkeleton
          leadWith={leadWith}
          showTitle={comment ? !!comment.title : titleRow}
          // A host that may delete draws the delete button; with no comment yet who may is unknown, so it is held.
          showDelete={!!onDeleteComment && (!comment || canUserDeleteComment(comment))}
          compact={compact}
          fullBody={fullBody}
          footer={loading ? footer : undefined}
          {...loadingItemProps(markers)}
        />
        {children}
      </>
    );
  }

  const showDeleteButton = canUserDeleteComment(comment);

  return (
    <>
      <div
        className={COMMENT_CARD_FRAME}
        style={{ maxWidth: '100%', wordBreak: 'break-word' }}
        {...loadingItemProps(markers)}
      >
        {/* Comment Header */}
        <div className={COMMENT_CARD_HEADER}>
          {/* Row 1: Info + Timestamp */}
          <div className={COMMENT_CARD_LEAD}>
            {leadWith === 'vendor' && comment.vendor ? (
              <>
                {/* Vendor Button - Icon + Name */}
                <VendorDisplayButton vendor={comment.vendor} onClick={onViewProduct || (() => {})} />

                {/* Timestamp */}
                <span className={COMMENT_CARD_TIME}>{formatActivityTime(comment.createdAt)}</span>
              </>
            ) : comment.user ? (
              <UserSummary
                name={comment.user.name}
                email=""
                compact
                avatarSize={COMMENT_CARD_AVATAR_PX}
                subtitle={formatActivityTime(comment.createdAt)}
                avatarUrl={comment.user.profilePicture ?? null}
                mspPreview={
                  comment.user.msp
                    ? {
                        name: comment.user.msp.name ?? null,
                        logoUrl: comment.user.msp.icon_url ?? null,
                        seatCount: null,
                        technicianCount: null,
                        annualRevenue: null,
                      }
                    : null
                }
                showEditButton={false}
                authProviders={[]}
              />
            ) : null}
          </div>

          {/* Row 2: Action Buttons */}
          <div className={COMMENT_CARD_ACTIONS}>
            {/* Delete Button - shown when user can delete the comment */}
            {showDeleteButton && onDeleteComment && <CommentDeleteButton onClick={() => onDeleteComment(comment.id)} />}
          </div>
        </div>

        {/* Comment Content */}
        <div className={COMMENT_CARD_CONTENT} style={{ maxWidth: '100%', wordBreak: 'break-word' }}>
          {comment.title && (
            <div className={commentTitleRow(compact)}>
              <h4
                className="line-clamp-1 tracking-[-0.02em] text-ods-text-primary transition-colors text-h3 group-hover:text-ods-accent"
                style={{
                  wordBreak: 'break-word',
                  overflowWrap: 'break-word',
                  maxWidth: '100%',
                  textOverflow: 'ellipsis',
                  overflow: 'hidden',
                  display: '-webkit-box',
                  WebkitBoxOrient: 'vertical',
                  WebkitLineClamp: 1,
                }}
              >
                {comment.title}
              </h4>
            </div>
          )}
          {fullBody ? (
            // Thread bodies are read in full — no fixed height, no clamp.
            <p
              className="whitespace-pre-wrap text-ods-text-primary text-h4"
              style={{ wordBreak: 'break-word', overflowWrap: 'break-word', maxWidth: '100%' }}
            >
              {comment.content}
            </p>
          ) : (
            <div className={commentBodyRow(compact)}>
              <p
                className="line-clamp-3 text-ods-text-primary text-h4"
                style={{
                  wordBreak: 'break-word',
                  overflowWrap: 'break-word',
                  maxWidth: '100%',
                  textOverflow: 'ellipsis',
                  overflow: 'hidden',
                  display: '-webkit-box',
                  WebkitBoxOrient: 'vertical',
                  WebkitLineClamp: 3,
                }}
              >
                {comment.content}
              </p>
            </div>
          )}
          {footer ? <div className={COMMENT_CARD_FOOTER}>{footer}</div> : null}
        </div>
      </div>
      {children}
    </>
  );
}

/** The comment's delete control: drawn for real in the loaded card, and inert in its loading form. */
function CommentDeleteButton({ onClick }: { onClick?: () => void }) {
  return (
    <Button
      onClick={onClick}
      variant="outline"
      size="icon"
      aria-label="Delete comment"
      className="text-ods-text-primary"
    >
      <TrashIcon size={24} className="text-ods-text-primary" />
    </Button>
  );
}

/**
 * A comment tile while it is read, in the card's own boxes: the header it leads with (the vendor button's outline
 * with its logo box and a name bar, then a time bar; or the commenter's 48px avatar box with name and time bars), the
 * delete button drawn for real (inert), the title as one `text-h3` line, and the body as the tile's three `text-h4`
 * lines (or, read in full, a typical run of `text-h4` lines with no fixed box).
 */
function CommentCardSkeleton({
  leadWith = 'vendor',
  showTitle = true,
  showDelete = false,
  compact = false,
  fullBody = false,
  footer,
  className,
  ...markers
}: {
  leadWith?: 'vendor' | 'commenter';
  showTitle?: boolean;
  /** Draw the delete button, real and inert (the viewer may delete the comment). */
  showDelete?: boolean;
  compact?: boolean;
  /** The body read in full (thread reading): a typical run of lines with no fixed box, as the loaded body has none. */
  fullBody?: boolean;
  /** The card's footer row as the loaded card draws it (its static controls, such as a thread's Reply). */
  footer?: React.ReactNode;
  className?: string;
  /** List markers (`data-loading-item`), as the loaded card carries them. */
  [marker: `data-${string}`]: unknown;
}) {
  return (
    <div className={cn(COMMENT_CARD_FRAME, className)} aria-hidden {...loadingItemProps(markers)}>
      <div className={COMMENT_CARD_HEADER}>
        <div className={COMMENT_CARD_LEAD}>
          {leadWith === 'vendor' ? (
            <>
              <div className={VENDOR_DISPLAY_BUTTON_FRAME_CLASS}>
                <UnifiedSkeleton className={VENDOR_DISPLAY_BUTTON_LOGO_CLASS} />
                <TextLineSkeleton type="h4" className="w-28" />
              </div>
              <TextLineSkeleton type="h6" className="w-16 shrink-0" />
            </>
          ) : (
            <div className="flex min-w-0 items-center gap-3">
              <UnifiedSkeleton
                className="shrink-0 rounded-lg"
                width={COMMENT_CARD_AVATAR_PX}
                height={COMMENT_CARD_AVATAR_PX}
              />
              <div className="min-w-0 flex-1">
                <TextLineSkeleton type="h4" className="w-32" />
                <TextLineSkeleton type="h6" className="w-16" />
              </div>
            </div>
          )}
        </div>
        <div className={COMMENT_CARD_ACTIONS}>
          {showDelete && (
            <span inert aria-hidden className="inline-flex">
              <CommentDeleteButton />
            </span>
          )}
        </div>
      </div>
      <div className={COMMENT_CARD_CONTENT}>
        {showTitle && (
          <div className={commentTitleRow(compact)}>
            <TextLineSkeleton type="h3" className="w-2/3" />
          </div>
        )}
        {fullBody ? (
          <TextLineSkeleton type="h4" lines={COMMENT_CARD_FULL_BODY_LINES} className="w-full" />
        ) : (
          <div className={commentBodyRow(compact)}>
            <TextLineSkeleton type="h4" lines={3} className="w-full" />
          </div>
        )}
        {footer ? <div className={COMMENT_CARD_FOOTER}>{footer}</div> : null}
      </div>
    </div>
  );
}
