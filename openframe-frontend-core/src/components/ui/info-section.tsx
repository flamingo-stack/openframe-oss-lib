'use client';

import type { ReactNode } from 'react';
import { cn } from '../../utils/cn';
import { TextLineSkeleton } from '../loading/unified-skeleton';
import { AssigneeDropdown, type AssigneeDropdownProps } from './assignee-dropdown';
import { Button } from './button';
import { LoadingWhen, useLoadingScope } from './loading-scope';
import { SquareAvatar } from './square-avatar';
import { TicketStatusTag, type TicketStatusTagProps } from './ticket-status-tag';

/** A plain-text value, optionally with a trailing image (avatar), leading icon, or click action. */
export interface InfoSectionTextValue {
  type?: 'text';
  text: string;
  /** Image shown after the text (e.g. a user or organization avatar). */
  imageSrc?: string;
  /** Initials shown when the image is missing or fails to load. Defaults to `text`. */
  imageFallback?: string;
  /** Avatar shape. Defaults to `round`. */
  imageVariant?: 'square' | 'round';
  /** Icon shown before the text. */
  icon?: ReactNode;
  /** Renders the text as a button; on hover it takes the accent color. */
  onClick?: () => void;
  /**
   * Renders the text as a link (Next.js `Link`). Takes precedence over `onClick`.
   * A regular click navigates in the same tab; the browser's native new-tab
   * affordances (cmd/ctrl-click, "open in new tab") work as usual.
   */
  href?: string;
  /** Force the link to always open in a new tab (sets `target="_blank"`). */
  openInNewTab?: boolean;
}

/** An inline assignee picker (autocomplete with search). Defaults to the `compact` variant. */
export type InfoSectionAssigneeValue = { type: 'assignee' } & AssigneeDropdownProps;

/** An inline status changer (dropdown). Pass `options` + `onSelect` to make it interactive. */
export type InfoSectionStatusValue = { type: 'status' } & TicketStatusTagProps;

/** Arbitrary value content. */
export interface InfoSectionCustomValue {
  type: 'custom';
  content: ReactNode;
}

export type InfoSectionValue =
  InfoSectionTextValue | InfoSectionAssigneeValue | InfoSectionStatusValue | InfoSectionCustomValue;

export interface InfoSectionRow {
  /** Stable key for the row. */
  id: string;
  /** Left-side label. */
  label: string;
  /** Right-side value: text (with optional image), assignee picker, status dropdown, or custom node. */
  value: InfoSectionValue;
}

export interface InfoSectionProps {
  /** Optional caption rendered above the card (e.g. "Ticket Details"). */
  title?: string;
  rows: InfoSectionRow[];
  /** The values are being read: each row draws its label for real and a bar for its value. A loading scope does
   *  the same. */
  loading?: boolean;
  className?: string;
}

/** A text value's line while it is read: the `text-h4` line in the value box. */
function TextValueSkeleton() {
  return <TextLineSkeleton as="span" type="h4" className="inline-flex w-24" />;
}

function TextValue({ value }: { value: InfoSectionTextValue }) {
  const { text, imageSrc, imageFallback, imageVariant = 'round', icon, onClick, href, openInNewTab } = value;
  const loading = useLoadingScope();
  const hasImage = imageSrc !== undefined || imageFallback !== undefined;
  return (
    <>
      {icon && <span className="flex size-4 shrink-0 items-center justify-center text-ods-text-secondary">{icon}</span>}
      {loading ? (
        <TextValueSkeleton />
      ) : href || onClick ? (
        <Button
          variant="link"
          size="compact"
          noPaddingX
          type="button"
          href={href}
          openInNewTab={openInNewTab}
          onClick={href ? undefined : onClick}
          className="min-w-0"
        >
          <span className="truncate" title={text}>
            {text}
          </span>
        </Button>
      ) : (
        <span className="truncate text-ods-text-primary text-h4" title={text}>
          {text}
        </span>
      )}
      {hasImage && (
        <SquareAvatar
          src={imageSrc}
          alt={text}
          fallback={imageFallback ?? text}
          size="sm"
          variant={imageVariant}
          className="h-4 w-4"
        />
      )}
    </>
  );
}

function RowValue({ value }: { value: InfoSectionValue }) {
  switch (value.type) {
    case 'assignee': {
      const { type: _type, ...props } = value;
      return <AssigneeDropdown {...props} variant={props.variant ?? 'compact'} />;
    }
    case 'status': {
      const { type: _type, ...props } = value;
      return <TicketStatusTag {...props} />;
    }
    case 'custom':
      return <CustomValue content={value.content} />;
    default:
      return <TextValue value={value} />;
  }
}

/** Custom content: a node switches itself in a scope; plain text read by the host is drawn as the text line. */
function CustomValue({ content }: { content: ReactNode }) {
  const loading = useLoadingScope();
  if (loading && (typeof content === 'string' || typeof content === 'number')) return <TextValueSkeleton />;
  return <>{content}</>;
}

/** The card's layout. */
const INFO_SECTION_ROOT_CLASS = 'flex flex-col gap-[var(--spacing-system-xxs)]';
const INFO_SECTION_TITLE_CLASS = 'text-ods-text-secondary text-h5';
const INFO_SECTION_CARD_CLASS =
  'flex flex-col gap-[var(--spacing-system-xsf)] rounded-md border border-ods-border bg-ods-card p-[var(--spacing-system-mf)]';
const INFO_SECTION_ROW_CLASS = 'flex w-full min-w-0 items-center gap-[var(--spacing-system-xsf)]';
const INFO_SECTION_LABEL_CLASS = 'shrink-0 text-ods-text-secondary text-h4';
const INFO_SECTION_LINE_CLASS = 'h-px min-w-4 flex-1 bg-ods-border';
const INFO_SECTION_VALUE_CLASS = 'flex min-w-0 items-center gap-[var(--spacing-system-xsf)]';

/**
 * A labelled info card: a vertical stack of `label —— value` rows inside a
 * bordered card, with an optional uppercase caption above it. Each row's value
 * is configurable — plain text (with an optional trailing image), an inline
 * assignee picker (autocomplete with search), an inline status dropdown, or an
 * arbitrary node.
 *
 * Loading (`loading`, or a `LoadingScope`): ONE structure. The caption, the labels and the leader lines are the page's
 * copy and are drawn for real; every value is its control, drawn in a scope, so it draws its own skeleton (a tag for
 * a status, the picker's box for an assignee, a text line) in the same value box.
 */
export function InfoSection({ title, rows, loading: loadingProp, className }: InfoSectionProps) {
  const loading = useLoadingScope() || !!loadingProp;
  return (
    <div className={cn(INFO_SECTION_ROOT_CLASS, className)} aria-hidden={loading || undefined}>
      {title && <p className={INFO_SECTION_TITLE_CLASS}>{title}</p>}
      <div className={INFO_SECTION_CARD_CLASS}>
        {rows.map(row => (
          <div key={row.id} className={INFO_SECTION_ROW_CLASS}>
            <span className={INFO_SECTION_LABEL_CLASS}>{row.label}</span>
            <div className={INFO_SECTION_LINE_CLASS} />
            <div className={INFO_SECTION_VALUE_CLASS}>
              <LoadingWhen loading={loading}>
                <RowValue value={row.value} />
              </LoadingWhen>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
