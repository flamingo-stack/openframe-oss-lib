'use client';

import { ChevronDown } from 'lucide-react';
import { type ReactNode, useState } from 'react';
import { CommentCard, CommentCardSkeleton, type CommentCardComment } from './comment-card';
import { CommentComposer } from './comment-composer';
import { TextLineSkeleton } from './loading/unified-skeleton';
import { Button } from './ui/button';
import { useLoadingScope } from './ui/loading-scope';

/**
 * The comment cards a thread's skeleton draws: its first fold (about three root cards fill a section's screen). Never
 * the number of comments held: in a loading scope those are not read.
 */
export const COMMENT_THREAD_SKELETON_COUNT = 3;
// The thread's and the block's boxes, read by them AND their skeletons.
const COMMENT_THREAD_LIST = 'flex flex-col gap-[var(--spacing-system-sf)]';
/** A root's actions at the end of its footer (Reply, then the surface's own), loaded and loading. */
const COMMENT_THREAD_ACTIONS = 'ml-auto flex flex-wrap gap-[var(--spacing-system-xsf)]';
const COMMENTS_BLOCK = 'space-y-[var(--spacing-system-sf)]';
const COMMENTS_BLOCK_HEADER = 'px-0 text-ods-text-secondary hover:text-ods-text-primary';
const commentsBlockChevron = (open: boolean) => `h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`;

/** A root comment with its replies. Replies never nest further (single-level threads). */
export interface ThreadComment extends CommentCardComment {
  replies?: CommentCardComment[];
}

export interface CommentThreadProps {
  comments: ThreadComment[];
  /** Shown when there is nothing to list. Omit to render nothing. */
  emptyLabel?: ReactNode;
  /**
   * Post a reply to a ROOT comment. Resolve `false` to keep the typed reply (a
   * failed post must never wipe the box). Omit and the thread is read-only.
   */
  onReply?: (parentId: string, body: string) => Promise<boolean | void> | boolean | void;
  /** Delete a root or a reply. Each card's `canDelete` still decides whether the button shows. */
  onDelete?: (commentId: string) => Promise<unknown> | void;
  /** Surface badges on a root (a design doc's type + status). */
  renderBadges?: (comment: ThreadComment) => ReactNode;
  /** Surface actions on a root, after Reply (a design doc's Resolve / Decline / Reopen). */
  renderActions?: (comment: ThreadComment) => ReactNode;
  replyPlaceholder?: string;
  pending?: boolean;
  /** Which header each ROOT card leads with; replies always lead with the commenter. */
  leadWith?: 'vendor' | 'commenter';
  onViewProduct?: (vendorSlug: string) => void;
}

/**
 * THE threaded comment list: root cards read in full, their replies indented
 * beneath, and an inline reply composer per root.
 *
 * One component for every comment surface (design-doc sections and decision
 * log, prompt library threads, vendor reviews), so reply behaviour, spacing and
 * the keep-the-draft-on-failure rule cannot drift between them. Everything a
 * surface owns (who may delete, which badges and settle actions a root carries)
 * arrives through props; nothing in here knows about vocabularies or vendors.
 */
export function CommentThread({
  comments,
  emptyLabel,
  onReply,
  onDelete,
  renderBadges,
  renderActions,
  replyPlaceholder = 'Write a reply',
  pending = false,
  leadWith,
  onViewProduct,
}: CommentThreadProps) {
  if (useLoadingScope()) {
    return <CommentThreadSkeleton count={COMMENT_THREAD_SKELETON_COUNT} leadWith={leadWith} reply={Boolean(onReply)} />;
  }
  if (comments.length === 0) {
    return emptyLabel ? <p className="text-ods-text-secondary text-h6">{emptyLabel}</p> : null;
  }
  return (
    <div className={COMMENT_THREAD_LIST}>
      {comments.map(comment => (
        <CommentThreadRow
          key={comment.id}
          comment={comment}
          onReply={onReply}
          onDelete={onDelete}
          renderBadges={renderBadges}
          renderActions={renderActions}
          replyPlaceholder={replyPlaceholder}
          pending={pending}
          leadWith={leadWith}
          onViewProduct={onViewProduct}
        />
      ))}
    </div>
  );
}

