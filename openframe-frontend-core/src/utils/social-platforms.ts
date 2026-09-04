/**
 * Social platform vocabulary + host classification — ONE table.
 *
 * Owns the platform tuple, its aliases, the hostname table, the "which platform
 * is this URL" classifier, the shared link TYPE, and the "find the link for a
 * platform" picker. `SocialIconRow` maps the tuple to icon components; every
 * other consumer (profile socials, the OG scraper, markdown shortcodes, the
 * hub's MLG export) reads from here.
 *
 * JSX-free leaf with its own `exports` subpath, so `server-only` DALs and hub
 * scripts can import the type and the classifier without pulling in React.
 */

/** Every platform `SocialIconRow` can render a dedicated glyph for. */
export const SOCIAL_ICON_PLATFORMS = [
  'github',
  'twitter',
  'reddit',
  'linkedin',
  'luma',
  'whatsapp',
  'email',
  'website',
  'slack',
  'discord',
  'telegram',
  'youtube',
  'instagram',
  'facebook',
  'tiktok',
  'copy',
] as const;

export type SocialIconPlatform = (typeof SOCIAL_ICON_PLATFORMS)[number];

/** Accepted spellings that normalize onto a canonical platform. */
export const SOCIAL_PLATFORM_ALIASES: Record<string, SocialIconPlatform> = {
  x: 'twitter',
  mail: 'email',
  web: 'website',
  url: 'website',
  yt: 'youtube',
  ig: 'instagram',
  fb: 'facebook',
  generic: 'website',
};

/** Lower-case, trim, and resolve aliases. Returns `null` for anything unknown. */
export function normalizeSocialPlatform(platform: string | null | undefined): SocialIconPlatform | null {
  if (!platform) return null;
  const key = platform.toLowerCase().trim();
  if ((SOCIAL_ICON_PLATFORMS as readonly string[]).includes(key)) return key as SocialIconPlatform;
  return SOCIAL_PLATFORM_ALIASES[key] ?? null;
}

export function isSocialIconPlatform(platform: string | null | undefined): platform is SocialIconPlatform {
  return normalizeSocialPlatform(platform) !== null;
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

/** THE host table: platform → the domains that identify it. */
export const SOCIAL_PLATFORM_HOSTS: Partial<Record<SocialIconPlatform, readonly string[]>> = {
  github: ['github.com'],
  twitter: ['twitter.com', 'x.com'],
  reddit: ['reddit.com'],
  linkedin: ['linkedin.com'],
  luma: ['lu.ma'],
  whatsapp: ['whatsapp.com', 'wa.me'],
  slack: ['slack.com'],
  discord: ['discord.com', 'discord.gg'],
  telegram: ['telegram.org', 't.me'],
  youtube: ['youtube.com', 'youtu.be'],
  instagram: ['instagram.com'],
  facebook: ['facebook.com', 'fb.com'],
  tiktok: ['tiktok.com'],
};

/**
 * Classify a URL by its host. Returns `'website'` for a URL that parses but
 * matches no known platform, and `null` for something that is not a URL.
 */
export function classifySocialHost(url: string | null | undefined): SocialIconPlatform | null {
  if (!url) return null;
  let hostname: string;
  try {
    hostname = new URL(url.includes('://') ? url : `https://${url}`).hostname;
  } catch {
    return null;
  }
  for (const [platform, domains] of Object.entries(SOCIAL_PLATFORM_HOSTS)) {
    if (domains?.some(d => hostMatches(hostname, d))) return platform as SocialIconPlatform;
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
  platform: string
): T | undefined {
  const target = normalizeSocialPlatform(platform);
  if (!target || !links) return undefined;
  return links.find(link => normalizeSocialPlatform(link.platform) === target);
}
