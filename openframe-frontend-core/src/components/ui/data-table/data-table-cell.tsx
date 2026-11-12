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
  /** The cell's tag (a status). Never cut: the text beside it gives way first. */
  tag?: ReactNode;
  /** Labels of the tags that do not fit: drawn as one grey `+N` tag that lists them on hover. */
  moreTags?: string[];
  /** A short text after the main text or the tag ("1 hour ago", a version). There is no second line. */
  secondary?: string;
  /** A small mark at the end of the line (an unread dot). */
  trailing?: ReactNode;
  className?: string;
}

/**
 * The content of one grid-table cell (the design's `table/cell`): ONE line, whatever it holds. The cell's box (its 48px
 * height, inset, dividers and fill) is the table's; this is what goes in it.
 *
 * What gives way when the column is narrow, in order: the main text (ellipsis), then the secondary text. A tag, the
 * `+N` tag and the leading mark never shrink.
 */
export function DataTableCell({ leading, text, tag, moreTags, secondary, trailing, className }: DataTableCellProps) {
  const hasText = text !== undefined;
  const hiddenTags = moreTags?.length ? moreTags : null;

  return (
    <div className={cn('flex min-w-0 flex-1 items-center gap-[var(--spacing-system-xsf)]', className)}>
      {leading && <Leading leading={leading} />}
      <div className="flex min-w-0 flex-1 items-center gap-[var(--spacing-system-xxs)] overflow-hidden">
        {hasText && (
          <TruncateText as="span" variant="h4" triggerClassName="flex-1">
            {text}
          </TruncateText>
        )}
        {tag != null && tag !== false && (
          <span data-part="tag" className="flex shrink-0">
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
        {secondary !== undefined && (
          // Beside a main text the secondary text keeps its width and the main text gives way; with no main text
          // (a status cell: tag + "1 hour ago") it is the one part left to cut.
          <span
            data-part="secondary"
            className={cn(
              'whitespace-nowrap text-ods-text-secondary text-h6',
              hasText ? 'shrink-0' : 'min-w-0 flex-1 truncate',
            )}
          >
            {secondary}
          </span>
        )}
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
