'use client';

import { type ComponentType, Fragment, type ReactNode } from 'react';
import { cn } from '../../utils/cn';
import { formatDate } from '../../utils/format';
import {
  formatTokenRate,
  groupTokenRatesByProvider,
  type ModelTokenRate,
  tokenRateProviderLabel,
} from '../../utils/model-token-rates';
import { AnthropicLogoGreyIcon } from '../icons-v2-generated/brand-logos/anthropic-logo-grey-icon';
import { GeminiLogoGreyIcon } from '../icons-v2-generated/brand-logos/gemini-logo-grey-icon';
import { OpenaiLogoGreyIcon } from '../icons-v2-generated/brand-logos/openai-logo-grey-icon';
import { AlertTriangleIcon } from '../icons-v2-generated/interface/alert-triangle-icon';
import { Refresh02VrIcon } from '../icons-v2-generated/media-playback/refresh-02-vr-icon';
import { QuestionCircleIcon } from '../icons-v2-generated/signs-and-symbols/question-circle-icon';
import { XmarkCircleIcon } from '../icons-v2-generated/signs-and-symbols/xmark-circle-icon';
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from '../ui/dropdown-menu';
import { Skeleton } from '../ui/skeleton';

/**
 * The per-model AI token exchange rates, as every surface shows them: the
 * product's billing cards (a popover behind a question mark) and the website's
 * pricing page (the table in the page). ONE table, so a rate reads the same
 * wherever it is stated.
 *
 * The component never fetches. A host reads the rates its own way (the product
 * through its GraphQL API, the website through its server) and hands them in,
 * with `status` saying where that read stands.
 *
 * A rate is the number of OpenFrame tokens one token of the model costs, so it
 * is written as a multiplier ("1.33×"): the caption states the unit once and
 * every figure under it is that unit. Input and output are separate columns,
 * right-aligned in tabular figures so they compare down the column, and the
 * models are grouped under their provider. The rate's type and its formatting
 * are `utils/model-token-rates` (server-safe: a host's server states a rate with
 * the same function).
 */

/** Where the host's read of the rates stands. */
export type ModelTokenRatesStatus = 'loading' | 'error' | 'ready';

/** The wording of the table, stated once. */
export const MODEL_TOKEN_RATES_COPY = {
  trigger: 'Per-model token rates',
  caption: 'OpenFrame tokens used per model token',
  model: 'Model',
  input: 'Input',
  output: 'Output',
  cached: 'Cached input',
  effective: (date: string) => `Rates in effect since ${date}`,
  autoTopUp: { on: 'Auto Top Up Enabled', off: 'Auto Top Up Disabled' },
  unavailable: {
    title: 'Rates unavailable',
    body: "We couldn't load the per-model token rates. They're a reference only: your plan and its price are unaffected.",
  },
  empty: 'No token rates are in effect right now.',
} as const;

/** The provider's mark in its monochrome cut: it takes the row's text colour, so no brand colour competes with the figures. A provider with no mark is shown by name. */
const PROVIDER_ICON: Record<string, ComponentType<{ className?: string }>> = {
  ANTHROPIC: AnthropicLogoGreyIcon,
  OPENAI: OpenaiLogoGreyIcon,
  GOOGLE_GEMINI: GeminiLogoGreyIcon,
};

/** `compact`: the popover (input and output, scrolls past its height). `comfortable`: a page section (adds cached input, as tall as its rows). */
export type ModelTokenRatesDensity = 'compact' | 'comfortable';

export interface ModelTokenRatesProps {
  /** The rates, once read. */
  rates?: readonly ModelTokenRate[];
  /** Where the read stands. Default `ready`. */
  status?: ModelTokenRatesStatus;
  /** When these rates took effect (ISO); stated under the table. */
  effectiveFrom?: string | null;
  /**
   * Whether the balance these rates draw on refills itself: the panel's first
   * line on a billing page. Left out where there is no balance to have that state.
   */
  autoTopUpEnabled?: boolean;
  density?: ModelTokenRatesDensity;
  className?: string;
}

const CELL_X = 'px-[var(--spacing-system-s)]';
const NUMBER_CELL =
  'whitespace-nowrap py-[var(--spacing-system-xxs)] pl-[var(--spacing-system-s)] text-right tabular-nums';

/**
 * The table in its frame. The frame and the auto top-up line stay put while the
 * rates load or fail to: that line is a fact about the subscription, not about
 * the rates.
 */
