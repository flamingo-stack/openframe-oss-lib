'use client';

import type { ReactNode } from 'react';
import Link from '../../embed-shims/next-link';
import { cn } from '../../utils/cn';
import { TextLineSkeleton } from '../loading/unified-skeleton';
import { AssigneeDropdown, type AssigneeDropdownProps } from './assignee-dropdown';
import { useLoadingScope } from './loading-scope';
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

function TextValue({ value }: { value: InfoSectionTextValue }) {
  const { text, imageSrc, imageFallback, imageVariant = 'round', icon, onClick, href, openInNewTab } = value;
  const hasImage = imageSrc !== undefined || imageFallback !== undefined;
  const interactiveClass = 'truncate text-left text-h4 text-ods-text-primary transition-colors hover:text-ods-accent';
  return (
    <>
      {icon && <span className="flex size-4 shrink-0 items-center justify-center text-ods-text-secondary">{icon}</span>}
      {href ? (
        <Link
          href={href}
          target={openInNewTab ? '_blank' : undefined}
          rel={openInNewTab ? 'noopener noreferrer' : undefined}
          title={text}
          className={interactiveClass}
        >
          {text}
        </Link>
      ) : onClick ? (
        <button type="button" onClick={onClick} title={text} className={interactiveClass}>
          {text}
        </button>
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
      return <>{value.content}</>;
    default:
      return <TextValue value={value} />;
  }
}

/** The card's layout, read by the loaded rows and by the skeleton rows, so both are one size. */
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
 * Loading (`loading`, or a `LoadingScope`): the caption and the labels are the page's copy and are drawn for real;
 * every value is a bar (`InfoSectionSkeleton`).
 */
export function InfoSection({ title, rows, loading: loadingProp, className }: InfoSectionProps) {
  const loading = useLoadingScope() || !!loadingProp;
  if (loading) return <InfoSectionSkeleton title={title} labels={rows.map(row => row.label)} className={className} />;
  return (
    <div className={cn(INFO_SECTION_ROOT_CLASS, className)}>
      {title && <p className={INFO_SECTION_TITLE_CLASS}>{title}</p>}
      <div className={INFO_SECTION_CARD_CLASS}>
        {rows.map(row => (
          <div key={row.id} className={INFO_SECTION_ROW_CLASS}>
            <span className={INFO_SECTION_LABEL_CLASS}>{row.label}</span>
            <div className={INFO_SECTION_LINE_CLASS} />
            <div className={INFO_SECTION_VALUE_CLASS}>
              <RowValue value={row.value} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * The card while its values are read: the caption and each row's label drawn for real (static copy), the leader
 * line for real, and one `text-h4` line bar where the value goes, in the same row box as a loaded value.
 */
export function InfoSectionSkeleton({
  title,
  labels,
  className,
}: {
  title?: string;
  /** The rows' labels: the page's copy, one row each. */
  labels: string[];
  className?: string;
}) {
  return (
    <div className={cn(INFO_SECTION_ROOT_CLASS, className)} aria-hidden>
      {title && <p className={INFO_SECTION_TITLE_CLASS}>{title}</p>}
      <div className={INFO_SECTION_CARD_CLASS}>
        {labels.map((label, index) => (
          <div key={`${label}-${index}`} className={INFO_SECTION_ROW_CLASS}>
            <span className={INFO_SECTION_LABEL_CLASS}>{label}</span>
            <div className={INFO_SECTION_LINE_CLASS} />
            <div className={INFO_SECTION_VALUE_CLASS}>
              <TextLineSkeleton as="span" type="h4" className="inline-flex w-24" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
