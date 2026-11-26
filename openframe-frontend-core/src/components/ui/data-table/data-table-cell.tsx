'use client';

import type { ReactNode } from 'react';
import { cn } from '../../../utils/cn';
import { FloatingTooltip } from '../floating-tooltip';
import { SquareAvatar } from '../square-avatar';
import { Tag } from '../tag';
import { TruncateText } from '../truncate-text';

/** What sits at the start of a grid cell: an icon, a picture (a company logo) or a person's avatar. */
export type DataTableCellLeading =
  | { type: 'icon'; icon: ReactNode }
  | { type: 'image'; src?: string | null; alt: string }
  | { type: 'avatar'; src?: string | null; name: string };

export interface DataTableCellProps {
  /** The icon, picture or avatar before the text. */
  leading?: DataTableCellLeading;
  /** The cell's main text: one line, cut with an ellipsis, its full value in a tooltip when cut. */
  text?: string;
  /** The main text's tone. `secondary` mutes it: a row whose subject is gone (an expired recording). Default `primary`. */
  tone?: 'primary' | 'secondary';
  /** The cell's tag (a status). Never cut: the text beside it gives way first. */
  tag?: ReactNode;
  /**
   * The main text takes only its own width, so the tag and the secondary text sit right after it instead of at the
   * line's end (a name with its status beside it). On a short line the main text gives way first, down to about 5rem
   * (or its own width, if shorter); past that the tag gives way, cut by its own label's ellipsis, so neither ever
   * vanishes. Default `false`: the main text takes the line and the tag is never cut.
   */
  hugText?: boolean;
  /** A small mark right after the tags (an outdated-agent icon). Never cut, with or without `hugText`. */
  mark?: ReactNode;
  /** Labels of the tags that do not fit: drawn as one grey `+N` tag that lists them on hover. */
  moreTags?: string[];
  /**
   * A short text after the main text or the tag ("1 hour ago", a version). There is no second line. A long one (an
   * email, a reason) is cut with an ellipsis when the column is too narrow for it, its full value in a tooltip.
   */
  secondary?: string;
  /**
   * The secondary text's tone. `warning` marks one worth a look (users no customer claims, seats left unused).
   * Default `secondary`.
   */
  secondaryTone?: 'secondary' | 'warning';
  /** A small mark at the end of the line (an unread dot). */
  trailing?: ReactNode;
  className?: string;
}

/**
 * How many characters of the main text stay when a LONG secondary text sits beside it (the design's text minimum: 9 to
 * 10 characters before the ellipsis). A main text no longer than this never shrinks there.
 */
const MAIN_TEXT_MIN_CHARS = 9;
/** The main text beside a long secondary text: the first part to shrink, down to `MAIN_TEXT_MIN_CHARS` characters. */
const MAIN_TEXT_SHRINK_CLASS = 'flex-[1_9999_auto] min-w-[9ch]';
/**
 * A secondary text this short ("v2.4.1", "14:05", "3 h ago") is never cut: the main text gives way to it entirely.
 * A longer one (an email, a reason) is cut once the main text is down to its minimum, so it cannot push the main text
 * out of the cell.
 */
const SECONDARY_WHOLE_CHARS = 8;

/** `hugText`: the main text gives way before anything beside it (the tag's own floor below is what stops it). */
export const DATA_TABLE_CELL_HUG_TEXT_CLASS = 'flex-[0_9999_auto]';

/**
 * `hugText`: the tag's box. It may shrink (its label cuts itself), but never so far that it takes more than the line
 * less about 5rem: that is the main text's floor. A main text shorter than that keeps its own width; the room it leaves
 * goes to the end of the line, never between the text and the tag.
 */
export const DATA_TABLE_CELL_HUG_TAG_CLASS = 'flex min-w-0 max-w-[calc(100%_-_5rem_-_var(--spacing-system-xxs))]';

/**
 * The content of one grid-table cell (the design's `table/cell`): ONE line, whatever it holds. The cell's box (its 48px
 * height, inset, dividers and fill) is the table's; this is what goes in it.
 *
 * What gives way when the column is narrow, in order: the main text (ellipsis), then a long secondary text
 * (ellipsis, once the main text is down to its first `MAIN_TEXT_MIN_CHARS` characters). A short secondary text, a tag,
 * the `+N` tag and the leading mark never shrink.
 */
