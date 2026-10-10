'use client';

import { type ComponentType, type ReactNode, useState } from 'react';
import { cn } from '../../utils/cn';
import {
  formatTokenPrice,
  formatTokenRate,
  groupTokenRatesByProvider,
  type ModelTokenRate,
  paginateTokenRates,
  type TokenRatePage,
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
import { Skeleton } from '../ui/skeleton';
import { SnapCarousel, SnapCarouselControlsSkeleton } from '../ui/snap-carousel';
import { TabSelector } from '../ui/tab-selector';

/**
 * The per-model AI token exchange rates, in the two places they are shown:
 *
 * - `ModelTokenRates` (+ `ModelTokenRatesPopover`): a small table behind a
 *   question mark, for the product's cards that count in tokens.
 * - `ModelTokenRatePages`: the full table a page at a time, on the lib's
 *   `SnapCarousel`, for a page (the website's pricing page).
 *
 * Both are TABLES: the data is models by rates, and a table is what lets two
 * models be compared down a column. Both state a rate with the same functions
 * (`utils/model-token-rates`, server-safe), so a rate reads the same wherever
 * it is stated. Neither fetches: a host reads the rates its own way and hands
 * them in, with `status` saying where that read stands. Each holds ONE height
 * loading, loaded, failed or empty.
 *
 * A rate is the number of OpenFrame tokens ONE token of the model uses. Given
 * what OpenFrame tokens cost (`tokenPrice`), the paged table states each model
 * the way every provider's price list does: USD per million tokens, for input,
 * cached input and output, with the rate beside it.
 */

/** Where the host's read of the rates stands. */
export type ModelTokenRatesStatus = 'loading' | 'error' | 'ready';

/** The wording of both views, stated once. */
export const MODEL_TOKEN_RATES_COPY = {
  trigger: 'Per-model token rates',
  unit: 'OpenFrame tokens used per model token',
  carousel: 'AI model token rates',
  model: 'Model',
  input: 'Input',
  output: 'Output',
  cached: 'Cached input',
  /** The same column where there is no room for two words. */
  cachedShort: 'Cached',
  /** "1 of 2", after a provider whose models take more than one page. */
  pageOf: (page: number, pages: number) => `${page} of ${pages}`,
  /** The paged table's unit, in its title bar. */
  priceUnit: 'USD per 1M tokens',
  /** The column that ties a price back to what the balance is counted in: "1.33× in · 6.67× out". */
  rate: 'Token rate',
  rateOf: (input: string, output: string) => `${input} in \u00b7 ${output} out`,
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

const PAD_X = 'px-[var(--spacing-system-s)]';
const ROW = 'flex items-center gap-[var(--spacing-system-s)]';
/** Fixed width, so the figures of separate rows line up as columns. */
const NUMBER_CELL = 'w-16 shrink-0 whitespace-nowrap text-right tabular-nums';

/** The provider shown: the one picked while the rates still hold it, else the first. */
function useProviderGroup(rates: readonly ModelTokenRate[]) {
  const groups = groupTokenRatesByProvider(rates);
  const [picked, setPicked] = useState<string | null>(null);
  return { groups, group: groups.find(candidate => candidate.providerType === picked) ?? groups[0], setPicked };
}

/** The provider tabs. Tabs keep their own width and the row scrolls, so one more provider never squeezes the rest. */
function ProviderTabs({
  groups,
  value,
  onValueChange,
  className,
}: {
  groups: { providerType: string }[];
  value: string;
  onValueChange: (providerType: string) => void;
  className?: string;
}) {
  return (
    <TabSelector
      variant="secondary"
      scrollable
      value={value}
      onValueChange={onValueChange}
      items={groups.map(candidate => {
        const Icon = PROVIDER_ICON[candidate.providerType];
        return {
          id: candidate.providerType,
          label: tokenRateProviderLabel(candidate.providerType),
          icon: Icon ? <Icon className="size-full" /> : undefined,
        };
      })}
      className={className}
    />
  );
}

/** The tabs' box while the rates load (the selector's own heights). */
const TABS_SKELETON_CLASS = 'h-11 w-full max-w-sm content-md:h-12';

// ─── The table (a popover) ───────────────────────────────────────────────────

export interface ModelTokenRatesProps {
  /** The rates, once read. */
  rates?: readonly ModelTokenRate[];
  /** Where the read stands. Default `ready`. */
  status?: ModelTokenRatesStatus;
  /**
   * Whether the balance these rates draw on refills itself: the panel's first
   * line on a billing page. Left out where there is no balance to have that state.
   */
  autoTopUpEnabled?: boolean;
  className?: string;
}

/** How many rows the table's skeleton draws: about what the panel's height shows. */
const TABLE_SKELETON_ROWS = 8;

/**
 * The table in its frame, at ONE height in every state. The frame and the auto
 * top-up line stay put while the rates load or fail to: that line is a fact
 * about the subscription, not about the rates.
 */
export function ModelTokenRates({ rates = [], status = 'ready', autoTopUpEnabled, className }: ModelTokenRatesProps) {
  return (
    <div
      className={cn(
        'flex h-[min(60vh,420px)] w-[340px] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-[6px] border border-ods-border bg-ods-card',
        className,
      )}
    >
      {autoTopUpEnabled != null && <AutoTopUpLine enabled={autoTopUpEnabled} />}
      {status === 'loading' ? (
        <ModelTokenRatesSkeleton />
      ) : status === 'error' ? (
        <ModelTokenRatesUnavailable className="flex-1" />
      ) : (
        <ModelTokenRatesTable rates={rates} />
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

function ModelTokenRatesTable({ rates }: { rates: readonly ModelTokenRate[] }) {
  const { groups, group, setPicked } = useProviderGroup(rates);

  if (!group) {
    return (
      <p className={cn('flex-1 py-[var(--spacing-system-s)] text-ods-text-secondary text-h6', PAD_X)}>
        {MODEL_TOKEN_RATES_COPY.empty}
      </p>
    );
  }

  return (
    <>
      {groups.length > 1 && (
        <ProviderTabs
          groups={groups}
          value={group.providerType}
          onValueChange={setPicked}
          className={cn('shrink-0 border-b border-ods-border py-[var(--spacing-system-xs)]', PAD_X)}
        />
      )}
      <div role="table" aria-label={MODEL_TOKEN_RATES_COPY.unit} className="flex min-h-0 flex-1 flex-col">
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
        </div>
        {/* Every model of the provider, scrolling under the pinned header. */}
        <div role="rowgroup" className="min-h-0 flex-1 overflow-y-auto">
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
                {formatTokenRate(rate.inputTokenRate)}
              </span>
              <span role="cell" className={NUMBER_CELL}>
                {formatTokenRate(rate.outputTokenRate)}
              </span>
            </div>
          ))}
        </div>
      </div>
      {/* The unit, stated once, where it has room to wrap. */}
      <p
        className={cn(
          'shrink-0 border-t border-ods-border py-[var(--spacing-system-xs)] text-ods-text-secondary text-h6',
          PAD_X,
        )}
      >
        {MODEL_TOKEN_RATES_COPY.unit}
      </p>
    </>
  );
}

/** Why the rates are missing, in the box the rates would fill. Shown on a deliberate click or in a page's reserved space, so it never renders empty. */
export function ModelTokenRatesUnavailable({ className }: { className?: string }) {
  return (
    <div
      role="alert"
      className={cn(
        'flex flex-col items-center justify-center gap-[var(--spacing-system-xs)] p-[var(--spacing-system-mf)] text-center',
        className,
      )}
    >
      <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-ods-bg text-ods-text-secondary">
        <AlertTriangleIcon className="size-5" />
      </div>
      <p className="text-ods-text-primary text-h3">{MODEL_TOKEN_RATES_COPY.unavailable.title}</p>
      <p className="max-w-[320px] text-ods-text-secondary text-h6">{MODEL_TOKEN_RATES_COPY.unavailable.body}</p>
    </div>
  );
}

/** The table's loading footprint: the provider tabs, the header and rows of the boxes the loaded rows use. */
export function ModelTokenRatesSkeleton() {
  const cells = (
    <>
      <div className="flex-1" />
      <Skeleton className="h-4 w-12" />
      <Skeleton className="h-4 w-12" />
    </>
  );
  return (
    <div aria-busy="true" className="min-h-0 flex-1 overflow-hidden">
      <div className={cn('border-b border-ods-border py-[var(--spacing-system-xs)]', PAD_X)}>
        <Skeleton className={TABS_SKELETON_CLASS} />
      </div>
      <div className={cn(ROW, PAD_X, 'py-[var(--spacing-system-xs)]')}>
        <Skeleton className="h-4 w-14" />
        {cells}
      </div>
      {Array.from({ length: TABLE_SKELETON_ROWS }, (_, index) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: identical placeholder rows
        <div key={index} className={cn(ROW, PAD_X, 'py-[var(--spacing-system-xxs)]')}>
          <Skeleton className="h-4 w-36" />
          {cells}
        </div>
      ))}
    </div>
  );
}

// ─── The paged table (a page) ────────────────────────────────────────────────

export interface ModelTokenRatePagesProps {
  /** The rates, once read. */
  rates?: readonly ModelTokenRate[];
  /** Where the read stands. Default `ready`. */
  status?: ModelTokenRatesStatus;
  /**
   * What OpenFrame tokens cost. Given: every figure is USD per 1M of the model's
   * tokens and the rate is a column of its own. Not given (the host could not
   * read the price): the figures are the rates themselves.
   */
  tokenPrice?: TokenPrice | null;
  /** Move to the next page after this long; `0` never moves by itself. Default: the carousel's own interval. */
  autoAdvanceMs?: number;
  className?: string;
}

/** Models on one page. Every page draws this many row slots, so every page (and the skeleton) is one height. */
export const MODEL_TOKEN_RATES_PAGE_SIZE = 7;

const PAGE_FRAME_CLASS = 'relative w-full overflow-hidden rounded-md border border-ods-border bg-ods-card';
/** Tighter on a phone, where the model's name needs every pixel. */
const PAGE_PAD_X = 'px-[var(--spacing-system-s)] sm:px-[var(--spacing-system-mf)]';
/** One line of a page: the title bar, the column names and each model are this box, loaded or loading. */
const PAGE_LINE_CLASS = cn(
  'flex h-10 items-center gap-[var(--spacing-system-xs)] sm:gap-[var(--spacing-system-mf)]',
  PAGE_PAD_X,
);
const PAGE_NUMBER_CELL = 'w-14 shrink-0 whitespace-nowrap text-right tabular-nums sm:w-28';
/** From the `md` width up: the rate is the detail behind the price, and a phone has no room for it. */
const PAGE_RATE_CELL =
  'hidden w-44 shrink-0 whitespace-nowrap text-right tabular-nums text-ods-text-secondary md:block';
/** The slots of one page, as keys. */
const PAGE_SLOTS = Array.from({ length: MODEL_TOKEN_RATES_PAGE_SIZE }, (_, index) => index);

/**
 * The rates as a price list, a page at a time: rows are models and the columns
 * are input, cached input and output, so two models compare by reading down a
 * column. The pages sit on the lib's `SnapCarousel` (the control under the
 * customer stories): it moves to the next page by itself on the carousel's
 * timer, with its pause control, dots, counter, arrows and swipe. A provider's
 * models keep together and each page names its provider.
 *
 * ONE height in every state: a page always draws `MODEL_TOKEN_RATES_PAGE_SIZE`
 * row slots, and loading, failed and empty draw the same frame.
 */
export function ModelTokenRatePages({
  rates = [],
  status = 'ready',
  tokenPrice,
  autoAdvanceMs,
  className,
}: ModelTokenRatePagesProps) {
  if (status === 'loading') return <ModelTokenRatePagesSkeleton className={className} />;

  const pages = paginateTokenRates(rates, MODEL_TOKEN_RATES_PAGE_SIZE);
  if (status === 'error' || pages.length === 0) {
    return (
      <div className={className}>
        <div className={PAGE_FRAME_CLASS}>
          <PageSlots />
          <div className="absolute inset-0 flex">
            {status === 'error' ? (
              <ModelTokenRatesUnavailable className="flex-1" />
            ) : (
              <p className="m-auto p-[var(--spacing-system-mf)] text-center text-ods-text-secondary text-h6">
                {MODEL_TOKEN_RATES_COPY.empty}
              </p>
            )}
          </div>
        </div>
        <SnapCarouselControlsSkeleton />
      </div>
    );
  }

  return (
    <SnapCarousel
      className={className}
      items={pages}
      getKey={page => `${page.providerType}-${page.page}`}
      label={MODEL_TOKEN_RATES_COPY.carousel}
      autoAdvanceMs={autoAdvanceMs}
      slideClassName="min-w-0 basis-full"
      renderItem={page => <ModelTokenRatePage page={page} tokenPrice={tokenPrice} />}
    />
  );
}

/** The frame's lines with nothing in them: what holds a page's height when it has no rows to draw. */
function PageSlots() {
  return (
    <div aria-hidden className="invisible">
      <div className={PAGE_LINE_CLASS} />
      <div className={PAGE_LINE_CLASS} />
      {PAGE_SLOTS.map(slot => (
        <div key={slot} className={PAGE_LINE_CLASS} />
      ))}
    </div>
  );
}

/** One page: its provider and the unit (stated once, over the figures), the column names, then a row per model. */
function ModelTokenRatePage({ page, tokenPrice }: { page: TokenRatePage; tokenPrice?: TokenPrice | null }) {
  const Icon = PROVIDER_ICON[page.providerType];
  const provider = tokenRateProviderLabel(page.providerType);
  // Priced: USD per 1M tokens, the rate in its own column. Not priced: the rates are the figures.
  const priced = tokenRatePrice(1, tokenPrice) !== null;
  const unit = priced ? MODEL_TOKEN_RATES_COPY.priceUnit : MODEL_TOKEN_RATES_COPY.unit;
  const figure = (rate: number | null | undefined) =>
    priced ? formatTokenPrice(tokenRatePrice(rate, tokenPrice)) : formatTokenRate(rate);
  return (
    <div role="table" aria-label={`${provider}: ${unit}`} className={PAGE_FRAME_CLASS}>
      <div className={cn(PAGE_LINE_CLASS, 'border-b border-ods-border')}>
        {Icon && <Icon className="size-6 shrink-0 text-ods-text-secondary" />}
        <span className="shrink-0 text-ods-text-primary text-h4">{provider}</span>
        {page.pages > 1 && (
          <span className="shrink-0 text-ods-text-secondary text-h6">
            {MODEL_TOKEN_RATES_COPY.pageOf(page.page, page.pages)}
          </span>
        )}
        <span className="ml-auto min-w-0 truncate text-ods-text-secondary text-h6">{unit}</span>
      </div>
      <div role="row" className={cn(PAGE_LINE_CLASS, 'uppercase tracking-[-0.02em] text-ods-text-secondary text-h5')}>
        <span role="columnheader" className="min-w-0 flex-1 truncate">
          {MODEL_TOKEN_RATES_COPY.model}
        </span>
        <span role="columnheader" className={PAGE_NUMBER_CELL}>
          {MODEL_TOKEN_RATES_COPY.input}
        </span>
        <span role="columnheader" aria-label={MODEL_TOKEN_RATES_COPY.cached} className={PAGE_NUMBER_CELL}>
          <span className="sm:hidden">{MODEL_TOKEN_RATES_COPY.cachedShort}</span>
          <span className="hidden sm:inline">{MODEL_TOKEN_RATES_COPY.cached}</span>
        </span>
        <span role="columnheader" className={PAGE_NUMBER_CELL}>
          {MODEL_TOKEN_RATES_COPY.output}
        </span>
        {priced && (
          <span role="columnheader" className={PAGE_RATE_CELL}>
            {MODEL_TOKEN_RATES_COPY.rate}
          </span>
        )}
      </div>
      <div role="rowgroup">
        {PAGE_SLOTS.map(slot => {
          const rate = page.rates[slot];
          // A page with fewer models keeps its empty slots, so every page is one height.
          if (!rate) return <div key={`slot-${slot}`} aria-hidden className={PAGE_LINE_CLASS} />;
          return (
            <div
              key={rate.modelName}
              role="row"
              className={cn(PAGE_LINE_CLASS, 'border-t border-ods-border text-ods-text-primary text-h6')}
            >
              <span role="rowheader" className="min-w-0 flex-1 truncate">
                {rate.displayName || rate.modelName}
              </span>
              <span role="cell" className={PAGE_NUMBER_CELL}>
                {figure(rate.inputTokenRate)}
              </span>
              <span role="cell" className={PAGE_NUMBER_CELL}>
                {figure(rate.cacheReadInputTokenRate)}
              </span>
              <span role="cell" className={PAGE_NUMBER_CELL}>
                {figure(rate.outputTokenRate)}
              </span>
              {priced && (
                <span role="cell" className={PAGE_RATE_CELL}>
                  {MODEL_TOKEN_RATES_COPY.rateOf(
                    formatTokenRate(rate.inputTokenRate),
                    formatTokenRate(rate.outputTokenRate),
                  )}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** The paged table's loading footprint: one page's frame with its own lines, and the carousel's controls row. */
export function ModelTokenRatePagesSkeleton({ className }: { className?: string }) {
  const cells = (
    <>
      <Skeleton className="h-4 w-10 shrink-0 sm:ml-16 sm:w-12" />
      <Skeleton className="h-4 w-10 shrink-0 sm:ml-16 sm:w-12" />
      <Skeleton className="h-4 w-10 shrink-0 sm:ml-16 sm:w-12" />
      <Skeleton className="hidden h-4 w-28 shrink-0 md:ml-16 md:block" />
    </>
  );
  return (
    <div aria-busy="true" className={className}>
      <div className={PAGE_FRAME_CLASS}>
        <div className={cn(PAGE_LINE_CLASS, 'border-b border-ods-border')}>
          <Skeleton className="size-6 shrink-0 rounded-full" />
          <Skeleton className="h-5 w-28" />
        </div>
        <div className={PAGE_LINE_CLASS}>
          <Skeleton className="h-4 w-14" />
          <div className="flex-1" />
          {cells}
        </div>
        {PAGE_SLOTS.map(slot => (
          <div key={slot} className={cn(PAGE_LINE_CLASS, 'border-t border-ods-border')}>
            <Skeleton className="h-4 w-36" />
            <div className="flex-1" />
            {cells}
          </div>
        ))}
      </div>
      <SnapCarouselControlsSkeleton />
    </div>
  );
}
