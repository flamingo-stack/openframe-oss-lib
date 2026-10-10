'use client';

import { type ComponentType, type ReactNode, useState } from 'react';
import { cn } from '../../utils/cn';
import {
  formatTokenAmount,
  formatTokenRate,
  groupTokenRatesByProvider,
  type ModelTokenRate,
  tokenRateProviderLabel,
  tokensForBalance,
} from '../../utils/model-token-rates';
import { AnthropicLogoGreyIcon } from '../icons-v2-generated/brand-logos/anthropic-logo-grey-icon';
import { GeminiLogoGreyIcon } from '../icons-v2-generated/brand-logos/gemini-logo-grey-icon';
import { OpenaiLogoGreyIcon } from '../icons-v2-generated/brand-logos/openai-logo-grey-icon';
import { AlertTriangleIcon } from '../icons-v2-generated/interface/alert-triangle-icon';
import { Refresh02VrIcon } from '../icons-v2-generated/media-playback/refresh-02-vr-icon';
import { QuestionCircleIcon } from '../icons-v2-generated/signs-and-symbols/question-circle-icon';
import { XmarkCircleIcon } from '../icons-v2-generated/signs-and-symbols/xmark-circle-icon';
import { Autocomplete, type AutocompleteOption } from '../ui/autocomplete';
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from '../ui/dropdown-menu';
import { Skeleton } from '../ui/skeleton';
import { TabSelector } from '../ui/tab-selector';

/**
 * The per-model AI token exchange rates, in the two places they are shown:
 *
 * - `ModelTokenRates` (+ `ModelTokenRatesPopover`): a small table behind a
 *   question mark, for the product's cards that count in tokens.
 * - `ModelTokenExchange`: one model's rate at a time, found by searching, in
 *   big figures: the way a currency exchange shows one pair. For a page (the
 *   website's pricing page), where the point is the idea, not every row.
 *
 * Both state a rate with the same functions (`utils/model-token-rates`,
 * server-safe), so a rate reads the same wherever it is stated. Neither
 * fetches: a host reads the rates its own way and hands them in, with `status`
 * saying where that read stands. Each holds ONE size loading, loaded, failed or
 * empty.
 *
 * A rate is the number of OpenFrame tokens ONE token of the model charges to
 * the balance.
 */

/** Where the host's read of the rates stands. */
export type ModelTokenRatesStatus = 'loading' | 'error' | 'ready';

