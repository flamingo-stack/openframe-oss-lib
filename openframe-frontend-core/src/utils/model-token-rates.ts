/**
 * The per-model AI token exchange rates: their shape and how a rate is written.
 * Server-safe (no client code), so a host's server (a chat source, a page's
 * metadata) states a rate exactly as the shared table (`ModelTokenRates`) does.
 */

import { aiProvider } from './ai-providers';

/** One model's rates: OpenFrame tokens charged per ONE token of the model. */
export interface ModelTokenRate {
  modelName: string;
  /** The name people know the model by; the model's id stands in when it is missing. */
  displayName?: string | null;
  /** The provider's key (`ANTHROPIC`, `OPENAI`, `GOOGLE_GEMINI`); an unknown one is shown by name, without a mark. */
  providerType: string;
  /** The provider's name, when the host's server states one; else the shared provider list names it. */
  providerLabel?: string | null;
  /** The icon set's name of the provider's mark, when the host's server states one; else the shared provider list's. */
  providerIcon?: string | null;
  inputTokenRate: number;
  outputTokenRate: number;
  /** Charged for an input token read back from the prompt cache. Shown only where the table has room for it. */
  cacheReadInputTokenRate?: number | null;
}

/** What a figure that cannot be stated is written as. */
export const TOKEN_RATE_EMPTY = '\u2014';

/**
 * A rate as a multiplier. Two decimals from 0.1 up ("1.33×", "5×"), two
 * significant digits under it ("0.033×"), so a cheap model's rate is never
 * rounded to nothing.
 */
export function formatTokenRate(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value) || value <= 0) return TOKEN_RATE_EMPTY;
  const rounded = value >= 0.1 ? Number(value.toFixed(2)) : Number(value.toPrecision(2));
  return `${rounded}\u00d7`;
}

/** What OpenFrame tokens cost: `price` USD buys `tokens` of them. */
export interface TokenPrice {
  tokens: number;
  price: number;
}

/** What a number of OpenFrame tokens costs in USD at a price. Null without a price. */
export function tokenCost(tokens: number, tokenPrice: TokenPrice | null | undefined): number | null {
  if (!tokenPrice || !(tokenPrice.tokens > 0) || !(tokenPrice.price > 0) || !(tokens >= 0)) return null;
  return (tokens / tokenPrice.tokens) * tokenPrice.price;
}

/** The units a token count is shortened to, largest first. */
const TOKEN_AMOUNT_UNITS = [
  { size: 1_000_000_000, suffix: 'B' },
  { size: 1_000_000, suffix: 'M' },
  { size: 1_000, suffix: 'K' },
] as const;

/**
 * A token count in short form: "850", "10K", "750K", "1.25M". The unit is chosen
 * from the ROUNDED figure, so a count just under a unit reads as the next one
 * ("1M", never "1000K").
 */
export function formatTokenAmount(tokens: number | null | undefined): string {
  if (tokens == null || !Number.isFinite(tokens) || tokens < 0) return TOKEN_RATE_EMPTY;
  const whole = Math.round(tokens);
  if (whole < 1_000) return String(whole);
  for (const [index, unit] of TOKEN_AMOUNT_UNITS.entries()) {
    if (whole < unit.size) continue;
    const figure = Number((whole / unit.size).toPrecision(3));
    // Rounded up to a thousand of this unit: it is one of the unit above.
    const larger = TOKEN_AMOUNT_UNITS[index - 1];
    return figure >= 1_000 && larger ? `1${larger.suffix}` : `${figure}${unit.suffix}`;
  }
  return String(whole);
}

/**
 * How many of a model's tokens a balance of OpenFrame tokens runs at a rate:
 * the balance divided by the rate. Null without a rate.
 */
export function tokensForBalance(balance: number, rate: number | null | undefined): number | null {
  if (rate == null || !Number.isFinite(rate) || rate <= 0 || !(balance > 0)) return null;
  return balance / rate;
}

/** A provider's name: what the host stated for it, else the shared provider list's (`aiProvider`). */
export function tokenRateProviderLabel(providerType: string, stated?: string | null): string {
  return aiProvider(providerType, { label: stated }).label;
}

/** The rates under their providers, in the order the host gave them (providers by first appearance). */
export function groupTokenRatesByProvider<T extends ModelTokenRate>(
  rates: readonly T[],
): { providerType: string; rates: T[] }[] {
  const groups = new Map<string, T[]>();
  for (const rate of rates) {
    const group = groups.get(rate.providerType);
    if (group) group.push(rate);
    else groups.set(rate.providerType, [rate]);
  }
  return [...groups].map(([providerType, grouped]) => ({ providerType, rates: grouped }));
}
