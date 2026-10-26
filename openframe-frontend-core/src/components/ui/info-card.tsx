'use client';

import type React from 'react';
import Link from '../../embed-shims/next-link';
import { useCopyToClipboard } from '../../hooks';
import { cn } from '../../utils/cn';
import { CheckIcon } from '../icons-v2-generated';
import { Copy01Icon } from '../icons-v2-generated/documents';
import { TextLineSkeleton } from '../loading/unified-skeleton';
import { Button } from './button';
import { loadingItemProps, useLoadingScope } from './loading-scope';
import { ProgressBar } from './progress-bar';

export interface InfoCardFooterData {
  /** Leading icon next to the text, expected at 24x24 (e.g. <ShieldCheckIcon size={24} />) */
  icon?: React.ReactNode;
  text: string;
  /** Trailing icon/logo aligned to the right edge, expected at 24x24 */
  logo?: React.ReactNode;
  /** External resource link rendered below the text row */
  link?: {
    href: string;
    /** Defaults to href without the protocol */
    label?: string;
  };
}

export interface InfoCardData {
  title?: string;
  subtitle?: string;
  icon?: React.ReactNode;
  items: Array<{
    label?: string;
    value: string | string[];
    copyable?: boolean;
    /** Optional trailing icon/logo (e.g. an SVG) rendered next to the value */
    icon?: React.ReactNode;
  }>;
  progress?: {
    value: number;
    warningThreshold?: number;
    criticalThreshold?: number;
    inverted?: boolean; // if true, high values are good (green), low values are bad (red)
  };
  /** Optional footer rendered below the content, separated by a divider line */
  footer?: InfoCardFooterData;
}

interface InfoCardProps {
  data: InfoCardData;
  className?: string;
  /**
   * The shape drawn while the data is read (a page's loading state, where `data.items` is empty). What it leaves out
   * is taken from `data`: its title and subtitle drawn for real (none without them), its icon, its progress bar and
   * its footer.
   */
  skeleton?: InfoCardSkeletonShape;
  /** The data is still being read: the card keeps its ONE structure in its `skeleton` shape, its copy real and every
   *  read value a bar. A loading scope does the same while `data.items` is empty. */
  loading?: boolean;
  /** `data-*` markers (`data-loading-item` on a read list's card), on the card's root in both forms. */
  [key: `data-${string}`]: unknown;
}

/**
 * What a loading InfoCard draws: its rows, and whether it carries a head, a progress bar and a footer. Static copy
 * the caller already knows is passed as words and drawn for real; only the read values are bars.
 */
export interface InfoCardSkeletonShape {
  /**
   * The value rows. A number draws that many rows, each a label bar and a value bar. A list of labels draws one row
   * per label, the label real and the value a bar (`null` or `''`: a row with no label, as a multi-value item's
   * further values are drawn). Default {@link INFO_CARD_SKELETON_ROWS}.
   */
  rows?: number | Array<string | null>;
  /** With a number of `rows`: the rows carry no label (only their value bars). Default `false`. */
  unlabelledRows?: boolean;
  /** The title line: `true` a bar, a string the title drawn for real, `false` none. Default `true`. */
  title?: boolean | string;
  /** The subtitle line: `true` a bar, a string the subtitle drawn for real. */
  subtitle?: boolean | string;
  progress?: boolean;
  /** The footer: `true` a bar, the footer's own data drawn for real, `false` none. */
  footer?: boolean | InfoCardFooterData;
  /** The head's icon, static, drawn for real beside the title (or the subtitle when there is no title). */
  icon?: React.ReactNode;
}

/** Rows a loading card draws when its caller names no count (a typical card's rows). */
const INFO_CARD_SKELETON_ROWS = 3;