/** The wording of both views, stated once. */
export const MODEL_TOKEN_RATES_COPY = {
  trigger: 'Per-model token rates',
  unit: 'OpenFrame tokens used per model token',
  model: 'Model',
  input: 'Input',
  output: 'Output',
  /** The exchange card: one model's rate, as a currency exchange shows one pair. */
  exchange: {
    pick: 'Model',
    search: 'Search models',
    noMatch: 'No model matches',
    /** Under each big figure: what one token of the model charges, in OpenFrame tokens. */
    input: 'OpenFrame tokens per input token',
    output: 'OpenFrame tokens per output token',
    /** "1M ($10.00) OpenFrame tokens buy 750K input tokens or 150K output tokens." */
    buys: (balance: string, input: string, output: string) =>
      `${balance} OpenFrame tokens buy ${input} input tokens or ${output} output tokens.`,
  },
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

// ─── The exchange (a page) ───────────────────────────────────────────────────

export interface ModelTokenExchangeProps {
  /** The model whose rate is shown: the one picked, once the host has read it. */
  rate?: ModelTokenRate | null;
  /** Where the host's read of that model stands. Default `ready`. */
  status?: ModelTokenRatesStatus;
  /**
   * The picker's options: what the HOST's search answered for `query`. The
   * picker never filters them itself: searching is the host's server's job.
   */
  models?: readonly ModelTokenRate[];
  /** What is typed in the picker, and the host's handler for it (it searches). */
  query?: string;
  onQueryChange?: (query: string) => void;
  /** The host's search is in flight. */
  searching?: boolean;
  /** A model was picked: its `modelName`. */
  onPick?: (modelName: string) => void;
  /** The balance the last line is worked out for, in OpenFrame tokens. Default one million. */
  balance?: number;
  /** What that balance costs, when the host knows it ("$10.00"). */
  balancePrice?: string | null;
  className?: string;
}

/** The balance the exchange is worked out for when the host names none. */
export const MODEL_TOKEN_EXCHANGE_BALANCE = 1_000_000;

/** A line of the card's own text height, as a bar: what a figure is while it loads. */
function Bar({ className }: { className: string }) {
  return (
    <span
      aria-hidden
      className={cn('inline-block h-[0.8lh] animate-pulse rounded bg-ods-border align-middle', className)}
    />
  );
}

/** A model as a picker option: its name, its provider under it, the provider's mark beside it. */
function modelOption(rate: ModelTokenRate): AutocompleteOption<string> {
  const Icon = PROVIDER_ICON[rate.providerType];
  return {
    label: rate.displayName || rate.modelName,
    value: rate.modelName,
    description: tokenRateProviderLabel(rate.providerType),
    icon: Icon ? <Icon className="size-full text-ods-text-secondary" /> : undefined,
  };
}

/**
 * The exchange rate of ONE model, the way a currency exchange shows one pair:
 * search for the model, and read in big figures what one token of it charges to
 * the balance: "1.33×" for what it reads, "6.67×" for what it writes. One line
 * under them says what a balance buys at that rate.
 *
 * The picker is the lib's `Autocomplete` with the provider's mark on every
 * option. It SEARCHES ON THE SERVER: the host hands in `models` (what its
 * search answered for `query`) and the picker shows exactly those, never a
 * filter of its own.
 *
 * One size in every state: the figures and the line are the same boxes loading
 * (bars of their own line height), loaded, failed and empty.
 */
export function ModelTokenExchange({
  rate,
  status = 'ready',
  models = [],
  query,
  onQueryChange,
  searching = false,
  onPick,
  balance = MODEL_TOKEN_EXCHANGE_BALANCE,
  balancePrice,
  className,
}: ModelTokenExchangeProps) {
  const copy = MODEL_TOKEN_RATES_COPY.exchange;
  const loading = status === 'loading';
  const failed = status === 'error' || (status === 'ready' && !rate);

  // The picked model stays addressable when the search's answer does not hold it.
  const options = models.map(modelOption);
  if (rate && !models.some(candidate => candidate.modelName === rate.modelName)) options.unshift(modelOption(rate));

  const figures: [string, number | null | undefined][] = [
    [copy.input, rate?.inputTokenRate],
    [copy.output, rate?.outputTokenRate],
  ];

  return (
    <div
      className={cn(
        'relative flex flex-col gap-[var(--spacing-system-lf)] rounded-md border border-ods-border p-[var(--spacing-system-lf)] md:p-[var(--spacing-system-xlf)]',
        className,
      )}
    >
      <Autocomplete<string>
        label={copy.pick}
        value={rate?.modelName ?? null}
        onChange={modelName => {
          if (modelName) onPick?.(modelName);
        }}
        options={options}
        inputValue={query}
        onInputChange={value => onQueryChange?.(value)}
        disableClientFilter
        loading={searching}
        disabled={loading && !rate}
        placeholder={copy.search}
        noOptionsText={copy.noMatch}
      />

      {/* What one token of the model charges to the balance: the whole point, in the biggest type. */}
      <div className="grid grid-cols-2 gap-[var(--spacing-system-mf)]">
        {figures.map(([label, value]) => (
          // The label keeps two lines too: it wraps in a narrow column.
          <div key={label} className="flex min-w-0 flex-col">
            <span className="whitespace-nowrap tabular-nums text-ods-text-primary text-h1">
              {loading ? <Bar className="w-32" /> : formatTokenRate(value)}
            </span>
            <span className="min-h-[2lh] text-ods-text-secondary text-h5">{label}</span>
          </div>
        ))}
      </div>

      {/* Two lines are kept for it, loading or loaded, so the card is one height when the sentence wraps. */}
      <p className="min-h-[2lh] border-t border-ods-border pt-[var(--spacing-system-mf)] text-ods-text-secondary text-h4 [box-sizing:content-box]">
        {loading || !rate ? (
          <Bar className="w-full max-w-md" />
        ) : (
          copy.buys(
            balancePrice ? `${formatTokenAmount(balance)} (${balancePrice})` : formatTokenAmount(balance),
            formatTokenAmount(tokensForBalance(balance, rate.inputTokenRate)),
            formatTokenAmount(tokensForBalance(balance, rate.outputTokenRate)),
          )
        )}
      </p>

      {failed && (
        // The frame keeps its size; what is under it states no figure.
        <div className="absolute inset-0 flex rounded-md bg-ods-card">
          {status === 'error' ? (
            <ModelTokenRatesUnavailable className="flex-1" />
          ) : (
            <p className="m-auto p-[var(--spacing-system-mf)] text-center text-ods-text-secondary text-h6">
              {MODEL_TOKEN_RATES_COPY.empty}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