export function ModelTokenRates({
  rates = [],
  status = 'ready',
  effectiveFrom,
  autoTopUpEnabled,
  density = 'compact',
  className,
}: ModelTokenRatesProps) {
  const compact = density === 'compact';
  return (
    <div
      className={cn(
        'flex flex-col overflow-hidden rounded-[6px] border border-ods-border bg-ods-card',
        compact ? 'max-h-[min(60vh,420px)] min-w-[300px]' : 'w-full',
        className,
      )}
    >
      {autoTopUpEnabled != null && <AutoTopUpLine enabled={autoTopUpEnabled} />}
      {status === 'loading' ? (
        <ModelTokenRatesSkeleton density={density} />
      ) : status === 'error' ? (
        <ModelTokenRatesUnavailable />
      ) : (
        <ModelTokenRatesTable rates={rates} effectiveFrom={effectiveFrom} density={density} />
      )}
    </div>
  );
}

/**
 * The question-mark button that opens the rates, for every card that counts in
 * tokens. One trigger, so two cards cannot open two different panels. The panel
 * is rendered only while open, so a host that reads the rates lazily (`children`)
 * reads them on open.
 */
export function ModelTokenRatesPopover({
  children,
  triggerClassName,
  ...panel
}: ModelTokenRatesProps & {
  /** The panel, when the host renders it itself (a lazy read behind its own boundaries). Default: `ModelTokenRates` with these props. */
  children?: ReactNode;
  triggerClassName?: string;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={MODEL_TOKEN_RATES_COPY.trigger}
          className={cn(
            'shrink-0 text-ods-text-secondary transition-colors hover:text-ods-text-primary',
            triggerClassName,
          )}
        >
          <QuestionCircleIcon className="size-6" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={8} className="border-0 bg-transparent p-0 shadow-none">
        {children ?? <ModelTokenRates {...panel} />}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** On: the success tint, the one band of colour in the panel, so a refilling balance reads at a glance. Off: the panel's own background. */
function AutoTopUpLine({ enabled }: { enabled: boolean }) {
  const Icon = enabled ? Refresh02VrIcon : XmarkCircleIcon;
  return (
    <div
      className={cn(
        'flex shrink-0 items-center gap-[var(--spacing-system-xs)] border-b border-ods-border py-[var(--spacing-system-xs)] text-h4',
        CELL_X,
        enabled ? 'bg-ods-success-secondary text-ods-success' : 'text-ods-text-secondary',
      )}
    >
      <Icon className="size-6 shrink-0" />
      <span className="flex-1">
        {enabled ? MODEL_TOKEN_RATES_COPY.autoTopUp.on : MODEL_TOKEN_RATES_COPY.autoTopUp.off}
      </span>
    </div>
  );
}

function ModelTokenRatesTable({
  rates,
  effectiveFrom,
  density,
}: Required<Pick<ModelTokenRatesProps, 'rates' | 'density'>> & Pick<ModelTokenRatesProps, 'effectiveFrom'>) {
  if (rates.length === 0) {
    return (
      <p className={cn('py-[var(--spacing-system-s)] text-ods-text-secondary text-h6', CELL_X)}>
        {MODEL_TOKEN_RATES_COPY.empty}
      </p>
    );
  }

  const showCached = density === 'comfortable' && rates.some(rate => rate.cacheReadInputTokenRate != null);
  const columns = showCached ? 4 : 3;
  const effectiveDate =
    effectiveFrom && !Number.isNaN(new Date(effectiveFrom).getTime()) ? formatDate(effectiveFrom) : null;

  return (
    <>
      {/* The rows scroll under a pinned header when the list is taller than the panel. */}
      <div className="overflow-y-auto">
        <table className="w-full border-collapse">
          <caption
            className={cn(
              'border-b border-ods-border py-[var(--spacing-system-xs)] text-left text-ods-text-secondary text-h6',
              CELL_X,
            )}
          >
            {MODEL_TOKEN_RATES_COPY.caption}
          </caption>
          <thead className="sticky top-0 bg-ods-card">
            <tr className="uppercase tracking-[-0.02em] text-ods-text-secondary text-h5">
              <th scope="col" className={cn('py-[var(--spacing-system-xs)] text-left font-[inherit]', CELL_X)}>
                {MODEL_TOKEN_RATES_COPY.model}
              </th>
              <th scope="col" className={cn(NUMBER_CELL, 'font-[inherit]')}>
                {MODEL_TOKEN_RATES_COPY.input}
              </th>
              <th
                scope="col"
                className={cn(NUMBER_CELL, 'font-[inherit]', !showCached && 'pr-[var(--spacing-system-s)]')}
              >
                {MODEL_TOKEN_RATES_COPY.output}
              </th>
              {showCached && (
                <th scope="col" className={cn(NUMBER_CELL, 'pr-[var(--spacing-system-s)] font-[inherit]')}>
                  {MODEL_TOKEN_RATES_COPY.cached}
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {groupTokenRatesByProvider(rates).map(group => {
              const label = tokenRateProviderLabel(group.providerType);
              const Icon = PROVIDER_ICON[group.providerType];
              return (
                <Fragment key={group.providerType}>
                  <tr className="border-t border-ods-border">
                    <th
                      scope="colgroup"
                      colSpan={columns}
                      className={cn(
                        'pb-[var(--spacing-system-xxs)] pt-[var(--spacing-system-xs)] text-left font-[inherit] text-ods-text-secondary text-h6',
                        CELL_X,
                      )}
                    >
                      <span className="flex items-center gap-[var(--spacing-system-xs)]">
                        {Icon && <Icon className="size-5 shrink-0" />}
                        {label}
                      </span>
                    </th>
                  </tr>
                  {group.rates.map(rate => (
                    <tr key={rate.modelName} className="text-ods-text-primary text-h6">
                      <th scope="row" className={cn('py-[var(--spacing-system-xxs)] text-left font-[inherit]', CELL_X)}>
                        {rate.displayName || rate.modelName}
                      </th>
                      <td className={NUMBER_CELL}>{formatTokenRate(rate.inputTokenRate)}</td>
                      <td className={cn(NUMBER_CELL, !showCached && 'pr-[var(--spacing-system-s)]')}>
                        {formatTokenRate(rate.outputTokenRate)}
                      </td>
                      {showCached && (
                        <td className={cn(NUMBER_CELL, 'pr-[var(--spacing-system-s)] text-ods-text-secondary')}>
                          {formatTokenRate(rate.cacheReadInputTokenRate)}
                        </td>
                      )}
                    </tr>
                  ))}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
      {effectiveDate && (
        <p
          className={cn(
            'shrink-0 border-t border-ods-border py-[var(--spacing-system-xs)] text-ods-text-secondary text-h6',
            CELL_X,
          )}
        >
          {MODEL_TOKEN_RATES_COPY.effective(effectiveDate)}
        </p>
      )}
    </>
  );
}

/** Same panel, same frame: only the rows are replaced by why they are missing. Opened on a deliberate click, so it never renders empty. */
export function ModelTokenRatesUnavailable() {
  return (
    <div
      role="alert"
      className="flex flex-col items-center gap-[var(--spacing-system-xs)] p-[var(--spacing-system-mf)] text-center"
    >
      <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-ods-bg text-ods-text-secondary">
        <AlertTriangleIcon className="size-5" />
      </div>
      <p className="text-ods-text-primary text-h3">{MODEL_TOKEN_RATES_COPY.unavailable.title}</p>
      <p className="max-w-[320px] text-ods-text-secondary text-h6">{MODEL_TOKEN_RATES_COPY.unavailable.body}</p>
    </div>
  );
}

const SKELETON_ROWS = ['r1', 'r2', 'r3', 'r4', 'r5', 'r6', 'r7', 'r8'] as const;

/** The table's loading footprint: the caption, the header and rows of the boxes the loaded rows use. */
export function ModelTokenRatesSkeleton({ density = 'compact' }: { density?: ModelTokenRatesDensity }) {
  return (
    <div aria-busy="true">
      <div className={cn('border-b border-ods-border py-[var(--spacing-system-xs)]', CELL_X)}>
        <Skeleton className="h-4 w-56" />
      </div>
      <div className={cn('flex items-center gap-[var(--spacing-system-s)] py-[var(--spacing-system-xs)]', CELL_X)}>
        <Skeleton className="h-4 w-12" />
        <div className="flex-1" />
        <Skeleton className="h-4 w-10" />
        <Skeleton className="h-4 w-10" />
        {density === 'comfortable' && <Skeleton className="h-4 w-16" />}
      </div>
      {SKELETON_ROWS.map(key => (
        <div
          key={key}
          className={cn('flex items-center gap-[var(--spacing-system-s)] py-[var(--spacing-system-xxs)]', CELL_X)}
        >
          <Skeleton className="h-4 w-40" />
          <div className="flex-1" />
          <Skeleton className="h-4 w-10" />
          <Skeleton className="h-4 w-10" />
          {density === 'comfortable' && <Skeleton className="h-4 w-16" />}
        </div>
      ))}
    </div>
  );
}
