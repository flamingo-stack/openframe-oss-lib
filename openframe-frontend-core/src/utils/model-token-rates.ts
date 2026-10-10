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

/** A request used to make a rate concrete: how many of the model's tokens it reads and writes. */
export interface TokenRateExample {
  inputTokens: number;
  outputTokens: number;
}

/** THE example request every rate card works out: it reads ten thousand tokens and writes one thousand. */
export const TOKEN_RATE_EXAMPLE: TokenRateExample = { inputTokens: 10_000, outputTokens: 1_000 };

/** The OpenFrame tokens a request uses on a model: what it reads at the input rate plus what it writes at the output rate. Null without both rates. */
export function tokenRateExampleCost(
  rate: Pick<ModelTokenRate, 'inputTokenRate' | 'outputTokenRate'>,
  example: TokenRateExample = TOKEN_RATE_EXAMPLE,
): number | null {
  const { inputTokenRate, outputTokenRate } = rate;
  if (!(inputTokenRate > 0) || !(outputTokenRate > 0)) return null;
  return example.inputTokens * inputTokenRate + example.outputTokens * outputTokenRate;
}

/** A token count in short form: "850", "10K", "16.7K", "1.2M". */
export function formatTokenAmount(tokens: number | null | undefined): string {
  if (tokens == null || !Number.isFinite(tokens) || tokens < 0) return TOKEN_RATE_EMPTY;
  const short = (value: number) => String(Number(value.toPrecision(3)));
  if (tokens >= 1_000_000) return `${short(tokens / 1_000_000)}M`;
  if (tokens >= 1_000) return `${short(tokens / 1_000)}K`;
  return String(Math.round(tokens));
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
