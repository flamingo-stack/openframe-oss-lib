'use client';

import { Mail, Music } from 'lucide-react';
import { normalizeSocialPlatform, type SocialIconLink, type SocialIconPlatform } from '../utils/social-platforms';
import {
  GitHubIcon,
  RedditIcon,
  XLogo,
  LinkedInIcon,
  LumaIcon,
  WhatsAppIcon,
  GlobeIcon,
  MessageCircleIcon,
  TelegramIcon,
  YouTubeIcon,
  InstagramIcon,
  FacebookIcon,
  SlackIcon,
  CopyIcon,
} from './icons';
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

type SocialIconComponent = (props: { className?: string }) => React.ReactElement;

/**
 * Platform → glyph. `satisfies Record<SocialIconPlatform, …>` makes a new
 * platform in the tuple a BUILD error here until it has an icon (the old
 * `switch` silently fell through to the globe).
 */
export const SOCIAL_ICON_COMPONENTS = {
  github: props => <GitHubIcon {...props} />,
  twitter: props => <XLogo {...props} />,
  reddit: props => <RedditIcon {...props} variant="white" />,
  linkedin: props => <LinkedInIcon {...props} />,
  luma: props => <LumaIcon {...props} />,
  whatsapp: props => <WhatsAppIcon {...props} />,
  email: props => <Mail {...props} />,
  website: props => <GlobeIcon {...props} />,
  slack: props => <SlackIcon {...props} injectedColor="white" />,
  discord: props => <MessageCircleIcon {...props} />,
  telegram: props => <TelegramIcon {...props} />,
  youtube: props => <YouTubeIcon {...props} />,
  instagram: props => <InstagramIcon {...props} />,
  facebook: props => <FacebookIcon {...props} />,
  tiktok: props => <Music {...props} />,
  // CopyIcon's default fill is grey and would mismatch its row-mates — force the
  // themed foreground via the ODS token (tracks the theme).
  copy: props => <CopyIcon {...props} color="var(--color-text-primary)" />,
} satisfies Record<SocialIconPlatform, SocialIconComponent>;

function renderSocialIcon(platform: string) {
  const key = normalizeSocialPlatform(platform) ?? 'website';
  const Icon = SOCIAL_ICON_COMPONENTS[key];
  return <Icon className="h-5 w-5" />;
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

  const rowClass = `flex flex-row items-center ${compact ? 'gap-2 w-fit' : 'gap-3 w-full'} ${className}`;

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
