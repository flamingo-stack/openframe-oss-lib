'use client';

import { type ComponentType, type ReactNode, useState } from 'react';
import { cn } from '../../utils/cn';
import {
  formatTokenAmount,
  formatTokenRate,
  groupTokenRatesByProvider,
  type ModelTokenRate,
  TOKEN_RATE_EXAMPLE,
  tokenRateExampleCost,
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
 * - `ModelTokenRateCards`: one card per model, browsed left and right on the
 *   lib's `SnapCarousel`, for a page (the website's pricing page).
 *
 * Both show one provider at a time (the lib's `TabSelector`) and both state a
 * rate with the same functions (`utils/model-token-rates`, server-safe), so a
 * rate reads the same wherever it is stated. Neither fetches: a host reads the
 * rates its own way and hands them in, with `status` saying where that read
 * stands. Each holds ONE height loading, loaded, failed or empty.
 *
 * A rate is the number of OpenFrame tokens ONE token of the model uses. A card
 * also works one example request out (`TOKEN_RATE_EXAMPLE`), because a total is
 * easier to compare than three rates.
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
  /** Over a card's rates: what the three figures are. */
  perToken: 'OpenFrame tokens per token',
  /** "Reads 10K, writes 1K" */
  example: (input: string, output: string) => `Reads ${input}, writes ${output}`,
  /** "20K OpenFrame tokens" */
  exampleCost: (tokens: string) => `${tokens} OpenFrame tokens`,
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

// ─── The cards (a page) ──────────────────────────────────────────────────────

export interface ModelTokenRateCardsProps {
  /** The rates, once read. */
  rates?: readonly ModelTokenRate[];
  /** Where the read stands. Default `ready`. */
  status?: ModelTokenRatesStatus;
  className?: string;
}

/** One card's box: the loaded card and its skeleton are this same frame, so the block never moves. */
const RATE_CARD_CLASS =
  'flex h-52 w-full flex-col gap-[var(--spacing-system-sf)] rounded-md border border-ods-border bg-ods-card p-[var(--spacing-system-mf)]';
/** One slide's width: about four cards across a desktop container, one and a bit on a phone. */
const RATE_SLIDE_CLASS = 'min-w-0 basis-[272px]';
/** The track's height (a card), for the states that have no cards. */
const RATE_TRACK_CLASS = 'h-52';
/** How many skeleton cards fill the track. */
const RATE_SKELETON_CARDS = 6;

/**
 * The rates as cards, one model each, browsed left and right: provider tabs
 * over a `SnapCarousel` (arrows, dots, a counter, swipe). It never advances by
 * itself: a price is read, not watched. The block is the same height loading,
 * loaded, failed and empty: tabs, one card's height, the carousel's controls row.
 */
export function ModelTokenRateCards({ rates = [], status = 'ready', className }: ModelTokenRateCardsProps) {
  const { groups, group, setPicked } = useProviderGroup(rates);

  if (status === 'loading') return <ModelTokenRateCardsSkeleton className={className} />;

  if (status === 'error' || !group) {
    return (
      <div className={cn('flex flex-col gap-[var(--spacing-system-mf)]', className)}>
        <div aria-hidden className={TABS_SKELETON_CLASS} />
        <div>
          <div className={cn(RATE_TRACK_CLASS, 'flex rounded-md border border-ods-border bg-ods-card')}>
            {status === 'error' ? (
              <ModelTokenRatesUnavailable className="flex-1" />
            ) : (
              <p className="m-auto p-[var(--spacing-system-mf)] text-center text-ods-text-secondary text-h6">
                {MODEL_TOKEN_RATES_COPY.empty}
              </p>
            )}
          </div>
          <SnapCarouselControlsSkeleton />
        </div>
      </div>
    );
  }

  return (
    <div className={cn('flex flex-col gap-[var(--spacing-system-mf)]', className)}>
      <ProviderTabs
        groups={groups}
        value={group.providerType}
        onValueChange={setPicked}
        className="max-w-full self-start"
      />
      <SnapCarousel
        // Re-keyed per provider: its track starts again at the first model.
        key={group.providerType}
        items={group.rates}
        getKey={rate => rate.modelName}
        label={MODEL_TOKEN_RATES_COPY.carousel}
        autoAdvanceMs={0}
        slideClassName={RATE_SLIDE_CLASS}
        renderItem={rate => <ModelTokenRateCard rate={rate} />}
      />
    </div>
  );
}

/** One model: its name, what a token of it uses, and the example request worked out. */
function ModelTokenRateCard({ rate }: { rate: ModelTokenRate }) {
  const Icon = PROVIDER_ICON[rate.providerType];
  const figures: [string, number | null | undefined][] = [
    [MODEL_TOKEN_RATES_COPY.input, rate.inputTokenRate],
    [MODEL_TOKEN_RATES_COPY.output, rate.outputTokenRate],
    [MODEL_TOKEN_RATES_COPY.cached, rate.cacheReadInputTokenRate],
  ];
  const name = rate.displayName || rate.modelName;
  return (
    <article aria-label={name} className={RATE_CARD_CLASS}>
      <header className="flex min-w-0 items-center gap-[var(--spacing-system-xs)]">
        {Icon && <Icon className="size-6 shrink-0 text-ods-text-secondary" />}
        <h3 className="min-w-0 truncate text-ods-text-primary text-h4">{name}</h3>
      </header>
      <dl className="flex flex-col gap-[var(--spacing-system-xxs)]">
        <dt className="text-ods-text-secondary text-h6">{MODEL_TOKEN_RATES_COPY.perToken}</dt>
        <dd className="flex gap-[var(--spacing-system-mf)]">
          {figures.map(([label, value]) => (
            <span key={label} className="flex min-w-0 flex-col">
              <span className="whitespace-nowrap tabular-nums text-ods-text-primary text-h4">
                {formatTokenRate(value)}
              </span>
              <span className="whitespace-nowrap text-ods-text-secondary text-h6">{label}</span>
            </span>
          ))}
        </dd>
      </dl>
      <p className="mt-auto flex flex-col border-t border-ods-border pt-[var(--spacing-system-sf)]">
        <span className="text-ods-text-secondary text-h6">
          {MODEL_TOKEN_RATES_COPY.example(
            formatTokenAmount(TOKEN_RATE_EXAMPLE.inputTokens),
            formatTokenAmount(TOKEN_RATE_EXAMPLE.outputTokens),
          )}
        </span>
        <span className="tabular-nums text-ods-text-primary text-h4">
          {MODEL_TOKEN_RATES_COPY.exampleCost(formatTokenAmount(tokenRateExampleCost(rate)))}
        </span>
      </p>
    </article>
  );
}

/** The cards' loading footprint: the tabs, a row of the cards' own frames, the carousel's controls row. */
export function ModelTokenRateCardsSkeleton({ className }: { className?: string }) {
  return (
    <div aria-busy="true" className={cn('flex flex-col gap-[var(--spacing-system-mf)]', className)}>
      <Skeleton className={TABS_SKELETON_CLASS} />
      <div>
        <div className="flex gap-3 overflow-hidden">
          {Array.from({ length: RATE_SKELETON_CARDS }, (_, index) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: identical placeholder cards
            <div key={index} className={cn('flex shrink-0 grow-0', RATE_SLIDE_CLASS)}>
              <div className={RATE_CARD_CLASS}>
                <Skeleton className="h-6 w-40" />
                <Skeleton className="h-4 w-44" />
                <div className="flex gap-[var(--spacing-system-mf)]">
                  <Skeleton className="h-10 w-12" />
                  <Skeleton className="h-10 w-12" />
                  <Skeleton className="h-10 w-16" />
                </div>
                <div className="mt-auto flex flex-col gap-[var(--spacing-system-xxs)] border-t border-ods-border pt-[var(--spacing-system-sf)]">
                  <Skeleton className="h-4 w-36" />
                  <Skeleton className="h-6 w-44" />
                </div>
              </div>
            </div>
          ))}
        </div>
        <SnapCarouselControlsSkeleton />
      </div>
    </div>
  );
}
