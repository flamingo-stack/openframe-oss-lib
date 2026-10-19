'use client';

import { createElement } from 'react';
import { normalizeSocialPlatform, type SocialIconLink } from '../utils/social-platforms';
import { iconOf, type IconComponent, type IconRef } from './chat/utils/icon-loading';
import { Button } from './ui/button';

/** Re-exported for call sites that already import the link type from this module. */
export type { SocialIconLink };

interface SocialIconRowProps {
  className?: string;
  links?: SocialIconLink[];
  variant?: 'accent' | 'outline' | 'transparent' | 'destructive' | null | undefined;
  /** Quiet metadata row for page-level identity/share slots: 32px ghost
   *  icon buttons (size="icon-sm", 16px glyphs), gap-2, w-fit container,
   *  variant defaulting to "transparent" (an explicit `variant` still wins).
   *  Default false: 44/48px buttons stretching across the container —
   *  the original card-width behavior (TMCG member cards, footers). */
  compact?: boolean;
  /** Render the `external` links and the `internal` links as two groups split
   *  by a thin divider (only when BOTH groups are non-empty). Visibility is
   *  presentation-only here — the caller must still gate which links it passes
   *  server-side. Default false keeps a single flat row. */
  groupByVisibility?: boolean;
}

const defaultLinks: SocialIconLink[] = [
  { platform: 'github', href: 'https://github.com/flamingo-stack', label: 'GitHub' },
  { platform: 'linkedin', href: 'https://linkedin.com/company/flamingo.run', label: 'LinkedIn' },
  { platform: 'facebook', href: 'https://www.facebook.com/flamingoai.msp', label: 'Facebook' },
];

/** The colour a social mark is drawn in: the themed foreground, so a row reads as one set. */
const MARK = 'var(--color-text-primary)';

/**
 * Platform name → the icon it draws, as DATA: the icon is loaded when a link to
 * that platform is drawn, so a row fetches only the marks of its own links. The
 * ONLY thing about a social platform that lives in code; the DB names the glyph
 * it wants through `social_platforms.icon_name`.
 *
 * Deliberately an OPEN record, not `satisfies Record<SomeUnion, …>`: the set of
 * platforms is the `social_platforms` table's to decide, and a row added there
 * must render — with the globe, until somebody adds art for it — rather than
 * fail to type-check against a list in this file.
 */
const SOCIAL_ICONS: Readonly<Record<string, IconRef>> = {
  github: { set: 'GithubClassicIcon' },
  twitter: { set: 'XLogoIcon' },
  reddit: { set: 'RedditIcon', color: MARK },
  linkedin: { set: 'LinkedinClassicIcon' },
  luma: { set: 'LumaIcon' },
  whatsapp: { set: 'WhatsappIcon' },
  email: { lucide: 'mail' },
  website: { set: 'GlobeIcon' },
  slack: { set: 'SlackMonoIcon', color: MARK },
  discord: { set: 'MessageCircleIcon' },
  telegram: { set: 'TelegramIcon' },
  youtube: { set: 'YoutubeClassicIcon' },
  instagram: { set: 'InstagramIcon', color: MARK },
  facebook: { set: 'FacebookIcon', color: MARK },
  tiktok: { lucide: 'music' },
  // CopyIcon's default fill is grey and would mismatch its row-mates.
  copy: { set: 'CopyIcon', color: MARK },
};

/** The icon of a social platform, or `undefined` for a platform with no art yet. */
export function socialIcon(platform: string): IconComponent | undefined {
  if (!Object.prototype.hasOwnProperty.call(SOCIAL_ICONS, platform)) return undefined;
  return iconOf(SOCIAL_ICONS[platform]) ?? undefined;
}

/** The globe stands in for any platform with no art yet — never a blank slot. */
function renderSocialIcon(platform: string) {
  const key = normalizeSocialPlatform(platform) ?? 'website';
  // The icon's own component, loaded by the platform's name (drawn through `createElement`: not a component made here).
  const icon = socialIcon(key) ?? socialIcon('website');
  return icon ? createElement(icon, { className: 'h-5 w-5' }) : null;
}

/** The row's box: what a caller's loading state draws its skeleton buttons in, so they sit where the row's buttons do. */
export function socialIconRowClass(compact = false): string {
  return `flex flex-row items-center ${compact ? 'gap-2 w-fit' : 'gap-3 w-full'}`;
}

export function SocialIconRow({
  className = '',
  links = defaultLinks,
  variant,
  compact = false,
  groupByVisibility = false,
}: SocialIconRowProps) {
  // ── Compact design rationale ──────────────────────────────────────────
  // Page-level identity/share rows read as METADATA, not CTAs. The major
  // design systems converge on one recipe for this slot: a ~32px ghost icon
  // button with a ~16px glyph, tight 8px gap, transparent at rest, subtle
  // background state-layer on hover (Carbon "ghost" sm, Primer "invisible"
  // medium, shadcn ghost+icon-sm — all 32px; Material 3 "standard" icon
  // button = state-layer hover). Author headers on content platforms
  // (Medium / dev.to / Substack) use the same quiet treatment. Hence
  // compact: size="icon-sm" + variant defaulting to "transparent" — the
  // hover affordance comes from the bg state layer (hover:bg-ods-bg-hover
  // inside the variant) because the brand icons carry fixed fills, not
  // currentColor. An explicit `variant` prop still wins (e.g. outline
  // chips). Non-compact keeps the legacy outline default + full-width
  // stretch untouched.
  const resolvedVariant = variant !== undefined ? variant : compact ? 'transparent' : 'outline';

  const renderButton = (link: SocialIconLink, index: number) => {
    const ariaLabel = link.label || link.platform;
    return link.onClick ? (
      <Button
        key={index}
        type="button"
        variant={resolvedVariant}
        size={compact ? 'icon-sm' : 'icon'}
        className={compact ? undefined : 'flex-1'}
        aria-label={ariaLabel}
        onClick={link.onClick}
      >
        {renderSocialIcon(link.platform)}
      </Button>
    ) : (
      // Props-based linking — Button renders the anchor itself
      // (openInNewTab carries target="_blank" + rel="noopener noreferrer");
      // no asChild/<a> nesting.
      <Button
        key={index}
        variant={resolvedVariant}
        size={compact ? 'icon-sm' : 'icon'}
        className={compact ? undefined : 'flex-1'}
        href={link.href}
        openInNewTab
        aria-label={ariaLabel}
      >
        {renderSocialIcon(link.platform)}
      </Button>
    );
  };

  const rowClass = `${socialIconRowClass(compact)} ${className}`;

  // Two-group mode: external links, a thin divider, then internal links — but only
  // when both groups are present (otherwise it's just a flat row, no stray divider).
  if (groupByVisibility) {
    const external = links.filter(l => l.visibility !== 'internal');
    const internal = links.filter(l => l.visibility === 'internal');
    if (external.length > 0 && internal.length > 0) {
      return (
        <div className={rowClass}>
          {external.map((l, i) => renderButton(l, i))}
          <span aria-hidden className="my-1 w-px shrink-0 self-stretch bg-ods-border" />
          {internal.map((l, i) => renderButton(l, external.length + i))}
        </div>
      );
    }
  }

  return <div className={rowClass}>{links.map((link, index) => renderButton(link, index))}</div>;
}
