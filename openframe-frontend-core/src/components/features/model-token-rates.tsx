'use client';

import { type ComponentType, type ReactNode, useState } from 'react';
import { cn } from '../../utils/cn';
import { formatDate } from '../../utils/format';
import {
  formatTokenPrice,
  formatTokenRate,
  groupTokenRatesByProvider,
  type ModelTokenRate,
  type TokenPrice,
  tokenRatePrice,
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
import { FadePreview } from '../ui/fade-preview';
import { Skeleton } from '../ui/skeleton';
import { TabSelector } from '../ui/tab-selector';

/**
 * The per-model AI token exchange rates, as every surface shows them: the
 * product's billing cards (a popover behind a question mark) and the website's
 * pricing page (in the page). ONE table, so a rate reads the same wherever it
 * is stated.
 *
 * The component never fetches. A host reads the rates its own way (the product
 * through its GraphQL API, the website through its server) and hands them in,
 * with `status` saying where that read stands.
 *
 * It is SMALL by construction: one provider at a time (the lib's `TabSelector`),
 * and on a page only the first rows, the rest behind "Show N more" (the lib's
 * `FadePreview`), so thirty models take the room of five.
 *
 * A rate is the number of OpenFrame tokens one token of the model costs, written
 * as a multiplier ("1.33×"); given `tokenPrice`, each figure is instead what a
 * million of the model's tokens cost in USD, the unit every provider quotes.
 * Either way the unit is stated once, under the figures, which sit right-aligned
 * in tabular figures so they compare down the column. The rate's type and its
 * formatting are `utils/model-token-rates` (server-safe: a host's server states
 * a rate with the same function).
 */

/** Where the host's read of the rates stands. */
export type ModelTokenRatesStatus = 'loading' | 'error' | 'ready';

/** The wording of the table, stated once. */
export const MODEL_TOKEN_RATES_COPY = {
  trigger: 'Per-model token rates',
  unit: { rate: 'OpenFrame tokens used per model token', price: 'USD per 1M model tokens' },
  providers: 'Provider',
  model: 'Model',
  input: 'Input',
  output: 'Output',
  cached: 'Cached',
  more: (count: number) => `Show ${count} more ${count === 1 ? 'model' : 'models'}`,
  less: 'Show fewer models',
  effective: (date: string) => `In effect since ${date}`,
  autoTopUp: { on: 'Auto Top Up Enabled', off: 'Auto Top Up Disabled' },
  unavailable: {
    title: 'Rates unavailable',
    body: "We couldn't load the per-model token rates. They're a reference only: your plan and its price are unaffected.",
  },
  empty: 'No token rates are in effect right now.',
} as const;

/** The provider's mark in its monochrome cut: it takes the text colour, so no brand colour competes with the figures. A provider with no mark is shown by name. */
const PROVIDER_ICON: Record<string, ComponentType<{ className?: string }>> = {
  ANTHROPIC: AnthropicLogoGreyIcon,
  OPENAI: OpenaiLogoGreyIcon,
  GOOGLE_GEMINI: GeminiLogoGreyIcon,
};

/** `compact`: the popover (input and output, scrolls past its height). `comfortable`: in a page (adds cached input, shows the first rows). */
export type ModelTokenRatesDensity = 'compact' | 'comfortable';

/** How many models a page shows before "Show N more". */
export const MODEL_TOKEN_RATES_VISIBLE_ROWS = 5;

export interface ModelTokenRatesProps {
  /** The rates, once read. */
  rates?: readonly ModelTokenRate[];
  /** Where the read stands. Default `ready`. */
  status?: ModelTokenRatesStatus;
  /** What OpenFrame tokens cost. Given: every figure is USD per 1M of the model's tokens, not a multiplier. */
  tokenPrice?: TokenPrice | null;
  /** When these rates took effect (ISO); stated under the table. */
  effectiveFrom?: string | null;
  /**
   * Whether the balance these rates draw on refills itself: the panel's first
   * line on a billing page. Left out where there is no balance to have that state.
   */
  autoTopUpEnabled?: boolean;
  density?: ModelTokenRatesDensity;
  /** `comfortable` only: the models shown before "Show N more". Default `MODEL_TOKEN_RATES_VISIBLE_ROWS`. */
  visibleRows?: number;
  className?: string;
}

const PAD_X = 'px-[var(--spacing-system-s)]';
const ROW = 'flex items-center gap-[var(--spacing-system-s)]';
/** Fixed widths, so the figures of separate rows line up as columns. */
const NUMBER_CELL = 'w-14 shrink-0 whitespace-nowrap text-right tabular-nums sm:w-16';
/** From the `sm` width up: on a phone the model's name needs the room more than a third figure does. */
const CACHED_CELL = 'hidden w-20 shrink-0 whitespace-nowrap text-right tabular-nums sm:block';

/**
 * The table in its frame. The frame and the auto top-up line stay put while the
 * rates load or fail to: that line is a fact about the subscription, not about
 * the rates.
 */
export function ModelTokenRates({
  rates = [],
  status = 'ready',
  tokenPrice,
  effectiveFrom,
  autoTopUpEnabled,
  density = 'compact',
  visibleRows = MODEL_TOKEN_RATES_VISIBLE_ROWS,
  className,
}: ModelTokenRatesProps) {
  return (
    <div
      className={cn(
        'flex flex-col overflow-hidden rounded-[6px] border border-ods-border bg-ods-card',
        density === 'compact' ? 'max-h-[min(60vh,420px)] w-[340px] max-w-[calc(100vw-2rem)]' : 'w-full',
        className,
      )}
    >
      {autoTopUpEnabled != null && <AutoTopUpLine enabled={autoTopUpEnabled} />}
      {status === 'loading' ? (
        <ModelTokenRatesSkeleton density={density} rows={visibleRows} />
      ) : status === 'error' ? (
        <ModelTokenRatesUnavailable />
      ) : (
        <ModelTokenRatesTable
          rates={rates}
          tokenPrice={tokenPrice}
          effectiveFrom={effectiveFrom}
          density={density}
          visibleRows={visibleRows}
        />
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
        PAD_X,
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
  tokenPrice,
  effectiveFrom,
  density,
  visibleRows,
}: Required<Pick<ModelTokenRatesProps, 'rates' | 'density' | 'visibleRows'>> &
  Pick<ModelTokenRatesProps, 'effectiveFrom' | 'tokenPrice'>) {
  const groups = groupTokenRatesByProvider(rates);
  const [picked, setPicked] = useState<string | null>(null);
  // The provider picked, while the rates still hold it; else the first one.
  const group = groups.find(candidate => candidate.providerType === picked) ?? groups[0];

  if (!group) {
    return (
      <p className={cn('py-[var(--spacing-system-s)] text-ods-text-secondary text-h6', PAD_X)}>
        {MODEL_TOKEN_RATES_COPY.empty}
      </p>
    );
  }

  const compact = density === 'compact';
  const showCached = !compact && rates.some(rate => rate.cacheReadInputTokenRate != null);
  const priced = tokenRatePrice(1, tokenPrice) !== null;
  const figure = (rate: number | null | undefined) =>
    priced ? formatTokenPrice(tokenRatePrice(rate, tokenPrice)) : formatTokenRate(rate);
  const unit = priced ? MODEL_TOKEN_RATES_COPY.unit.price : MODEL_TOKEN_RATES_COPY.unit.rate;
  const effectiveDate =
    effectiveFrom && !Number.isNaN(new Date(effectiveFrom).getTime()) ? formatDate(effectiveFrom) : null;

  const rows = (
    <div role="rowgroup">
      {group.rates.map(rate => (
        <div
          key={rate.modelName}
          role="row"
          className={cn(ROW, PAD_X, 'py-[var(--spacing-system-xxs)] text-ods-text-primary text-h6')}
        >
          <span role="rowheader" className="min-w-0 flex-1 truncate">
            {rate.displayName || rate.modelName}
          </span>
          <span role="cell" className={NUMBER_CELL}>
            {figure(rate.inputTokenRate)}
          </span>
          <span role="cell" className={NUMBER_CELL}>
            {figure(rate.outputTokenRate)}
          </span>
          {showCached && (
            <span role="cell" className={cn(CACHED_CELL, 'text-ods-text-secondary')}>
              {figure(rate.cacheReadInputTokenRate)}
            </span>
          )}
        </div>
      ))}
    </div>
  );

  return (
    <>
      {groups.length > 1 && (
        <TabSelector
          variant="secondary"
          // Tabs keep their own width and the row scrolls, so a fourth provider never squeezes the names.
          scrollable
          value={group.providerType}
          onValueChange={setPicked}
          items={groups.map(candidate => {
            const Icon = PROVIDER_ICON[candidate.providerType];
            return {
              id: candidate.providerType,
              label: tokenRateProviderLabel(candidate.providerType),
              icon: Icon ? <Icon className="size-full" /> : undefined,
            };
          })}
          className={cn('shrink-0 border-b border-ods-border py-[var(--spacing-system-xs)]', PAD_X)}
        />
      )}
      <div role="table" aria-label={unit} className="flex min-h-0 flex-col">
        <div
          role="row"
          className={cn(
            ROW,
            PAD_X,
            'shrink-0 py-[var(--spacing-system-xs)] uppercase tracking-[-0.02em] text-ods-text-secondary text-h5',
          )}
        >
          <span role="columnheader" className="min-w-0 flex-1 truncate">
            {MODEL_TOKEN_RATES_COPY.model}
          </span>
          <span role="columnheader" className={NUMBER_CELL}>
            {MODEL_TOKEN_RATES_COPY.input}
          </span>
          <span role="columnheader" className={NUMBER_CELL}>
            {MODEL_TOKEN_RATES_COPY.output}
          </span>
          {showCached && (
            <span role="columnheader" className={CACHED_CELL}>
              {MODEL_TOKEN_RATES_COPY.cached}
            </span>
          )}
        </div>
        {compact ? (
          // The popover: every model of the provider, scrolling under the pinned header.
          <div className="min-h-0 overflow-y-auto pb-[var(--spacing-system-xxs)]">{rows}</div>
        ) : (
          // A page: the first models, the rest behind the toggle. Reset when the provider changes.
          <FadePreview
            visibleItems={visibleRows}
            resetKey={group.providerType}
            labels={{
              more: MODEL_TOKEN_RATES_COPY.more(Math.max(0, group.rates.length - visibleRows)),
              less: MODEL_TOKEN_RATES_COPY.less,
            }}
            toggleClassName={PAD_X}
          >
            {rows}
          </FadePreview>
        )}
      </div>
      {/* The unit, stated once, where it has room to wrap; then when the rates took effect. */}
      <p
        className={cn(
          'shrink-0 border-t border-ods-border py-[var(--spacing-system-xs)] text-ods-text-secondary text-h6',
          PAD_X,
        )}
      >
        {unit}
        {effectiveDate && `. ${MODEL_TOKEN_RATES_COPY.effective(effectiveDate)}.`}
      </p>
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

/** The table's loading footprint: the provider tabs, the header and as many rows as the loaded table shows. */
export function ModelTokenRatesSkeleton({
  density = 'compact',
  rows = MODEL_TOKEN_RATES_VISIBLE_ROWS,
}: {
  density?: ModelTokenRatesDensity;
  rows?: number;
}) {
  const cells = (
    <>
      <div className="flex-1" />
      <Skeleton className="h-4 w-12" />
      <Skeleton className="h-4 w-12" />
      {density === 'comfortable' && <Skeleton className="hidden h-4 w-16 sm:block" />}
    </>
  );
  return (
    <div aria-busy="true">
      <div className={cn('border-b border-ods-border py-[var(--spacing-system-xs)]', PAD_X)}>
        <Skeleton className="h-11 w-full content-md:h-12" />
      </div>
      <div className={cn(ROW, PAD_X, 'py-[var(--spacing-system-xs)]')}>
        <Skeleton className="h-4 w-48" />
        {cells}
      </div>
      {Array.from({ length: rows }, (_, index) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: identical placeholder rows
        <div key={index} className={cn(ROW, PAD_X, 'py-[var(--spacing-system-xxs)]')}>
          <Skeleton className="h-4 w-36" />
          {cells}
        </div>
      ))}
    </div>
  );
}
