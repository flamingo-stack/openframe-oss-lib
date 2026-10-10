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
import { PushButtonSelector } from './push-button-selector';

/**
 * The per-model AI token exchange rates, in the two places they are shown:
 *
 * - `ModelTokenRates` (+ `ModelTokenRatesPopover`): a small table behind a
 *   question mark, for the product's cards that count in tokens.
 * - `ModelTokenExchange`: the whole idea as three steps with a figure each
 *   (buy OpenFrame tokens, use a frontier model, its tokens are charged at an
 *   exchange rate). For a page (the website's pricing page).
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
  /** The exchange: three steps, each with its own figure. */
  exchange: {
    buy: {
      title: 'You buy OpenFrame tokens',
      /** Under the price: "buys 1M OpenFrame tokens" */
      words: (tokens: string) => `buys ${tokens} OpenFrame tokens`,
      /** Under the tokens, where no price is known. */
      unit: 'OpenFrame tokens',
    },
    use: {
      title: 'You use a frontier AI model',
      model: 'Model',
      search: 'Search models',
      noMatch: 'No model matches',
    },
    charge: {
      title: 'Its tokens are charged at an exchange rate',
      input: 'OpenFrame tokens for every token the model reads',
      output: 'OpenFrame tokens for every token the model writes',
      /** "So $10.00 on Claude Opus 5.5 buys 750K tokens read, or 150K tokens written." */
      buys: (balance: string, model: string, input: string, output: string) =>
        `So ${balance} on ${model} buys ${input} tokens read, or ${output} tokens written.`,
    },
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
  /** The providers to choose between (their keys), in the host's order. */
  providers?: readonly string[];
  /** The provider chosen, and the host's handler for a change (it searches that provider's models). */
  provider?: string | null;
  onProviderChange?: (providerType: string) => void;
  /**
   * The picker's options: what the HOST's search answered for `query` within
   * `provider`. The picker never filters them itself: searching is the host's
   * server's job.
   */
  models?: readonly ModelTokenRate[];
  /** What is typed in the picker, and the host's handler for it (it searches). */
  query?: string;
  onQueryChange?: (query: string) => void;
  /** The host's search is in flight. */
  searching?: boolean;
  /** A model was picked: its `modelName`. */
  onPick?: (modelName: string) => void;
  /** The OpenFrame tokens bought in step 1. Default one million. */
  balance?: number;
  /** What that many OpenFrame tokens cost ("$10.00"). Not given: step 1 states the tokens alone. */
  balancePrice?: string | null;
  /** A line under step 1 (what the plan already includes). */
  included?: ReactNode;
  className?: string;
}

/** The balance the exchange is worked out for when the host names none. */
export const MODEL_TOKEN_EXCHANGE_BALANCE = 1_000_000;

/** A line of the surrounding text's own height, as a bar: what a figure is while it loads. */
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

/** One step of the flow: its number and what happens in it, over its content. */
function ExchangeStep({ step, title, children }: { step: number; title: string; children: ReactNode }) {
  return (
    <section className="flex min-w-0 flex-col gap-[var(--spacing-system-mf)] rounded-md border border-ods-border bg-ods-card p-[var(--spacing-system-lf)]">
      <header className="flex items-center gap-[var(--spacing-system-sf)]">
        <span className="grid size-8 shrink-0 place-items-center rounded-full border border-ods-border tabular-nums text-ods-text-primary text-h5">
          {step}
        </span>
        <h3 className="min-w-0 text-ods-text-primary text-h3">{title}</h3>
      </header>
      {children}
    </section>
  );
}

/** A big figure over the plain words that say what it is. The words keep two lines, so a step is one height when they wrap. */
function ExchangeFigure({ figure, words, loading }: { figure: ReactNode; words: ReactNode; loading?: boolean }) {
  return (
    <div className="flex min-w-0 flex-col">
      <span className="whitespace-nowrap tabular-nums text-ods-text-primary text-h1">
        {loading ? <Bar className="w-32" /> : figure}
      </span>
      <span className="min-h-[2lh] text-ods-text-secondary text-h4">
        {loading ? <Bar className="w-full max-w-xs" /> : words}
      </span>
    </div>
  );
}

