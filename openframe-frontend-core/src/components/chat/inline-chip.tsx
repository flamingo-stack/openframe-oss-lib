'use client';

/**
 * An inline box in the answer's text: the skin every chip a reader can click inside a chat sentence wears. The
 * chips of record links (`[MacBook](record://device/<id>)`, the lib's `RecordChip` or the host's `renderRecordChip`)
 * and the links the answer makes to a screen of the app (`[Devices → Add Device](/devices/new)`) both use it, so a
 * link to a place in the app reads as one at a glance (CU-17tkuw635xx: drawn as a plain link, it was the colour of
 * the text around it).
 *
 * A chip in a sentence is PART OF THE TEXT, so it shows its whole name and wraps with the line the way a link does:
 * no width cap, no ellipsis, nothing hidden behind a tooltip. That is how inline mentions read in editors (a page or
 * person mention), and what WCAG 1.4.10 (reflow) asks of text at a narrow width. Standalone chips (a filter, a tag)
 * truncate to one line; this one is not standalone. The box is an inline element whose border, fill and corners
 * repeat on every line it spans (`box-decoration-break: clone`), and an unbroken name (an id, a host name, a name in
 * Chinese) breaks anywhere rather than run out of its column, with an action or without one.
 *
 * The icon never ends a line on its own. It stands in the start padding of the box that holds the name, out of flow:
 * beside the text as an inline block it was a place a line could break, and a line did ("per the" and the icon alone,
 * with the name on the next line). An inline box's padding goes where its first letter goes and a word does not break,
 * so the icon stays with the first word, for any label, and the rest wraps with the line.
 *
 * It READS as text: the sentence's own font, size and case (`font: inherit`), never monospace or capitals, set apart
 * by a light tint, its icon and a hover tint, the way an inline smart link or a mention is (body type, a tint and an
 * icon, never a typeface of its own). A border, mono capitals and a visible action after every name made a sentence
 * of several chips hard to read (2026-11-01).
 *
 * `link` wraps the icon and the name in the chip's link (the host's anchor, or the record's); a chip with a link
 * tints on hover. `trailing` is an action inside the SAME box, after the name (the record's "⋯" menu, a new-tab
 * link): faint until the chip is hovered or focused, so a sentence of chips stays quiet and the action is still there
 * to see and reach by keyboard, without the text moving. `loading` draws the lib `Tag`'s own skeleton.
 */

import type React from 'react';
import { cn } from '../../utils/cn';
import { Tag } from '../ui/tag';

/** An inline box in the sentence's own type, tinted, that wraps with its line. */
const INLINE_CHIP_CLASS = cn(
  'group/chip inline rounded-md bg-ods-bg-surface text-ods-text-primary [font:inherit]',
  'px-[var(--spacing-system-xxs)] py-px transition-colors duration-150',
  'whitespace-normal [-webkit-box-decoration-break:clone] [box-decoration-break:clone] [overflow-wrap:anywhere]',
);

/** A chip with a link: its tint deepens on hover (applied with `link`; a chip inside its anchor passes it as `className`). */
export const INLINE_CHIP_LINKED_CLASS = 'hover:bg-ods-bg-surface-hover';

/** The box that holds the name and, in its start padding, the icon. */
const INLINE_CHIP_NAME_CLASS = 'relative ps-[calc(1rem+var(--spacing-system-xxs))]';

/**
 * A 16px muted lead icon in that padding, on the first line, ending 0.2em under the text's baseline: an inline box starts
 * at its font's ascent above the baseline, 0.99em in the chat's body font (measured against the inline version it
 * replaces: within 0.2px at 14, 16 and 18px, in Chromium and in WebKit).
 *
 * Left-to-right only in WebKit. There a right-to-left name that wraps from the middle of a line keeps the icon on its first
 * line, 77 to 152px from the first letter: WebKit puts `start-0` at the edge of all the name's lines, not of the first. No
 * placement tried holds it (a static position with a negative margin is worse). Chromium is right either way.
 */
const INLINE_CHIP_ICON_CLASS = 'absolute start-0 top-[calc(1.19em-1rem)] size-4 text-ods-text-secondary [&_svg]:size-4';

/** The action after the name: faint, full on the chip's hover or keyboard focus. */
const INLINE_CHIP_TRAILING_CLASS = cn(
  'ml-[var(--spacing-system-xxs)] text-ods-text-secondary opacity-50 transition-opacity',
  'group-focus-within/chip:opacity-100 group-hover/chip:opacity-100',
);

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
  /** The name with the icon held to it (see the header). */
  const named = (name: React.ReactNode) =>
    icon ? (
      <span className={INLINE_CHIP_NAME_CLASS}>
        <span className={INLINE_CHIP_ICON_CLASS}>{icon}</span>
        {name}
      </span>
    ) : (
      name
    );
  // A line must not break between the name and its action, or the "⋯" is left alone at the start of the next line.
  // Browsers allow a break before an inline button whatever `white-space` says, so the name's LAST FEW CHARACTERS and the
  // action share one `nowrap` box; the rest of the name wraps freely. Only those few: a whole last word held there ran out
  // of the column whenever it was wider than the column (a host name), and the chat's scroller hides what overflows, the
  // action included. An ordinary word still moves to the next line whole: the edge of an inline box inside a word is no
  // place to break, and shaping carries across it (the same widths whole and split in Chromium and in WebKit, Arabic,
  // Devanagari and Hebrew included). They keep the link as a second anchor that is a click target only, and the first
  // anchor carries the whole name as its accessible name.
  const split = trailing && typeof label === 'string' ? splitNameEnd(label) : null;
  if (split) {
    const wrap = (content: React.ReactNode, anchor: InlineChipAnchor) => (link ? link(content, anchor) : content);
    return (
      <span data-testid="inline-chip" className={cn(INLINE_CHIP_CLASS, link && INLINE_CHIP_LINKED_CLASS, className)}>
        {split.head ? wrap(named(split.head), { label: label as string }) : null}
        <span className="whitespace-nowrap">
          {split.head ? wrap(split.end, { hidden: true }) : wrap(named(split.end), {})}
          <span className={INLINE_CHIP_TRAILING_CLASS}>{trailing}</span>
        </span>
      </span>
    );
  }
  const content = named(label);
  return (
    <span data-testid="inline-chip" className={cn(INLINE_CHIP_CLASS, link && INLINE_CHIP_LINKED_CLASS, className)}>
      {link ? link(content, {}) : content}
      {trailing ? (
        <span className="whitespace-nowrap">
          <span className={INLINE_CHIP_TRAILING_CLASS}>{trailing}</span>
        </span>
      ) : null}
    </span>
  );
}

/**
 * A name's last three characters as a reader counts them, or a line could end inside an emoji or a letter with its mark: a
 * base with its marks and skin tone, emoji joined by U+200D as one, a flag's two letters as one.
 */
const NAME_END = /(?:\p{RI}{2}|\P{M}[\p{M}\p{EMod}]*(?:‍\P{M}\p{M}*)*){1,3}$/u;

/**
 * A name split before the characters that stay with its action (`head` keeps a space). A last word shorter than that is
 * all of them, because a space inside the `nowrap` box is no place to break.
 */
function splitNameEnd(name: string): { head: string; end: string } {
  const trimmed = name.trimEnd();
  const at = Math.max(trimmed.search(/\S+$/), trimmed.search(NAME_END));
  return { head: trimmed.slice(0, at), end: trimmed.slice(at) };
}
