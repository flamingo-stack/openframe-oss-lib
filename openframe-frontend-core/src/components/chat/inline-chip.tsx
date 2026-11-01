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
  /** Wraps the icon and the name in the chip's link. */
  link?: (content: React.ReactNode) => React.ReactNode;
  /** An action inside the same box, after the name (a record's "⋯" menu, a new-tab link). */
  trailing?: React.ReactNode;
}): React.ReactElement {
  if (loading) {
    return <Tag as="span" variant="badge" icon={icon} label="" loading className="align-middle" />;
  }
  const content = (
    <>
      {icon ? <span className={INLINE_CHIP_ICON_CLASS}>{icon}</span> : null}
      {label}
    </>
  );
  return (
    <span data-testid="inline-chip" className={cn(INLINE_CHIP_CLASS, className)}>
      {link ? link(content) : content}
      {trailing ? <span className={INLINE_CHIP_TRAILING_CLASS}>{trailing}</span> : null}
    </span>
  );
}