/**
 * How AI tokens are paid for, as three steps read left to right, each with its
 * own figure, so the whole idea is on screen at once:
 *
 *   1. You buy OpenFrame tokens      "$10.00 buys 1M OpenFrame tokens"
 *   2. You use a frontier AI model   provider buttons, then the model
 *   3. Its tokens are charged at an exchange rate
 *                                    "1.33× per token it reads, 6.67× per token it
 *                                     writes", then what the step 1 balance buys
 *
 * Step 2 is where the visitor acts: the lib's `PushButtonSelector` picks the
 * provider and the lib's `Autocomplete` (the provider's mark on every option)
 * finds a model of it. The picker SEARCHES ON THE SERVER: the host hands in
 * `models` (what its search answered for `query` within `provider`) and the
 * picker shows exactly those, never a filter of its own.
 *
 * One size in every state: each figure and its words are the same boxes loading
 * (bars of their own line height), loaded, failed and empty.
 */
export function ModelTokenExchange({
  rate,
  status = 'ready',
  providers = [],
  provider,
  onProviderChange,
  models = [],
  query,
  onQueryChange,
  searching = false,
  onPick,
  balance = MODEL_TOKEN_EXCHANGE_BALANCE,
  balancePrice,
  included,
  className,
}: ModelTokenExchangeProps) {
  const copy = MODEL_TOKEN_RATES_COPY.exchange;
  const loading = status === 'loading';
  const failed = status === 'error' || (status === 'ready' && !rate);
  const tokens = formatTokenAmount(balance);
  const model = rate ? rate.displayName || rate.modelName : '';

  // The picked model stays addressable when the search's answer does not hold it.
  const options = models.map(modelOption);
  if (rate && !models.some(candidate => candidate.modelName === rate.modelName)) options.unshift(modelOption(rate));

  return (
    <div className={cn('relative grid grid-cols-1 gap-[var(--spacing-system-mf)] lg:grid-cols-3', className)}>
      <ExchangeStep step={1} title={copy.buy.title}>
        <ExchangeFigure figure={balancePrice ?? tokens} words={balancePrice ? copy.buy.words(tokens) : copy.buy.unit} />
        {included && (
          <p className="mt-auto border-t border-ods-border pt-[var(--spacing-system-mf)] text-ods-text-secondary text-h4">
            {included}
          </p>
        )}
      </ExchangeStep>

      <ExchangeStep step={2} title={copy.use.title}>
        <PushButtonSelector<string>
          options={providers.map(providerType => {
            const Icon = PROVIDER_ICON[providerType];
            return {
              id: providerType,
              name: tokenRateProviderLabel(providerType),
              icon: Icon ? <Icon className="size-8 text-ods-text-secondary" /> : undefined,
            };
          })}
          selectedIds={provider ? [provider] : []}
          onSelectionChange={ids => {
            // A single choice that cannot be cleared: choosing the chosen provider changes nothing.
            if (ids[0]) onProviderChange?.(ids[0]);
          }}
          multiSelect={false}
          isLoading={providers.length === 0 && !failed}
        />
        <Autocomplete<string>
          label={copy.use.model}
          value={rate?.modelName ?? null}
          onChange={modelName => {
            if (modelName) onPick?.(modelName);
          }}
          options={options}
          inputValue={query}
          onInputChange={value => onQueryChange?.(value)}
          disableClientFilter
          loading={searching}
          disabled={providers.length === 0}
          placeholder={copy.use.search}
          noOptionsText={copy.use.noMatch}
        />
      </ExchangeStep>

      <ExchangeStep step={3} title={copy.charge.title}>
        <ExchangeFigure loading={loading} figure={formatTokenRate(rate?.inputTokenRate)} words={copy.charge.input} />
        <ExchangeFigure loading={loading} figure={formatTokenRate(rate?.outputTokenRate)} words={copy.charge.output} />
        {/* The step 1 balance, read through this rate: what the money buys on the model picked. */}
        <p className="mt-auto min-h-[3lh] border-t border-ods-border pt-[var(--spacing-system-mf)] text-ods-text-primary text-h4 [box-sizing:content-box]">
          {loading || !rate ? (
            <Bar className="w-full max-w-xs" />
          ) : (
            copy.charge.buys(
              balancePrice ?? tokens,
              model,
              formatTokenAmount(tokensForBalance(balance, rate.inputTokenRate)),
              formatTokenAmount(tokensForBalance(balance, rate.outputTokenRate)),
            )
          )}
        </p>
      </ExchangeStep>

      {failed && (
        // The frame keeps its size; what is under it states no figure.
        <div className="absolute inset-0 flex rounded-md border border-ods-border bg-ods-card">
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
