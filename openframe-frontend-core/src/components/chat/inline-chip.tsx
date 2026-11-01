'use client';

/**
 * An inline box in the answer's text: the skin every chip a reader can click inside a chat sentence wears. The
 * chips of record links (`[MacBook](record://device/<id>)`, the lib's `RecordChip` or the host's `renderRecordChip`)
 * and the links the answer makes to a screen of the app (`[Devices → Add Device](/devices/new)`) both use it, so a
 * link to a place in the app reads as one at a glance (CU-17tkuw61kfy: drawn as a plain link, it was the colour of
 * the text around it).
 *
 * A chip in a sentence is PART OF THE TEXT, so it shows its whole name and wraps with the line the way a link does:
 * no width cap, no ellipsis, nothing hidden behind a tooltip. That is how inline mentions read in editors (a page or
 * person mention), and what WCAG 1.4.10 (reflow) asks of text at a narrow width. Standalone chips (a filter, a tag)
 * truncate to one line; this one is not standalone. The box is an inline element whose border, fill and corners
 * repeat on every line it spans (`box-decoration-break: clone`), and an unbroken name (an id, a host name) breaks
 * anywhere rather than run out of its column.
 *
 * `link` wraps the icon and the name in the chip's link (the host's anchor, or the record's). `trailing` is an
 * action inside the SAME box, after the name past a hairline (the record's "⋯" menu, a new-tab link), so a chip is
 * one box however many actions it has. `loading` draws the lib `Tag`'s own skeleton.
 */

import type React from 'react';
import { cn } from '../../utils/cn';
import { Tag } from '../ui/tag';

/** The `Tag` badge's surface (border, card fill, mono uppercase) as an inline box that wraps with its line. */
const INLINE_CHIP_CLASS = cn(
  'inline rounded-md border border-ods-border bg-ods-card font-mono uppercase tracking-wide text-ods-text-primary text-h5',
  'px-[var(--spacing-system-xsf)] py-[var(--spacing-system-xxs)] transition-colors duration-150',
  'whitespace-normal [-webkit-box-decoration-break:clone] [box-decoration-break:clone] [overflow-wrap:anywhere]',
);

/** A 16px muted lead icon, set on the text's line (an inline box has no flex to centre it). */
const INLINE_CHIP_ICON_CLASS =
  'mr-[var(--spacing-system-xxs)] inline-block size-4 align-[-0.2em] text-ods-text-secondary [&_svg]:size-4';

/** What follows the name inside the box: a hairline, then the action. */
const INLINE_CHIP_TRAILING_CLASS =
  'ml-[var(--spacing-system-xsf)] border-l border-ods-border pl-[var(--spacing-system-xxs)] text-ods-text-secondary';

/** How the chip asks for its link (`link`): `label` is the anchor's accessible name when the visible name is split
 *  across two anchors; `hidden` marks the second anchor, which is a click target only (no tab stop, no name). */
export interface InlineChipAnchor {
  label?: string;
  hidden?: boolean;
}

export function InlineChip({
  icon,
  label,
  className,
  loading,
  link,
  trailing,
}: {
  icon?: React.ReactNode;
  label: React.ReactNode;
  className?: string;
  loading?: boolean;
  /** Wraps part of the chip in the chip's link (`anchor` says which part, see `InlineChipAnchor`). */
  link?: (content: React.ReactNode, anchor: InlineChipAnchor) => React.ReactNode;
  /** An action inside the same box, after the name (a record's "⋯" menu, a new-tab link). */
  trailing?: React.ReactNode;
}): React.ReactElement {
  if (loading) {
    return <Tag as="span" variant="badge" icon={icon} label="" loading className="align-middle" />;
  }
  const iconNode = icon ? <span className={INLINE_CHIP_ICON_CLASS}>{icon}</span> : null;
  // A line must not break between the name and its action, or the "⋯" is left alone at the start of the next line.
  // Browsers allow a break before an inline button whatever `white-space` says, so the name's LAST WORD and the action
  // share one `nowrap` box; the rest of the name wraps freely. The last word keeps the link as a second anchor that is
  // a click target only, and the first anchor carries the whole name as its accessible name.
  const split = trailing && typeof label === 'string' ? splitLastWord(label) : null;
  if (split) {
    const wrap = (content: React.ReactNode, anchor: InlineChipAnchor) => (link ? link(content, anchor) : content);
    return (
      <span data-testid="inline-chip" className={cn(INLINE_CHIP_CLASS, className)}>
        {split.head
          ? wrap(
              <>
                {iconNode}
                {split.head}
              </>,
              { label: label as string },
            )
          : null}
        <span className="whitespace-nowrap">
          {split.head
            ? wrap(split.last, { hidden: true })
            : wrap(
                <>
                  {iconNode}
                  {split.last}
                </>,
                {},
              )}
          <span className={INLINE_CHIP_TRAILING_CLASS}>{trailing}</span>
        </span>
      </span>
    );
  }
  const content = (
    <>
      {iconNode}
      {label}
    </>
  );
  return (
    <span data-testid="inline-chip" className={cn(INLINE_CHIP_CLASS, className)}>
      {link ? link(content, {}) : content}
      {trailing ? (
        <span className="whitespace-nowrap">
          <span className={INLINE_CHIP_TRAILING_CLASS}>{trailing}</span>
        </span>
      ) : null}
    </span>
  );
}

/** A name split before its last word (`head` keeps the space); a one-word name is all `last`. */
function splitLastWord(name: string): { head: string; last: string } {
  const trimmed = name.trimEnd();
  const at = trimmed.search(/\S+$/);
  return { head: trimmed.slice(0, at), last: trimmed.slice(at) };
}
