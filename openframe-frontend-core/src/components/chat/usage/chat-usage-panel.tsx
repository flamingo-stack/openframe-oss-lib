'use client';

import type { ReactNode } from 'react';
import { cn } from '../../../utils/cn';
import { TextLineSkeleton } from '../../loading/unified-skeleton';
import { ProgressBar } from '../../ui/progress-bar';
import {
  type ChatUsagePanelData,
  type ChatUsageTone,
  chatContextTone,
  compactionThresholdOf,
  contextRatio,
  formatTokensFull,
  formatTokensShort,
  formatUsd,
} from './chat-usage';

/** The fill colour of each tone. The accent is Mingo's cyan: the panel sets `data-accent="mingo"`. */
export const CHAT_USAGE_TONE_COLOR: Record<ChatUsageTone, string> = {
  default: 'var(--color-accent-primary)',
  warning: 'var(--color-warning)',
  error: 'var(--color-error)',
};

const TONE_ROW_CLASS: Record<ChatUsageTone, string> = {
  default: 'text-ods-text-primary',
  warning: 'bg-ods-warning-secondary text-ods-warning',
  error: 'bg-ods-error-secondary text-ods-error',
};

/** The design's bar: 5px segments at a 7px pitch, 8px tall, at every width. */
const BAR_PROPS = { height: 8, mobileHeight: 8, segmentWidth: 5, mobileSegmentWidth: 5, segmentGap: 2 } as const;

const UNKNOWN = '—';

function Section({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        'flex flex-col gap-[var(--spacing-system-xsf)] px-[var(--spacing-system-sf)] py-[var(--spacing-system-sf)]',
        className,
      )}
    >
      {children}
    </div>
  );
}

function LabelRow({ label, value, loading }: { label: string; value: string; loading?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-[var(--spacing-system-xsf)] text-h6">
      <span>{label}</span>
      {loading ? <TextLineSkeleton type="h6" className="w-20" /> : <span className="tabular-nums">{value}</span>}
    </div>
  );
}

function BreakdownRow({ label, value }: { label: string; value: number | null }) {
  return (
    <div className="flex items-center justify-between gap-[var(--spacing-system-xsf)] text-ods-text-secondary text-h6">
      <span>{label}</span>
      <span className="tabular-nums">{value == null ? UNKNOWN : formatTokensFull(value)}</span>
    </div>
  );
}

/**
 * The chat's Usage panel (Figma open-design-system `chat/usage-panel`): the company's free tokens and prepaid balance,
 * this chat's context with the zone where its memory is compacted, and the last reply's tokens by kind. Read-only.
 */
export function ChatUsagePanel({ data, className }: { data: ChatUsagePanelData; className?: string }) {
  const { free, balance, companyLoading, context, breakdown } = data;
  const compactAt = compactionThresholdOf(context.compactionThreshold);
  const ratio = contextRatio(context.used, context.limit);
  const contextTone = chatContextTone(context.used, context.limit, context.compactionThreshold);
  const freeProgress = free && free.total > 0 ? (free.used / free.total) * 100 : 0;

  return (
    <div
      role="group"
      aria-label="Usage"
      data-accent="mingo"
      className={cn('flex flex-col divide-y divide-ods-border text-ods-text-primary', className)}
    >
      <Section>
        <LabelRow
          label="Free AI Tokens"
          value={free ? `${formatTokensShort(free.used)} / ${formatTokensShort(free.total)}` : UNKNOWN}
          loading={companyLoading}
        />
        <ProgressBar
          {...BAR_PROPS}
          progress={freeProgress}
          fillColor={CHAT_USAGE_TONE_COLOR.default}
          loading={companyLoading}
        />
      </Section>

      <Section className={TONE_ROW_CLASS[balance?.tone ?? 'default']}>
        <LabelRow
          label="Current AI Balance"
          value={balance ? `${formatTokensShort(balance.tokens)} (${formatUsd(balance.usd)})` : UNKNOWN}
          loading={companyLoading}
        />
      </Section>

      <Section>
        <LabelRow
          label="Chat Context"
          value={`${context.used == null ? UNKNOWN : formatTokensFull(context.used)} / ${
            context.limit == null || context.limit <= 0 ? UNKNOWN : formatTokensFull(context.limit)
          }`}
        />
        <ProgressBar
          {...BAR_PROPS}
          progress={ratio == null ? 0 : ratio * 100}
          fillColor={CHAT_USAGE_TONE_COLOR[contextTone]}
          trackColor="var(--color-accent-secondary)"
          dimTrackFrom={compactAt * 100}
        />
        <span className="text-ods-text-secondary text-h6">
          Mingo compacts chat memory at {Math.round(compactAt * 100)}%
        </span>
        <div className="flex flex-col pt-[var(--spacing-system-xxs)]">
          <BreakdownRow label="Input" value={breakdown?.input ?? null} />
          <BreakdownRow label="Cache Read" value={breakdown?.cacheRead ?? null} />
          <BreakdownRow label="Cache Write" value={breakdown?.cacheWrite ?? null} />
          <BreakdownRow label="Output" value={breakdown?.output ?? null} />
        </div>
      </Section>
    </div>
  );
}