/** A root's Reply button: static copy, drawn for real in the loaded thread and (inert) in its skeleton. */
function ReplyButton({ onClick, disabled }: { onClick?: () => void; disabled?: boolean }) {
  return (
    <Button type="button" variant="outline" size="small-legacy" onClick={onClick} disabled={disabled}>
      Reply
    </Button>
  );
}

function CommentThreadRow({
  comment,
  onReply,
  onDelete,
  renderBadges,
  renderActions,
  replyPlaceholder,
  pending,
  leadWith,
  onViewProduct,
}: Omit<CommentThreadProps, 'comments' | 'emptyLabel'> & { comment: ThreadComment }) {
  const [replyOpen, setReplyOpen] = useState(false);
  const replies = comment.replies ?? [];
  const actions = renderActions?.(comment);
  const footer: ReactNode = (
    <>
      {renderBadges?.(comment)}
      {replies.length > 0 ? (
        <span className="text-ods-text-secondary text-h6">
          {replies.length} {replies.length === 1 ? 'reply' : 'replies'}
        </span>
      ) : null}
      {onReply || actions ? (
        <span className={COMMENT_THREAD_ACTIONS}>
          {onReply ? <ReplyButton onClick={() => setReplyOpen(open => !open)} disabled={pending} /> : null}
          {actions}
        </span>
      ) : null}
    </>
  );

  return (
    <CommentCard
      fullBody
      comment={comment}
      leadWith={leadWith}
      onViewProduct={onViewProduct}
      onDeleteComment={onDelete ? id => void onDelete(id) : undefined}
      footer={footer}
    >
      {replies.length > 0 || replyOpen ? (
        <div className="ml-[var(--spacing-system-lf)] mt-[var(--spacing-system-xsf)] flex flex-col gap-[var(--spacing-system-xsf)] border-l border-ods-border pl-[var(--spacing-system-sf)]">
          {replies.map(reply => (
            <CommentCard
              key={reply.id}
              fullBody
              compact
              comment={reply}
              onDeleteComment={onDelete ? id => void onDelete(id) : undefined}
            />
          ))}
          {replyOpen && onReply ? (
            <CommentComposer
              pending={pending}
              onCancel={() => setReplyOpen(false)}
              submitLabel="Reply"
              ariaLabel="Reply"
              placeholder={replyPlaceholder}
              onSubmit={async ({ body }) => {
                const ok = await onReply(comment.id, body);
                if (ok === false) return false;
                setReplyOpen(false);
                return true;
              }}
            />
          ) : null}
        </div>
      ) : null}
    </CommentCard>
  );
}

/**
 * A thread while it is read: `count` comment rows, each `CommentCardSkeleton` in the thread's own list, with the
 * root's Reply button drawn for real when the thread takes replies (a root's reply count, badges and actions are read,
 * so they are not drawn).
 */
export function CommentThreadSkeleton({
  count = COMMENT_THREAD_SKELETON_COUNT,
  leadWith = 'commenter',
  showTitle = true,
  reply = false,
}: {
  count?: number;
  leadWith?: 'vendor' | 'commenter';
  /** The rows carry a title line (titled reviews); a design-doc thread's comments have none. */
  showTitle?: boolean;
  /** The thread takes replies (`CommentThread`'s `onReply`): each root's footer carries its Reply button. */
  reply?: boolean;
}) {
  const footer = reply ? (
    <span className={COMMENT_THREAD_ACTIONS}>
      <ReplyButton />
    </span>
  ) : undefined;
  return (
    <div className={COMMENT_THREAD_LIST} aria-hidden="true" inert>
      {Array.from({ length: count }, (_, i) => (
        <CommentCardSkeleton key={i} leadWith={leadWith} showTitle={showTitle} showDelete={false} footer={footer} />
      ))}
    </div>
  );
}

