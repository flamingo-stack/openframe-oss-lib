/**
 * Social platform helpers — normalization, host classification, the shared link
 * type, and the "find the link for a platform" picker.
 *
 * **This module does NOT own the list of platforms.** That list lives in the
 * `social_platforms` table and only there: it is admin-editable, it carries
 * `display_name`, `icon_name`, `base_url`, `url_pattern`, `category` and
 * `sort_order`, and the hub already reads it everywhere
 * (`lib/data/social-platforms-utils.ts`, `useSocialPlatforms`). A hardcoded
 * tuple here would be a second vocabulary that drifts the first time somebody
 * adds a row — and, being a compile-time union, would reject that row outright.
 *
 * So a platform is a `string` at every boundary. What code owns is the two
 * things a table cannot hold:
 *
 *   - the ICON COMPONENTS (`SOCIAL_ICON_COMPONENTS` in `social-icon-row`),
 *     which the DB names through `icon_name`;
 *   - the incoming SPELLINGS below, which are not platforms but ways external
 *     data refers to them (`x` for twitter, `fb` for facebook).
 *
 * JSX-free leaf with its own `exports` subpath, so `server-only` DALs and hub
 * scripts can import the type and the classifier without pulling in React.
 */

/**
 * One row of `social_platforms`, in the shape callers pass around.
 *
 * Deliberately a narrow READ view: the columns that decide presentation and
 * URL-building, not the OAuth or media-config columns, which have their own
 * consumers and no business here.
 */
export interface SocialPlatformDefinition {
  /** `social_platforms.name` — the canonical key, lowercase. */
  name: string;
  /** `social_platforms.base_url`, e.g. `https://twitter.com/`. */
  baseUrl?: string | null;
  /** `social_platforms.url_pattern`, e.g. `https://twitter.com/{username}`. */
  urlPattern?: string | null;
}

/**
 * Accepted SPELLINGS that resolve onto a platform name.
 *
 * Not a vocabulary — every value here must be a `social_platforms.name`. These
 * exist because external data says `x`, `fb` or `generic` where the table says
 * `twitter`, `facebook` and `website`.
 */
export const SOCIAL_PLATFORM_ALIASES: Record<string, string> = {
  x: 'twitter',
  mail: 'email',
  web: 'website',
  url: 'website',
  yt: 'youtube',
  ig: 'instagram',
  fb: 'facebook',
  generic: 'website',
};

/**
 * Lower-case, trim, and resolve a known alias. Returns `null` only for a blank
 * input — an unrecognised name is passed THROUGH, because this module is not
 * the authority on which platforms exist.
 */
export function normalizeSocialPlatform(platform: string | null | undefined): string | null {
  if (!platform) return null;
  const key = platform.toLowerCase().trim();
  if (!key) return null;
  return SOCIAL_PLATFORM_ALIASES[key] ?? key;
}

/**
 * THE hostname test: an exact host match or a subdomain of it.
 * (`hostMatches('www.github.com', 'github.com')` is true; `notgithub.com` is not.)
 */
export function hostMatches(hostname: string | null | undefined, domain: string): boolean {
  if (!hostname) return false;
  const host = hostname.toLowerCase().replace(/^www\./, '');
  const bare = domain.toLowerCase().replace(/^www\./, '');
  return host === bare || host.endsWith(`.${bare}`);
}

/**
 * Alternate domains a platform's own `url_pattern` cannot express — a rename
 * (`x.com`), a share domain (`youtu.be`), an invite domain (`discord.gg`).
 *
 * The ONLY hardcoded host knowledge left, and it is additive: every primary
 * host is derived from the row. Keyed by `social_platforms.name`, so a row that
 * does not exist contributes nothing. If this grows, the answer is an
 * `alt_hosts` column on the table, not a longer map here.
 */
export const SOCIAL_PLATFORM_ALT_HOSTS: Record<string, readonly string[]> = {
  twitter: ['x.com'],
  youtube: ['youtu.be'],
  discord: ['discord.gg'],
  telegram: ['telegram.org'],
  facebook: ['fb.com'],
};

/** The host a `base_url`/`url_pattern` points at, or null when it names none. */
function hostOf(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    return new URL(value.includes('://') ? value : `https://${value}`).hostname;
  } catch {
    return null;
  }
}

/** Every domain that identifies a platform: its row's host plus any alternates. */
export function socialPlatformHosts(platform: SocialPlatformDefinition): string[] {
  const primary = hostOf(platform.urlPattern) ?? hostOf(platform.baseUrl);
  return [...(primary ? [primary] : []), ...(SOCIAL_PLATFORM_ALT_HOSTS[platform.name] ?? [])];
}

/**
 * Classify a URL by its host against the platforms the DATABASE defines.
 *
 * `platforms` is the caller's loaded `social_platforms` rows — passing them in
 * is what keeps this function pure and this module free of a platform list.
 * Returns `'website'` for a URL that parses but matches no row (the table's own
 * catch-all row), and `null` for something that is not a URL at all.
 */
export function classifySocialHost(
  url: string | null | undefined,
  platforms: readonly SocialPlatformDefinition[],
): string | null {
  const hostname = hostOf(url);
  if (!hostname) return null;
  for (const platform of platforms) {
    if (socialPlatformHosts(platform).some(domain => hostMatches(hostname, domain))) {
      return platform.name;
    }
  }
  return 'website';
}

/**
 * A rendered social link. Exactly ONE of `href` (anchor, target _blank) or
 * `onClick` (share popup / copy-to-clipboard) — the discriminated union makes a
 * dead no-action entry unrepresentable. `SocialIconRow` re-exports this type;
 * it lives here so `server-only` and script graphs can name it without React.
 */
export type SocialIconLink = {
  platform: string;
  label?: string;
  /** `internal` links only render on surfaces that opt in (and must be gated server-side). */
  visibility?: 'external' | 'internal';
} & ({ href: string; onClick?: never } | { onClick: () => void; href?: never });

/**
 * THE "find the link for a platform" predicate, case-insensitive and
 * alias-aware, over ANY shape that carries a `platform` field (the mapped
 * profile rows and the rendered icon links both qualify).
 */
export function pickSocialLink<T extends { platform: string }>(
  links: readonly T[] | null | undefined,
  platform: string,
): T | undefined {
  const target = normalizeSocialPlatform(platform);
  if (!target || !links) return undefined;
  return links.find(link => normalizeSocialPlatform(link.platform) === target);
}
