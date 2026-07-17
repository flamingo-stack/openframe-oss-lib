"use client"

import { Mail } from 'lucide-react';
import { Button } from './ui/button';
import { GitHubIcon, XLogo, LinkedInIcon, LumaIcon, WhatsAppIcon, GlobeIcon, MessageCircleIcon, TelegramIcon, YouTubeIcon, InstagramIcon, FacebookIcon, SlackIcon, CopyIcon } from './icons';
import { RedditLogoIcon } from '@/components/icons-v2-generated';

/** Exactly ONE of `href` (anchor, target _blank) or `onClick` (action
 *  button — share popups via window.open inside the click gesture,
 *  copy-to-clipboard) — the discriminated union makes a dead no-action
 *  entry unrepresentable. */
type SocialLink = {
  platform: string;
  label?: string;
  /** `internal` links are only ever shown on surfaces that opt in (and must be
   *  gated server-side); with `groupByVisibility` they render after a divider. */
  visibility?: "external" | "internal";
} & (
  | { href: string; onClick?: never }
  | { onClick: () => void; href?: never }
);

interface SocialIconRowProps {
  className?: string;
  links?: SocialLink[];
  variant?: "accent" | "outline" | "transparent" | "destructive" | null | undefined;
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

const defaultLinks: SocialLink[] = [
  { platform: 'github', href: 'https://github.com/flamingo-stack', label: 'GitHub' },
  { platform: 'linkedin', href: 'https://linkedin.com/company/flamingo.run', label: 'LinkedIn' },
  { platform: 'facebook', href: 'https://www.facebook.com/flamingoai.msp', label: 'Facebook' }
];

function renderSocialIcon(platform: string) {
  const normalizedPlatform = platform.toLowerCase().trim();

  switch (normalizedPlatform) {
    case 'github':
      return <GitHubIcon className="w-5 h-5" />;
    case 'twitter':
    case 'x':
      return <XLogo className="w-5 h-5" />;
    case 'reddit':
      return <RedditLogoIcon className="w-5 h-5" />;
    case 'linkedin':
      return <LinkedInIcon className="w-5 h-5" />;
    case 'luma':
      return <LumaIcon className="w-5 h-5" />;
    case 'whatsapp':
      return <WhatsAppIcon className="w-5 h-5" />;
    case 'email':
    case 'mail':
      return <Mail className="w-5 h-5" />;
    case 'website':
    case 'web':
    case 'url':
      return <GlobeIcon className="w-5 h-5" />;
    case 'slack':
      return <SlackIcon className="w-5 h-5" injectedColor="white" />;
    case 'discord':
      return <MessageCircleIcon className="w-5 h-5" />;
    case 'telegram':
      return <TelegramIcon className="w-5 h-5" />;
    case 'youtube':
    case 'yt':
      return <YouTubeIcon className="w-5 h-5" />;
    case 'instagram':
    case 'ig':
      return <InstagramIcon className="w-5 h-5" />;
    case 'facebook':
    case 'fb':
      return <FacebookIcon className="w-5 h-5" />;
    case 'copy':
      // CopyIcon's default fill is grey and would mismatch its row-mates —
      // force the themed foreground via the ODS token (white on the dark
      // theme, tracking the theme unlike the literal the reddit/slack cases
      // still carry).
      return <CopyIcon className="w-5 h-5" color="var(--ods-text-primary)" />;
    default:
      return <GlobeIcon className="w-5 h-5" />;
  }
}

export function SocialIconRow({ className = '', links = defaultLinks, variant, compact = false, groupByVisibility = false }: SocialIconRowProps) {
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
  const resolvedVariant = variant !== undefined ? variant : (compact ? 'transparent' : 'outline');

  const renderButton = (link: SocialLink, index: number) => {
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

  const rowClass = `flex flex-row items-center ${compact ? 'gap-2 w-fit' : 'gap-3 w-full'} ${className}`;

  // Two-group mode: external links, a thin divider, then internal links — but only
  // when both groups are present (otherwise it's just a flat row, no stray divider).
  if (groupByVisibility) {
    const external = links.filter((l) => l.visibility !== 'internal');
    const internal = links.filter((l) => l.visibility === 'internal');
    if (external.length > 0 && internal.length > 0) {
      return (
        <div className={rowClass}>
          {external.map((l, i) => renderButton(l, i))}
          <span aria-hidden className="self-stretch w-px my-1 bg-ods-border shrink-0" />
          {internal.map((l, i) => renderButton(l, external.length + i))}
        </div>
      );
    }
  }

  return <div className={rowClass}>{links.map((link, index) => renderButton(link, index))}</div>;
}