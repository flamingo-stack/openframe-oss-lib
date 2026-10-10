/**
 * The per-model AI token exchange rates: their shape and how a rate is written.
 * Server-safe (no client code), so a host's server (a chat source, a page's
 * metadata) states a rate exactly as the shared table (`ModelTokenRates`) does.
 */

/** One model's rates: OpenFrame tokens charged per ONE token of the model. */
export interface ModelTokenRate {
  modelName: string;
  /** The name people know the model by; the model's id stands in when it is missing. */
  displayName?: string | null;
  /** The provider's key (`ANTHROPIC`, `OPENAI`, `GOOGLE_GEMINI`); an unknown one is shown by name, without a mark. */
  providerType: string;
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

/** A token count in short form: "850", "10K", "750K", "1.25M". */
export function formatTokenAmount(tokens: number | null | undefined): string {
  if (tokens == null || !Number.isFinite(tokens) || tokens < 0) return TOKEN_RATE_EMPTY;
  const short = (value: number) => String(Number(value.toPrecision(3)));
  if (tokens >= 1_000_000) return `${short(tokens / 1_000_000)}M`;
  if (tokens >= 1_000) return `${short(tokens / 1_000)}K`;
  return String(Math.round(tokens));
}

/**
 * How many of a model's tokens a balance of OpenFrame tokens runs at a rate:
 * the balance divided by the rate. Null without a rate.
 */
export function tokensForBalance(balance: number, rate: number | null | undefined): number | null {
  if (rate == null || !Number.isFinite(rate) || rate <= 0 || !(balance > 0)) return null;
  return balance / rate;
}

const PROVIDER_LABELS: Record<string, string> = {
  ANTHROPIC: 'Anthropic',
  OPENAI: 'OpenAI',
  GOOGLE_GEMINI: 'Google Gemini',
};

/** A provider's name; a provider this list has not met is named from its key. */
export function tokenRateProviderLabel(providerType: string): string {
  return (
    PROVIDER_LABELS[providerType] ??
    providerType
      .toLowerCase()
      .split('_')
      .filter(Boolean)
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ')
  );
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
