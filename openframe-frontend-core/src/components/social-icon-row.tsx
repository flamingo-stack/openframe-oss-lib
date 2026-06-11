"use client"

import { Button } from './ui/button';
import { GitHubIcon, RedditIcon, XLogo, LinkedInIcon, LumaIcon, WhatsAppIcon, GlobeIcon, MessageCircleIcon, TelegramIcon, YouTubeIcon, InstagramIcon, FacebookIcon, SlackIcon, CopyIcon } from './icons';

/** Exactly ONE of `href` (anchor, target _blank) or `onClick` (action
 *  button — share popups via window.open inside the click gesture,
 *  copy-to-clipboard) — the discriminated union makes a dead no-action
 *  entry unrepresentable. */
type SocialLink = {
  platform: string;
  label?: string;
} & (
  | { href: string; onClick?: never }
  | { onClick: () => void; href?: never }
);

interface SocialIconRowProps {
  className?: string;
  links?: SocialLink[];
  variant?: "accent" | "outline" | "transparent" | "destructive" | null | undefined;
  /** Natural icon-button sizing (w-fit container, no flex-1 stretch) for
   *  page-level rows. Default false: buttons stretch across the container —
   *  the original card-width behavior (TMCG member cards, footers). */
  compact?: boolean;
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
      return <RedditIcon className="w-5 h-5" variant="white" />;
    case 'linkedin':
      return <LinkedInIcon className="w-5 h-5" />;
    case 'luma':
      return <LumaIcon className="w-5 h-5" />;
    case 'whatsapp':
      return <WhatsAppIcon className="w-5 h-5" />;
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
      // Explicit white like the reddit/slack cases — CopyIcon's default fill
      // is grey and would mismatch its white row-mates.
      return <CopyIcon className="w-5 h-5" color="white" />;
    default:
      return <GlobeIcon className="w-5 h-5" />;
  }
}

export function SocialIconRow({ className = '', links = defaultLinks, variant = 'outline', compact = false }: SocialIconRowProps) {
  return (
    <div className={`flex flex-row gap-3 ${compact ? 'w-fit' : 'w-full'} ${className}`}>
      {links.map((link, index) => {
        const ariaLabel = link.label || link.platform;
        return link.onClick ? (
          <Button
            key={index}
            type="button"
            variant={variant}
            size="icon"
            className={compact ? undefined : 'flex-1'}
            aria-label={ariaLabel}
            onClick={link.onClick}
          >
            {renderSocialIcon(link.platform)}
          </Button>
        ) : (
          <Button
            key={index}
            asChild
            variant={variant}
            size="icon"
            className={compact ? undefined : 'flex-1'}
          >
            <a
              href={link.href}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={ariaLabel}
            >
              {renderSocialIcon(link.platform)}
            </a>
          </Button>
        );
      })}
    </div>
  );
}