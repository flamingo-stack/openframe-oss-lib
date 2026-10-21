'use client';

import { ExternalLink } from 'lucide-react';
import type React from 'react';
import { useMemo, useState } from 'react';
import { useIsTruncated } from '../../hooks/ui/use-is-truncated';
import { useCopyToClipboard } from '../../hooks/use-copy-to-clipboard';
import { cn } from '../../utils/cn';
import { Copy01Icon } from '../icons-v2-generated/documents';
import { EyeClassicIcon } from '../icons-v2-generated/interface/eye-classic-icon';
import { EyeOffClassicIcon } from '../icons-v2-generated/interface/eye-off-classic-icon';
import { OpenframeLogoIcon } from '../icons-v2-generated/logos/openframe-logo-icon';
import { CheckIcon } from '../icons-v2-generated/signs-and-symbols';
import { TextLineSkeleton } from '../loading/unified-skeleton';
import { FloatingTooltip } from './floating-tooltip';
import { useLoadingScope } from './loading-scope';
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
  /**
   * The values are still being read: the frame, icon, title, subtitle, tag and each row's label are drawn for real
   * (an empty title is a bar), and each row's value is a bar in the row's own value box, without its actions. A
   * loading scope does the same.
   */
  loading?: boolean;
  className?: string;
}

/** A row's label column and its value box, read by the row and its skeleton (the same box). */
const SERVICE_CARD_ROW_CLASS = 'flex min-w-0 items-center gap-3';
const SERVICE_CARD_ROW_LABEL_CLASS = 'w-20 shrink-0 text-ods-text-primary text-h6 content-md:w-24';
const SERVICE_CARD_VALUE_BOX_CLASS =
  'flex h-12 min-w-0 flex-1 items-center justify-between rounded-md border border-ods-border bg-ods-bg px-3 content-md:px-4';
/** The header's tag pill, loaded and loading. */
const SERVICE_CARD_TAG_CLASS =
  'self-start whitespace-nowrap rounded-full border border-ods-border bg-ods-bg px-3 py-1 font-semibold text-ods-text-primary text-h6';
/** The value box's actions (reveal, copy, open), loaded and loading. */
const SERVICE_CARD_ACTIONS_CLASS = 'flex flex-shrink-0 items-center gap-2 pl-3';
const SERVICE_CARD_ACTION_CLASS = 'rounded p-2 text-ods-text-secondary';

/** A row's actions: copy by default, open with a link, reveal for a secret, then what the row states. */
function rowActions(row: ServiceCardRow): ServiceCardRowAction {
  return { copy: true, open: !!row.href, reveal: !!row.isSecret, ...row.actions };
}

function MaskedValue({ value, isRevealed }: { value: string; isRevealed: boolean }) {
  if (isRevealed) return <span>{value}</span>;
  return <span>{'•'.repeat(Math.min(value.length, 12))}</span>;
}

export function ServiceCard({ title, subtitle, icon, tag, rows, loading: loadingProp, className }: ServiceCardProps) {
  // ONE switch: in a page's loading state (or while the host reads the values) every value is a bar.
  const loading = useLoadingScope() || !!loadingProp;
  const resolvedIcon = icon ?? (
    <OpenframeLogoIcon
      secondaryColor="var(--color-accent-primary)"
      className="h-10 w-10"
      color={'var(--color-text-primary)'}
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
            {loading && !title ? (
              <TextLineSkeleton type="h3" className="w-40 max-w-full" />
            ) : (
              <TruncateText variant="h3">{title}</TruncateText>
            )}
            {loading && subtitle === '' ? (
              <TextLineSkeleton type="h6" className="w-56 max-w-full" />
            ) : (
              subtitle && (
                <TruncateText variant="h6" tone="secondary">
                  {subtitle}
                </TruncateText>
              )
            )}
          </div>
        </div>
        {tag && (
          // The tag is read with the values: the pill's own box, its label a bar while loading.
          <div className={SERVICE_CARD_TAG_CLASS}>
            {loading ? <TextLineSkeleton type="inherit" className="w-12" /> : tag.label}
          </div>
        )}
      </div>

      {/* Rows */}
      <div className="space-y-3">
        {rows.map((row, idx) => (
          <ServiceCardRowItem key={idx} row={row} loading={loading} />
        ))}
      </div>
    </div>
  );
}

/**
 * One row, loaded and loading. The label column is drawn when the row has a label (`''` is a label still being read:
 * a bar in the column); the value is a bar in the value box (in the row's own face) while it is read; the actions are
 * the row's own, drawn for real, disabled while the value is read.
 */
function ServiceCardRowItem({ row, loading: loadingProp }: { row: ServiceCardRow; loading: boolean }) {
  const loading = useLoadingScope() || loadingProp;
  const [revealed, setRevealed] = useState(false);
  const { copy, copied } = useCopyToClipboard();
  const { ref: valueRef, isTruncated: valueTruncated } = useIsTruncated<HTMLDivElement>(row.value);
  const actions = useMemo<ServiceCardRowAction>(() => rowActions(row), [row]);

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

  // A label column only where the loaded row has one; while loading, a label not here yet is a bar in it.
  const labelColumn = loading ? row.label !== undefined : !!row.label;

  return (
    <div className={SERVICE_CARD_ROW_CLASS}>
      {labelColumn && (
        <div className={SERVICE_CARD_ROW_LABEL_CLASS}>
          {row.label || <TextLineSkeleton type="inherit" className="w-full" />}
        </div>
      )}
      <div className={cn(SERVICE_CARD_VALUE_BOX_CLASS, row.monospace ? 'font-mono' : '')}>
        {loading ? (
          <TextLineSkeleton type="inherit" className="w-40 max-w-full" />
        ) : (
          // No tooltip while a secret is masked — the old native `title` leaked the raw value on hover.
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
        )}
        <div className={SERVICE_CARD_ACTIONS_CLASS}>
          {actions.reveal && (
            <button
              type="button"
              disabled={loading}
              tabIndex={loading ? -1 : undefined}
              onClick={() => setRevealed(v => !v)}
              className={cn(SERVICE_CARD_ACTION_CLASS, !loading && 'hover:bg-ods-card')}
              aria-label={revealed ? 'Hide' : 'Reveal'}
            >
              {revealed ? <EyeOffClassicIcon className="h-5 w-5" /> : <EyeClassicIcon className="h-5 w-5" />}
            </button>
          )}

          {actions.copy && (
            <button
              type="button"
              disabled={loading}
              tabIndex={loading ? -1 : undefined}
              onClick={handleCopy}
              className={cn(
                'rounded p-2 transition-colors',
                !loading && 'hover:bg-ods-card',
                copied ? 'text-ods-success' : 'text-ods-text-secondary',
              )}
              aria-label={`Copy ${row.label || 'value'}`}
            >
              {copied ? <CheckIcon size={20} /> : <Copy01Icon size={20} />}
            </button>
          )}

          {actions.open && row.href && (
            <button
              type="button"
              disabled={loading}
              tabIndex={loading ? -1 : undefined}
              onClick={openInNewTab}
              className={cn(SERVICE_CARD_ACTION_CLASS, !loading && 'hover:bg-ods-card')}
              aria-label={`Open ${row.label || 'link'}`}
            >
              <ExternalLink className="h-5 w-5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
