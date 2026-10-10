/**
 * The AI model providers the product names: what each is called and the NAME of
 * its mark in the icon set. THE one owner of both, for every surface that shows
 * a provider (the token rates, a model picker). Server-safe: it holds names
 * only, and the mark is resolved from the icon set by that name where it is
 * drawn (`findIcon`), so no surface imports a provider's icon.
 *
 * A host that is told a provider's name or mark by its server states them on
 * the record and they win. A provider this list has not met is named from its
 * key, and its mark is looked up by the icon set's own naming
 * (`<provider>-logo-grey`), so a logo added to the set shows with no change here.
 */

export interface AiProvider {
  /** The name people know the provider by. */
  label: string;
  /** The icon set's name of the provider's monochrome mark. */
  icon: string;
}

/** Keyed by the provider key billing sends (`ANTHROPIC`). */
export const AI_PROVIDERS: Readonly<Record<string, AiProvider>> = {
  ANTHROPIC: { label: 'Anthropic', icon: 'anthropic-logo-grey' },
  OPENAI: { label: 'OpenAI', icon: 'openai-logo-grey' },
  GOOGLE_GEMINI: { label: 'Google Gemini', icon: 'gemini-logo-grey' },
};

const words = (key: string): string[] =>
  key
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);

/**
 * A provider by its key: what a host stated for it, else this list's entry,
 * else its key read as a name and the mark the icon set would hold for it.
 */
export function aiProvider(key: string, stated?: { label?: string | null; icon?: string | null } | null): AiProvider {
  const known = AI_PROVIDERS[key];
  const parts = words(key);
  return {
    label:
      stated?.label || known?.label || parts.map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ') || key,
    icon: stated?.icon || known?.icon || `${parts.join('-')}-logo-grey`,
  };
}
