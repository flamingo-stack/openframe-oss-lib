'use client';

import { ExternalLink } from 'lucide-react';
import type React from 'react';
import { useMemo, useState } from 'react';
import { useIsTruncated } from '../../hooks/ui/use-is-truncated';
import { useCopyToClipboard } from '../../hooks/use-copy-to-clipboard';
import { cn } from '../../utils/cn';
import { EyeIcon, OpenFrameLogo } from '../icons';
import { Copy01Icon } from '../icons-v2-generated/documents';
import { CheckIcon } from '../icons-v2-generated/signs-and-symbols';
import { FloatingTooltip } from './floating-tooltip';
import { TruncateText } from './truncate-text';

export type ServiceCardRowAction = {
  copy?: boolean;
  open?: boolean;
  reveal?: boolean;
};

export type ServiceCardRow = {
  label?: string;
  value: string;
  href?: string;
  copyValue?: string;
  isSecret?: boolean;
  monospace?: boolean;
  actions?: ServiceCardRowAction;
};

export type ServiceCardTag = {
  label: string;
};

export interface ServiceCardProps {
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  tag?: ServiceCardTag;
  rows: ServiceCardRow[];
  className?: string;
}

function MaskedValue({ value, isRevealed }: { value: string; isRevealed: boolean }) {
  if (isRevealed) return <span>{value}</span>;
  return <span>{'•'.repeat(Math.min(value.length, 12))}</span>;
}

export function ServiceCard({ title, subtitle, icon, tag, rows, className }: ServiceCardProps) {
  const resolvedIcon = icon ?? (
    <OpenFrameLogo
      className="h-10 w-10"
      lowerPathColor={'var(--color-accent-primary)'}
      upperPathColor={'var(--color-text-primary)'}
    />
  );

  return (
    <div className={cn('rounded-lg border border-ods-border bg-ods-card p-6', className)}>
      {/* Header */}
      <div className="mb-4 flex items-start justify-between gap-4">
        <div className="flex min-w-0 items-center gap-4">
          <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-md border border-ods-border bg-ods-bg">
            {resolvedIcon}
          </div>
          <div className="min-w-0">
            <TruncateText variant="h3">{title}</TruncateText>
            {subtitle && (
              <TruncateText variant="h6" tone="secondary">
                {subtitle}
              </TruncateText>
            )}
          </div>
        </div>
        {tag && (
          <div className="self-start whitespace-nowrap rounded-full border border-ods-border bg-ods-bg px-3 py-1 font-semibold text-ods-text-primary text-h6">
            {tag.label}
          </div>
        )}
      </div>

      {/* Rows */}
      <div className="space-y-3">
        {rows.map((row, idx) => (
          <ServiceCardRowItem key={idx} row={row} />
        ))}
      </div>
    </div>
  );
}

function ServiceCardRowItem({ row }: { row: ServiceCardRow }) {
  const [revealed, setRevealed] = useState(false);
  const { copy, copied } = useCopyToClipboard();
  const { ref: valueRef, isTruncated: valueTruncated } = useIsTruncated<HTMLDivElement>(row.value);
  const actions = useMemo<ServiceCardRowAction>(
    () => ({ copy: true, open: !!row.href, reveal: !!row.isSecret, ...row.actions }),
    [row],
  );

  const displayValue = row.isSecret ? (
    <MaskedValue value={row.value} isRevealed={revealed} />
  ) : (
    <span>{row.value}</span>
  );

  const handleCopy = () => copy(row.copyValue ?? row.value);

  const openInNewTab = () => {
    if (!row.href) return;
    window.open(row.href, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="flex min-w-0 items-center gap-3">
      {row.label && <div className="w-20 shrink-0 text-ods-text-primary text-h6 md:w-24">{row.label}</div>}
      <div
        className={cn(
          'flex h-12 min-w-0 flex-1 items-center justify-between rounded-md border border-ods-border bg-ods-bg px-3 md:px-4',
          row.monospace ? 'font-mono' : '',
        )}
      >
        {/* No tooltip while a secret is masked — the old native `title` leaked the raw value on hover. */}
        <FloatingTooltip
          content={row.value}
          side="top"
          disabled={!valueTruncated || (row.isSecret && !revealed)}
          triggerClassName="min-w-0"
          className="max-w-xs [overflow-wrap:anywhere]"
        >
          <div ref={valueRef} className="truncate text-ods-text-primary">
            {displayValue}
          </div>
        </FloatingTooltip>
        <div className="flex flex-shrink-0 items-center gap-2 pl-3">
          {actions.reveal && (
            <button
              onClick={() => setRevealed(v => !v)}
              className="rounded p-2 text-ods-text-secondary hover:bg-ods-card"
              aria-label={revealed ? 'Hide' : 'Reveal'}
            >
              <EyeIcon className="h-5 w-5" off={revealed} />
            </button>
          )}

          {actions.copy && (
            <button
              onClick={handleCopy}
              className={cn(
                'rounded p-2 transition-colors hover:bg-ods-card',
                copied ? 'text-ods-success' : 'text-ods-text-secondary',
              )}
              aria-label={`Copy ${row.label ?? 'value'}`}
            >
              {copied ? <CheckIcon size={20} /> : <Copy01Icon size={20} />}
            </button>
          )}

          {actions.open && row.href && (
            <button
              onClick={openInNewTab}
              className="rounded p-2 text-ods-text-secondary hover:bg-ods-card"
              aria-label={`Open ${row.label ?? 'link'}`}
            >
              <ExternalLink className="h-5 w-5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
