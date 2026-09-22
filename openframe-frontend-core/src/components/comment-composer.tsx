'use client';

import { useState, type ReactNode, type RefObject } from 'react';
import { Button, Input, Label, Textarea } from './ui';

export interface CommentComposerDraft {
  title: string;
  body: string;
}

export interface CommentComposerProps {
  /**
   * Show the title field. The vendor section's comments are titled reviews;
   * a design-doc comment is a Slack message, so it passes `false`.
   */
  withTitle?: boolean;
  titleLabel?: string;
  titlePlaceholder?: string;
  /** For hosts whose empty state focuses the composer ("Be the first!"). */
  titleRef?: RefObject<HTMLInputElement | null>;
  bodyLabel?: string;
  placeholder?: string;
  /** Extra controls under the box — design docs put the comment-type chips here. */
  extras?: ReactNode;
  submitLabel?: string;
  cancelLabel?: string;
  onCancel?: () => void;
  pending?: boolean;
  /** Accessible name for the body control when there is no visible label. */
  ariaLabel?: string;
  /**
   * Return `false` to KEEP the draft — a failed post must never lose what the
   * person typed. Anything else clears it.
   */
  onSubmit: (draft: CommentComposerDraft) => void | boolean | Promise<void | boolean>;
}

/**
 * THE comment composer: one bordered box with the field(s) inside and Send
 * beside it (stacked on mobile).
 *
 * One component for every comment surface — the vendor page and the design-doc
 * threads — so the two cannot drift in shape, spacing or submit behaviour. It
 * owns its own draft state, which is what lets both hosts stop hand-rolling
 * one (the vendor page kept title and body in a single newline-joined string).
 */
export function CommentComposer({
  withTitle = false,
  titleLabel = 'Title',
  titlePlaceholder = 'Your comment title here',
  titleRef,
  bodyLabel = 'Description',
  placeholder = 'Write your comment...',
  extras,
  submitLabel = 'Send',
  cancelLabel = 'Cancel',
  onCancel,
  pending = false,
  ariaLabel,
  onSubmit,
}: CommentComposerProps) {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  // A titled composer needs both halves — the host's API rejects a title-only
  // or body-only comment, and disabling Send says so before the round trip.
  const canSubmit = body.trim().length > 0 && (!withTitle || title.trim().length > 0) && !pending;

  const submit = async () => {
    if (!canSubmit) return;
    const kept = await onSubmit({ title: title.trim(), body: body.trim() });
    if (kept === false) return;
    setTitle('');
    setBody('');
  };

  return (
    <div className="flex flex-col gap-[var(--spacing-system-xsf)]">
      <div className="flex flex-col gap-[var(--spacing-system-sf)] md:flex-row">
        <div className="flex-1 overflow-hidden rounded-lg border border-ods-border bg-ods-bg">
          {withTitle ? (
            <div className="border-b border-ods-border">
              <Label className="px-3 pb-1 pt-2 text-ods-text-secondary text-badge">{titleLabel}</Label>
              <Input
                ref={titleRef}
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder={titlePlaceholder}
                disabled={pending}
                className="rounded-none border-0 bg-transparent focus-visible:ring-0"
              />
            </div>
          ) : null}
          {withTitle ? <Label className="px-3 pb-1 pt-2 text-ods-text-secondary text-badge">{bodyLabel}</Label> : null}
          <Textarea
            value={body}
            onChange={e => setBody(e.target.value)}
            placeholder={placeholder}
            disabled={pending}
            aria-label={ariaLabel ?? (withTitle ? bodyLabel : submitLabel)}
            className="min-h-[64px] rounded-none border-0 bg-transparent focus-visible:ring-0"
          />
        </div>
        <div className="flex items-start gap-[var(--spacing-system-xsf)]">
          {onCancel ? (
            <Button type="button" variant="outline" size="small-legacy" onClick={onCancel} disabled={pending}>
              {cancelLabel}
            </Button>
          ) : null}
          <Button
            type="button"
            variant="accent"
            size="small-legacy"
            onClick={submit}
            disabled={!canSubmit}
            loading={pending}
          >
            {submitLabel}
          </Button>
        </div>
      </div>
      {extras ? <div className="flex flex-wrap items-center gap-[var(--spacing-system-xsf)]">{extras}</div> : null}
    </div>
  );
}
