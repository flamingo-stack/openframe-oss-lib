'use client';

import React from 'react';
import Link from '../../embed-shims/next-link';
import { useCopyToClipboard } from '../../hooks';
import { cn } from '../../utils/cn';
import { CheckIcon } from '../icons-v2-generated';
import { Copy01Icon } from '../icons-v2-generated/documents';
import { TextLineSkeleton } from '../loading/unified-skeleton';
import { useLoadingScope } from './loading-scope';
import { ProgressBar, ProgressBarSkeleton } from './progress-bar';

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
  /** The data is still being read: the card draws its `skeleton` shape. A loading scope does the same while
   *  `data.items` is empty. */
  loading?: boolean;
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

/** Rows a loading card draws when its caller names no count. */
export const INFO_CARD_SKELETON_ROWS = 3;

/** The card's frame and groups, read by the card and by its skeleton. */
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

export function InfoCard({ data, className = '', skeleton, loading }: InfoCardProps) {
  // ONE switch: in a page's loading state with no rows yet (they are read), or while the host reads the data, the
  // card is its skeleton.
  const inScope = useLoadingScope();
  if (loading || (inScope && data.items.length === 0)) {
    return (
      <InfoCardSkeleton
        title={data.title || false}
        subtitle={data.subtitle || false}
        icon={data.icon}
        progress={!!data.progress}
        footer={data.footer ?? false}
        {...skeleton}
        className={className}
      />
    );
  }
  return (
    <div className={cn(FRAME_CLASS, className)}>
      {/* Header (title + subtitle) and body (rows + progress) are two groups separated by
          `gap-l`; the title/subtitle stack tightly and the rows use `gap-xs` — matching the ODS
          "Info-card" design. With no title/subtitle, the body is the only group. */}
      <div className={CONTENT_CLASS}>
        <InfoCardHead title={data.title} subtitle={data.subtitle} icon={data.icon} />

        {(data.items.length > 0 || data.progress) && (
          <div className={ROWS_CLASS}>
            {/* Info items */}
            {data.items.map((item, index) => {
              const values = Array.isArray(item.value) ? item.value : [item.value];

              return (
                <React.Fragment key={index}>
                  {values.map((val, valIndex) => (
                    <InfoCardValueRow
                      key={`${index}-${valIndex}`}
                      label={item.label}
                      value={val}
                      showLabel={valIndex === 0}
                      copyable={item.copyable}
                      icon={valIndex === 0 ? item.icon : undefined}
                      copyAriaLabel={`Copy ${item.label ?? 'value'} ${valIndex + 1}`}
                    />
                  ))}
                </React.Fragment>
              );
            })}

            {/* Progress bar */}
            {data.progress && (
              <ProgressBar
                progress={data.progress.value}
                warningThreshold={data.progress.warningThreshold}
                criticalThreshold={data.progress.criticalThreshold}
                inverted={data.progress.inverted}
              />
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      {data.footer && <InfoCardFooter footer={data.footer} />}
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
  label?: string;
  value: string;
  showLabel: boolean;
  copyable?: boolean;
  icon?: React.ReactNode;
  copyAriaLabel: string;
}

function InfoCardValueRow({ label, value, showLabel, copyable, icon, copyAriaLabel }: InfoCardValueRowProps) {
  const { copy, copied } = useCopyToClipboard();

  return (
    <div className={VALUE_ROW_CLASS}>
      <span className={ROW_LABEL_CLASS}>{showLabel ? label : ''}</span>
      <div className={DIVIDER_CLASS} />
      <div className="flex max-w-[60%] items-center gap-[var(--spacing-system-xsf)]">
        <span className="select-text truncate text-ods-text-primary text-h4" title={value}>
          {value}
        </span>
        {icon}
        {copyable && (
          <button
            type="button"
            onClick={() => copy(value)}
            className={cn(
              'transition-colors',
              copied ? 'text-ods-success' : 'text-ods-text-secondary hover:text-ods-text-primary',
            )}
            aria-label={copyAriaLabel}
          >
            {copied ? <CheckIcon size={16} /> : <Copy01Icon size={16} />}
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * An InfoCard while its data is read: the same frame and groups, the title and subtitle drawn for real when the
 * caller passes their words (`text-h4` bars otherwise), each row its label (real when passed, a bar when not, none
 * when unlabelled) and a value bar either side of the row's divider, the progress bar and the footer line boxes of
 * their own height.
 */
export function InfoCardSkeleton({
  rows = INFO_CARD_SKELETON_ROWS,
  unlabelledRows = false,
  title = true,
  subtitle = false,
  progress = false,
  footer = false,
  icon,
  className = '',
}: InfoCardSkeletonShape & { className?: string }) {
  // Each row's label: a word drawn for real, `null` for no label, `undefined` for a label bar.
  const rowLabels: Array<string | null | undefined> = Array.isArray(rows)
    ? rows.map(label => label || null)
    : Array.from({ length: rows }, () => (unlabelledRows ? null : undefined));
  return (
    <div className={cn(FRAME_CLASS, className)} aria-hidden>
      <div className={CONTENT_CLASS}>
        <InfoCardHead title={title} subtitle={subtitle} icon={icon} />
        {(rowLabels.length > 0 || progress) && (
          <div className={ROWS_CLASS}>
            {rowLabels.map((label, index) => (
              <div key={index} className={VALUE_ROW_CLASS}>
                {label === undefined ? (
                  <TextLineSkeleton type="h4" className="w-20" />
                ) : (
                  <span className={ROW_LABEL_CLASS}>{label ?? ''}</span>
                )}
                <div className={DIVIDER_CLASS} />
                <TextLineSkeleton type="h4" className="w-24" />
              </div>
            ))}
            {progress && <ProgressBarSkeleton />}
          </div>
        )}
      </div>
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
