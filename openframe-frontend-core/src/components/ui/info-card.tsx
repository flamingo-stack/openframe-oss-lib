'use client';

import React from 'react';
import { useCopyToClipboard } from '../../hooks';
import { cn } from '../../utils/cn';
import { CheckIcon } from '../icons-v2-generated';
import { Copy01Icon } from '../icons-v2-generated/documents';
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
}

export function InfoCard({ data, className = '' }: InfoCardProps) {
  return (
    <div
      className={cn('flex w-full flex-col overflow-hidden rounded-md border border-ods-border bg-ods-card', className)}
    >
      {/* Header (title + subtitle) and body (rows + progress) are two groups separated by
          `gap-l`; the title/subtitle stack tightly and the rows use `gap-xs` — matching the ODS
          "Info-card" design. With no title/subtitle, the body is the only group. */}
      <div className="flex w-full flex-col items-start gap-[var(--spacing-system-l)] p-[var(--spacing-system-m)]">
        {(data.title || data.subtitle) && (
          <div className="flex w-full flex-col items-start self-stretch">
            {data.title && (
              <div className="flex items-center gap-[var(--spacing-system-xsf)] self-stretch">
                <span className="min-w-0 truncate text-ods-text-primary text-h4" title={data.title}>
                  {data.title}
                </span>
                {data.icon}
              </div>
            )}
            {data.subtitle && (
              <div className="flex items-center gap-[var(--spacing-system-xsf)] self-stretch">
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
          <div className="flex w-full flex-col items-start gap-[var(--spacing-system-xs)] self-stretch">
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
    <div className="mt-auto flex w-full flex-col border-t border-ods-border p-[var(--spacing-system-m)]">
      <div className="flex w-full items-center justify-between gap-1">
        <div className="flex items-center gap-1">
          {footer.icon}
          <span className="text-ods-text-primary text-h4">{footer.text}</span>
        </div>
        {footer.logo}
      </div>
      {footer.link && (
        <a
          href={footer.link.href}
          target="_blank"
          rel="noopener noreferrer"
          className="truncate text-ods-text-secondary underline text-h6 hover:text-ods-text-primary"
        >
          {footer.link.label ?? footer.link.href.replace(/^https?:\/\//, '')}
        </a>
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
    <div className="flex h-6 w-full items-center gap-[var(--spacing-system-xs)] self-stretch">
      <span className="whitespace-nowrap text-ods-text-primary text-h4">{showLabel ? label : ''}</span>
      <div className="h-px flex-1 bg-ods-divider" />
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