export interface CommentsBlockProps {
  /** Header label, e.g. "Comments". */
  title: string;
  /** Readable while collapsed: "2 open · 1 closed", "3 comments". */
  summary: string;
  /** Start expanded. A later flip to `true` (new activity) expands it again. */
  defaultOpen?: boolean;
  /** The list (usually a `CommentThread`) plus anything under it. */
  children: ReactNode;
  /** The root composer, rendered last while expanded. */
  composer?: ReactNode;
}

/**
 * THE collapsible comments section: a chevron header carrying the thread's
 * summary, then the thread and the root composer. Collapsing is for threads
 * with nothing left to act on; a host passes `defaultOpen` whenever there is
 * (content behind an accordion is content readers miss).
 */
export function CommentsBlock({ title, summary, defaultOpen = false, children, composer }: CommentsBlockProps) {
  const loading = useLoadingScope();
  const [open, setOpen] = useState(defaultOpen);
  // New activity AFTER mount (a colleague's comment arrives) flips `defaultOpen`
  // to true and must expand the block; collapsing again stays the reader's call.
  // Adjusted during render, React's pattern for state that follows a prop.
  const [seenDefaultOpen, setSeenDefaultOpen] = useState(defaultOpen);
  if (defaultOpen !== seenDefaultOpen) {
    setSeenDefaultOpen(defaultOpen);
    if (defaultOpen) setOpen(true);
  }
  // In a scope the header keeps its real title and its summary is a bar; the thread under it draws its own skeleton.
  if (loading) {
    return (
      <div className={COMMENTS_BLOCK}>
        <CommentsBlockHeader title={title} open={open} />
        {open ? (
          <>
            {children}
            {composer}
          </>
        ) : null}
      </div>
    );
  }
  return (
    <div className={COMMENTS_BLOCK}>
      <Button
        type="button"
        variant="transparent"
        size="small-legacy"
        className={COMMENTS_BLOCK_HEADER}
        onClick={() => setOpen(value => !value)}
        rightIcon={<ChevronDown className={commentsBlockChevron(open)} />}
      >
        {`${title} · ${summary}`}
      </Button>
      {open ? (
        <>
          {children}
          {composer}
        </>
      ) : null}
    </div>
  );
}

/** The block's header while its summary is read: the real title, a bar for the summary. */
function CommentsBlockHeader({ title, open }: { title: string; open: boolean }) {
  return (
    <Button
      type="button"
      variant="transparent"
      size="small-legacy"
      className={COMMENTS_BLOCK_HEADER}
      rightIcon={<ChevronDown className={commentsBlockChevron(open)} />}
      tabIndex={-1}
      aria-hidden
    >
      {`${title} · `}
      <TextLineSkeleton as="span" type="h6" className="inline-block w-20 align-middle" />
    </Button>
  );
}

/** Comment rows the loading block draws by default: none, the block is collapsed until it is read. */
const COMMENTS_BLOCK_SKELETON_COMMENTS = 0;

/**
 * The comments section while it is read: its real title, the summary as a bar, `count` comment rows (none: the
 * block is collapsed) and, with `composer`, the root composer's real static controls (inert).
 */
export function CommentsBlockSkeleton({
  title,
  count = COMMENTS_BLOCK_SKELETON_COMMENTS,
  composer = false,
  leadWith,
  showTitle,
}: {
  title: string;
  count?: number;
  composer?: boolean;
  leadWith?: 'vendor' | 'commenter';
  showTitle?: boolean;
}) {
  const open = count > 0 || composer;
  return (
    <div className={COMMENTS_BLOCK} aria-hidden>
      <CommentsBlockHeader title={title} open={open} />
      {count > 0 && <CommentThreadSkeleton count={count} leadWith={leadWith} showTitle={showTitle} />}
      {composer && (
        <div inert>
          <CommentComposer onSubmit={() => false} />
        </div>
      )}
    </div>
  );
}
