'use client';

import { ChevronDown } from 'lucide-react';
import { type ReactNode, useState } from 'react';
import { CommentCard, type CommentCardComment } from './comment-card';
import { CommentComposer } from './comment-composer';
import { Button } from './ui/button';

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
  if (comments.length === 0) {
    return emptyLabel ? <p className="text-ods-text-secondary text-h6">{emptyLabel}</p> : null;
  }
  return (
    <div className="flex flex-col gap-[var(--spacing-system-sf)]">
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
        <span className="ml-auto flex flex-wrap gap-[var(--spacing-system-xsf)]">
          {onReply ? (
            <Button
              type="button"
              variant="outline"
              size="small-legacy"
              onClick={() => setReplyOpen(open => !open)}
              disabled={pending}
            >
              Reply
            </Button>
          ) : null}
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
  const [open, setOpen] = useState(defaultOpen);
  // New activity AFTER mount (a colleague's comment arrives) flips `defaultOpen`
  // to true and must expand the block; collapsing again stays the reader's call.
  // Adjusted during render, React's pattern for state that follows a prop.
  const [seenDefaultOpen, setSeenDefaultOpen] = useState(defaultOpen);
  if (defaultOpen !== seenDefaultOpen) {
    setSeenDefaultOpen(defaultOpen);
    if (defaultOpen) setOpen(true);
  }
  return (
    <div className="space-y-[var(--spacing-system-sf)]">
      <Button
        type="button"
        variant="transparent"
        size="small-legacy"
        className="px-0 text-ods-text-secondary hover:text-ods-text-primary"
        onClick={() => setOpen(value => !value)}
        rightIcon={<ChevronDown className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`} />}
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
