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
  /** The shape drawn while the data is read (a page's loading state, where `data.items` is empty). */
  skeleton?: InfoCardSkeletonShape;
}

/** What a loading InfoCard draws: its rows, and whether it carries a head, a progress bar and a footer. */
export interface InfoCardSkeletonShape {
  /** Value rows drawn. Default {@link INFO_CARD_SKELETON_ROWS}. */
  rows?: number;
  /** A title line. Default `true`. */
  title?: boolean;
  /** A subtitle line. */
  subtitle?: boolean;
  progress?: boolean;
  footer?: boolean;
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
const FOOTER_CLASS = 'mt-auto flex w-full flex-col border-t border-ods-border p-[var(--spacing-system-m)]';

export function InfoCard({ data, className = '', skeleton }: InfoCardProps) {
  // In a page's loading state with no rows yet (they are read) the card is its skeleton.
  const inScope = useLoadingScope();
  if (inScope && data.items.length === 0) return <InfoCardSkeleton {...skeleton} className={className} />;
  return (
    <div className={cn(FRAME_CLASS, className)}>
      {/* Header (title + subtitle) and body (rows + progress) are two groups separated by
          `gap-l`; the title/subtitle stack tightly and the rows use `gap-xs` — matching the ODS
          "Info-card" design. With no title/subtitle, the body is the only group. */}
      <div className={CONTENT_CLASS}>
        {(data.title || data.subtitle) && (
          <div className={HEAD_CLASS}>
            {data.title && (
              <div className={HEAD_LINE_CLASS}>
                <span className="min-w-0 truncate text-ods-text-primary text-h4" title={data.title}>
                  {data.title}
                </span>
                {data.icon}
              </div>
            )}
            {data.subtitle && (
              <div className={HEAD_LINE_CLASS}>
                <span className="min-w-0 truncate text-ods-text-secondary text-h4" title={data.subtitle}>
                  {data.subtitle}
                </span>
                {/* Icon lives with the title when present; otherwise it falls to the subtitle so
                    subtitle-only cards still render it. */}
                {!data.title && data.icon}
              </div>
            )}
          </div>
        )}

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
      <span className="whitespace-nowrap text-ods-text-primary text-h4">{showLabel ? label : ''}</span>
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
 * An InfoCard while its data is read: the same frame and groups, the title and subtitle `text-h4` bars, each row
 * its label and value bars either side of the row's divider, the progress bar and the footer line boxes of their
 * own height.
 */
export function InfoCardSkeleton({
  rows = INFO_CARD_SKELETON_ROWS,
  title = true,
  subtitle = false,
  progress = false,
  footer = false,
  className = '',
}: InfoCardSkeletonShape & { className?: string }) {
  return (
    <div className={cn(FRAME_CLASS, className)} aria-hidden>
      <div className={CONTENT_CLASS}>
        {(title || subtitle) && (
          <div className={HEAD_CLASS}>
            {title && <TextLineSkeleton type="h4" className="w-1/2" />}
            {subtitle && <TextLineSkeleton type="h4" className="w-1/3" />}
          </div>
        )}
        {(rows > 0 || progress) && (
          <div className={ROWS_CLASS}>
            {Array.from({ length: rows }, (_, index) => (
              <div key={index} className={VALUE_ROW_CLASS}>
                <TextLineSkeleton type="h4" className="w-20" />
                <div className={DIVIDER_CLASS} />
                <TextLineSkeleton type="h4" className="w-24" />
              </div>
            ))}
            {progress && <ProgressBarSkeleton />}
          </div>
        )}
      </div>
      {footer && (
        <div className={FOOTER_CLASS}>
          <TextLineSkeleton type="h4" className="w-1/2" />
        </div>
      )}
    </div>
  );
}