/** The card's frame and groups, loaded and loading. */
const FRAME_CLASS = 'flex w-full flex-col overflow-hidden rounded-md border border-ods-border bg-ods-card';
const CONTENT_CLASS = 'flex w-full flex-col items-start gap-[var(--spacing-system-l)] p-[var(--spacing-system-m)]';
const HEAD_CLASS = 'flex w-full flex-col items-start self-stretch';
const HEAD_LINE_CLASS = 'flex items-center gap-[var(--spacing-system-xsf)] self-stretch';
const ROWS_CLASS = 'flex w-full flex-col items-start gap-[var(--spacing-system-xs)] self-stretch';
const VALUE_ROW_CLASS = 'flex h-6 w-full items-center gap-[var(--spacing-system-xs)] self-stretch';
const DIVIDER_CLASS = 'h-px flex-1 bg-ods-divider';
const TITLE_TEXT_CLASS = 'min-w-0 truncate text-ods-text-primary text-h4';
const SUBTITLE_TEXT_CLASS = 'min-w-0 truncate text-ods-text-secondary text-h4';
const ROW_LABEL_CLASS = 'whitespace-nowrap text-ods-text-primary text-h4';
const FOOTER_CLASS = 'mt-auto flex w-full flex-col border-t border-ods-border p-[var(--spacing-system-m)]';

export function InfoCard({ data, className = '', skeleton, loading: loadingProp, ...props }: InfoCardProps) {
  // ONE switch: in a page's loading state with no rows yet (they are read), or while the host reads the data, the
  // card keeps its structure in its `skeleton` shape: what the shape leaves out is taken from `data`.
  const inScope = useLoadingScope();
  const loading = !!loadingProp || (inScope && data.items.length === 0);
  const shape: InfoCardSkeletonShape & Required<Pick<InfoCardSkeletonShape, 'rows'>> = {
    rows: INFO_CARD_SKELETON_ROWS,
    unlabelledRows: false,
    title: data.title || false,
    subtitle: data.subtitle || false,
    icon: data.icon,
    progress: !!data.progress,
    footer: data.footer ?? false,
    ...skeleton,
  };

  // Each row: its label (real; `null` none; `undefined` a bar while loading), its value, whether it heads its item.
  const rows: Array<InfoCardValueRowProps & { key: string }> = loading
    ? (Array.isArray(shape.rows)
        ? shape.rows.map(label => label || null)
        : Array.from({ length: shape.rows }, () => (shape.unlabelledRows ? null : undefined))
      ).map((label, index) => ({
        key: String(index),
        label,
        value: '',
        showLabel: true,
        copyAriaLabel: '',
        loading: true,
      }))
    : data.items.flatMap((item, index) => {
        const values = Array.isArray(item.value) ? item.value : [item.value];
        return values.map((val, valIndex) => ({
          key: `${index}-${valIndex}`,
          label: item.label,
          value: val,
          showLabel: valIndex === 0,
          copyable: item.copyable,
          icon: valIndex === 0 ? item.icon : undefined,
          copyAriaLabel: `Copy ${item.label ?? 'value'} ${valIndex + 1}`,
        }));
      });
  const showProgress = loading ? !!shape.progress : !!data.progress;
  const footer = loading ? shape.footer : (data.footer ?? false);

  return (
    <div className={cn(FRAME_CLASS, className)} aria-hidden={loading || undefined} {...loadingItemProps(props)}>
      {/* Header (title + subtitle) and body (rows + progress) are two groups separated by
          `gap-l`; the title/subtitle stack tightly and the rows use `gap-xs` — matching the ODS
          "Info-card" design. With no title/subtitle, the body is the only group. */}
      <div className={CONTENT_CLASS}>
        <InfoCardHead
          title={loading ? shape.title : data.title}
          subtitle={loading ? shape.subtitle : data.subtitle}
          icon={loading ? shape.icon : data.icon}
        />

        {(rows.length > 0 || showProgress) && (
          <div className={ROWS_CLASS}>
            {rows.map(({ key, ...row }) => (
              <InfoCardValueRow key={key} {...row} />
            ))}

            {showProgress && (
              <ProgressBar
                loading={loading}
                progress={data.progress?.value ?? 0}
                warningThreshold={data.progress?.warningThreshold}
                criticalThreshold={data.progress?.criticalThreshold}
                inverted={data.progress?.inverted}
              />
            )}
          </div>
        )}
      </div>

      {/* Footer: its data drawn for real (a loading shape may pass it), `true` a bar while read. */}
      {typeof footer === 'object' ? (
        <InfoCardFooter footer={footer} />
      ) : (
        footer && (
          <div className={FOOTER_CLASS}>
            <TextLineSkeleton type="h4" className="w-1/2" />
          </div>
        )
      )}
    </div>
  );
}