export function DataTableCell({
  leading,
  text,
  tone = 'primary',
  tag,
  hugText = false,
  mark,
  moreTags,
  secondary,
  secondaryTone = 'secondary',
  trailing,
  className,
}: DataTableCellProps) {
  const hasText = text !== undefined;
  const hiddenTags = moreTags?.length ? moreTags : null;
  // A long secondary text beside a main text may be cut; the main text then keeps its first characters (a main text
  // already that short does not shrink at all). In every other shape the main text takes the line and is the one cut.
  const cutSecondary = hasText && secondary !== undefined && secondary.length > SECONDARY_WHOLE_CHARS;
  const mainTextClass = !cutSecondary
    ? hugText
      ? DATA_TABLE_CELL_HUG_TEXT_CLASS
      : 'flex-1'
    : (text?.length ?? 0) > MAIN_TEXT_MIN_CHARS
      ? MAIN_TEXT_SHRINK_CLASS
      : 'flex-[1_0_auto]';

  return (
    <div className={cn('flex min-w-0 flex-1 items-center gap-[var(--spacing-system-xsf)]', className)}>
      {leading && <Leading leading={leading} />}
      <div className="flex min-w-0 flex-1 items-center gap-[var(--spacing-system-xxs)] overflow-hidden">
        {hasText && (
          <TruncateText as="span" variant="h4" tone={tone} triggerClassName={mainTextClass}>
            {text}
          </TruncateText>
        )}
        {tag != null && tag !== false && (
          <span data-part="tag" className={hugText ? DATA_TABLE_CELL_HUG_TAG_CLASS : 'flex shrink-0'}>
            {tag}
          </span>
        )}
        {hiddenTags && (
          <FloatingTooltip
            as="span"
            side="top"
            triggerClassName="flex shrink-0"
            content={
              <span className="flex flex-col gap-[var(--spacing-system-xxs)]">
                {hiddenTags.map(label => (
                  <span key={label}>{label}</span>
                ))}
              </span>
            }
          >
            <Tag as="span" variant="grey" data-part="more" label={`+${hiddenTags.length}`} />
          </FloatingTooltip>
        )}
        {mark != null && mark !== false && (
          <span data-part="mark" className="flex shrink-0">
            {mark}
          </span>
        )}
        {secondary !== undefined &&
          (cutSecondary ? (
            // Cut once the main text is down to its first characters, the full value in a tooltip.
            <span data-part="secondary" className="flex min-w-0 shrink">
              <TruncateText
                as="span"
                variant="h6"
                tone="secondary"
                className={secondaryTone === 'warning' ? 'text-ods-warning' : undefined}
              >
                {secondary}
              </TruncateText>
            </span>
          ) : (
            // Short beside a main text: kept whole, the main text gives way. With no main text (a status cell: tag +
            // "1 hour ago") it is the one part left to cut.
            <span
              data-part="secondary"
              className={cn(
                'whitespace-nowrap text-h6',
                secondaryTone === 'warning' ? 'text-ods-warning' : 'text-ods-text-secondary',
                hasText ? 'shrink-0' : 'min-w-0 flex-1 truncate',
              )}
            >
              {secondary}
            </span>
          ))}
      </div>
      {trailing != null && trailing !== false && (
        <span data-part="trailing" className="flex shrink-0">
          {trailing}
        </span>
      )}
    </div>
  );
}

function Leading({ leading }: { leading: DataTableCellLeading }) {
  if (leading.type === 'icon') {
    return (
      <span data-part="leading" className="flex size-5 shrink-0 items-center justify-center text-ods-text-secondary">
        {leading.icon}
      </span>
    );
  }
  if (leading.type === 'image') {
    return (
      <SquareAvatar
        data-part="leading"
        size="sm"
        variant="square"
        fit="contain"
        className="rounded-sm"
        src={leading.src ?? undefined}
        alt={leading.alt}
        fallback={leading.alt}
      />
    );
  }
  return (
    <SquareAvatar
      data-part="leading"
      size="sm"
      variant="round"
      src={leading.src ?? undefined}
      alt={leading.name}
      fallback={leading.name}
    />
  );
}
