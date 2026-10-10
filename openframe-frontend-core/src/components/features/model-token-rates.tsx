'use client';

import { type ComponentType, type ReactNode, useState } from 'react';
import { cn } from '../../utils/cn';
import {
  formatTokenAmount,
  formatTokenRate,
  formatTokenRateNumber,
  groupTokenRatesByProvider,
  type ModelTokenRate,
  tokenRateProviderLabel,
  tokensForBalance,
} from '../../utils/model-token-rates';
import { TransferHrIcon } from '../icons-v2-generated/arrows/transfer-hr-icon';
import { AnthropicLogoGreyIcon } from '../icons-v2-generated/brand-logos/anthropic-logo-grey-icon';
import { GeminiLogoGreyIcon } from '../icons-v2-generated/brand-logos/gemini-logo-grey-icon';
import { OpenaiLogoGreyIcon } from '../icons-v2-generated/brand-logos/openai-logo-grey-icon';
import { AlertTriangleIcon } from '../icons-v2-generated/interface/alert-triangle-icon';
import { Refresh02VrIcon } from '../icons-v2-generated/media-playback/refresh-02-vr-icon';
import { QuestionCircleIcon } from '../icons-v2-generated/signs-and-symbols/question-circle-icon';
import { XmarkCircleIcon } from '../icons-v2-generated/signs-and-symbols/xmark-circle-icon';
import { DashboardInfoCard } from '../ui/dashboard-info-card';
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from '../ui/dropdown-menu';
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '../ui/select';
import { Skeleton } from '../ui/skeleton';
import { TabSelector } from '../ui/tab-selector';

/**
 * The per-model AI token exchange rates, in the two places they are shown:
 *
 * - `ModelTokenRates` (+ `ModelTokenRatesPopover`): a small table behind a
 *   question mark, for the product's cards that count in tokens.
 * - `ModelTokenExchange`: one model's rate at a time, picked from a list, the
 *   way a currency exchange shows one pair. For a page (the website's pricing
 *   page), where the point is the idea, not every row.
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
    title: 'Exchange rate',
    pick: 'Choose a model',
    input: '1 input token',
    output: '1 output token',
    cached: '1 cached token',
    /** Under each rate: what the figure is. */
    charged: 'OpenFrame tokens charged',
    balance: 'Your balance',
    balanceUnit: 'OpenFrame tokens',
    /** Over what the balance runs on the model picked. */
    buys: 'Buys',
    /** "input tokens, or 150K output tokens" */
    orOutput: (output: string) => `input tokens, or ${output} output tokens`,
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
  /** The rates, once read. */
  rates?: readonly ModelTokenRate[];
  /** Where the read stands. Default `ready`. */
  status?: ModelTokenRatesStatus;
  /** The balance the exchange is worked out for, in OpenFrame tokens. Default one million. */
  balance?: number;
  /** What sits under that balance's figure (what it costs, or where it comes from). */
  balanceCaption?: ReactNode;
  className?: string;
}

/** The balance the exchange is worked out for when the host names none. */
export const MODEL_TOKEN_EXCHANGE_BALANCE = 1_000_000;

/** A rate tile is one height at every width, with or without a wrapped caption. */
const EXCHANGE_TILE_CLASS = 'h-full md:h-auto';

/**
 * The exchange rate of ONE model, the way a currency exchange shows one pair:
 * pick the model, read what a token of it charges to the balance, and see what
 * a balance of OpenFrame tokens runs on it. A picker, not a list: one model is
 * one answer, and the block is the same size whichever model is picked.
 *
 * Built from the lib's `Select` and stat tiles (`DashboardInfoCard`), whose own
 * `loading` state is the skeleton: the same cards, their figures as bars, so
 * nothing moves when the rates land. A failed read keeps the frame and says why.
 */
export function ModelTokenExchange({
  rates = [],
  status = 'ready',
  balance = MODEL_TOKEN_EXCHANGE_BALANCE,
  balanceCaption,
  className,
}: ModelTokenExchangeProps) {
  const groups = groupTokenRatesByProvider(rates);
  const [picked, setPicked] = useState<string | null>(null);
  // The model picked, while the rates still hold it; else the first one.
  const rate = rates.find(candidate => candidate.modelName === picked) ?? rates[0];
  const loading = status === 'loading';
  const copy = MODEL_TOKEN_RATES_COPY.exchange;

  const charges: [string, number | null | undefined][] = [
    [copy.input, rate?.inputTokenRate],
    [copy.output, rate?.outputTokenRate],
    [copy.cached, rate?.cacheReadInputTokenRate],
  ];

  return (
    <div
      className={cn(
        'relative flex flex-col gap-[var(--spacing-system-lf)] rounded-md border border-ods-border p-[var(--spacing-system-lf)] md:p-[var(--spacing-system-xlf)]',
        className,
      )}
    >
      <div className="flex flex-col gap-[var(--spacing-system-sf)] sm:flex-row sm:items-center sm:justify-between">
        <span className="text-ods-text-secondary text-h5">{copy.title}</span>
        {loading || !rate ? (
          <Skeleton className={cn('h-11 w-full sm:w-72 md:h-12', !loading && 'invisible')} />
        ) : (
          <Select value={rate.modelName} onValueChange={setPicked}>
            <SelectTrigger aria-label={copy.pick} className="w-full bg-ods-bg sm:w-72">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {groups.map(group => (
                <SelectGroup key={group.providerType}>
                  <SelectLabel>{tokenRateProviderLabel(group.providerType)}</SelectLabel>
                  {group.rates.map(candidate => (
                    <SelectItem key={candidate.modelName} value={candidate.modelName}>
                      {candidate.displayName || candidate.modelName}
                    </SelectItem>
                  ))}
                </SelectGroup>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* What one token of the model charges to the balance. */}
      <div className="grid grid-cols-1 gap-[var(--spacing-system-sf)] sm:grid-cols-3">
        {charges.map(([title, value]) => (
          <DashboardInfoCard
            key={title}
            title={title}
            value={formatTokenRateNumber(value)}
            caption={copy.charged}
            loading={loading}
            className={EXCHANGE_TILE_CLASS}
          />
        ))}
      </div>

      {/* What a balance runs on the model: the same rate, read the other way. */}
      <div className="grid grid-cols-1 items-center gap-[var(--spacing-system-mf)] sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]">
        <DashboardInfoCard
          title={copy.balance}
          value={formatTokenAmount(balance)}
          caption={balanceCaption ?? copy.balanceUnit}
          className={EXCHANGE_TILE_CLASS}
        />
        <TransferHrIcon aria-hidden className="mx-auto size-5 text-ods-text-secondary max-sm:rotate-90" />
        <DashboardInfoCard
          title={copy.buys}
          value={formatTokenAmount(tokensForBalance(balance, rate?.inputTokenRate))}
          caption={copy.orOutput(formatTokenAmount(tokensForBalance(balance, rate?.outputTokenRate)))}
          loading={loading}
          className={EXCHANGE_TILE_CLASS}
        />
      </div>

      {(status === 'error' || (status === 'ready' && !rate)) && (
        // The frame keeps its size; the tiles under it state no figure.
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