/**
 * The card's head, loaded and loading: the title over the subtitle. A string is drawn for real, `true` is a
 * `text-h4` bar while it is read, nothing draws no line. The icon lives with the title when there is one; otherwise it
 * falls to the subtitle so subtitle-only cards still render it.
 */
function InfoCardHead({
  title,
  subtitle,
  icon,
}: {
  title?: string | boolean;
  subtitle?: string | boolean;
  icon?: React.ReactNode;
}) {
  if (!title && !subtitle) return null;
  return (
    <div className={HEAD_CLASS}>
      {title && (
        <div className={HEAD_LINE_CLASS}>
          {typeof title === 'string' ? (
            <span className={TITLE_TEXT_CLASS} title={title}>
              {title}
            </span>
          ) : (
            <TextLineSkeleton type="h4" className="w-1/2" />
          )}
          {icon}
        </div>
      )}
      {subtitle && (
        <div className={HEAD_LINE_CLASS}>
          {typeof subtitle === 'string' ? (
            <span className={SUBTITLE_TEXT_CLASS} title={subtitle}>
              {subtitle}
            </span>
          ) : (
            <TextLineSkeleton type="h4" className="w-1/3" />
          )}
          {!title && icon}
        </div>
      )}
    </div>
  );
}

function InfoCardFooter({ footer }: { footer: InfoCardFooterData }) {
  return (
    <div className={FOOTER_CLASS}>
      <div className="flex w-full items-center justify-between gap-1">
        <div className="flex items-center gap-1">
          {footer.icon}
          <span className="text-ods-text-primary text-h4">{footer.text}</span>
        </div>
        {footer.logo}
      </div>
      {footer.link && (
        <Link
          href={footer.link.href}
          target="_blank"
          rel="noopener noreferrer"
          className="truncate text-ods-text-secondary underline text-h6 hover:text-ods-text-primary"
        >
          {footer.link.label ?? footer.link.href.replace(/^https?:\/\//, '')}
        </Link>
      )}
    </div>
  );
}

interface InfoCardValueRowProps {
  /** The row's label; while loading, `undefined` is a label not here yet (a bar) and `null` a row with no label. */
  label?: string | null;
  value: string;
  showLabel: boolean;
  copyable?: boolean;
  icon?: React.ReactNode;
  copyAriaLabel: string;
  /** The value is still being read: a bar in the value's place, without its icon and copy button. */
  loading?: boolean;
}

/** One `label —— value` row, loaded and loading (the card decides: its rows are its own read data). */
function InfoCardValueRow({
  label,
  value,
  showLabel,
  copyable,
  icon,
  copyAriaLabel,
  loading: loadingProp,
}: InfoCardValueRowProps) {
  const { copy, copied } = useCopyToClipboard();
  const loading = useLoadingScope() || loadingProp;

  return (
    <div className={VALUE_ROW_CLASS}>
      {loading && label === undefined ? (
        <TextLineSkeleton type="h4" className="w-20" />
      ) : (
        <span className={ROW_LABEL_CLASS}>{showLabel ? (label ?? '') : ''}</span>
      )}
      <div className={DIVIDER_CLASS} />
      {loading ? (
        <TextLineSkeleton type="h4" className="w-24" />
      ) : (
        <div className="flex max-w-[60%] items-center gap-[var(--spacing-system-xsf)]">
          <span className="select-text truncate text-ods-text-primary text-h4" title={value}>
            {value}
          </span>
          {icon}
          {copyable && (
            <Button
              variant="bare"
              size="icon-inline"
              type="button"
              onClick={() => copy(value)}
              aria-label={copyAriaLabel}
            >
              {copied ? <CheckIcon className="text-ods-success" /> : <Copy01Icon className="text-ods-text-secondary" />}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
