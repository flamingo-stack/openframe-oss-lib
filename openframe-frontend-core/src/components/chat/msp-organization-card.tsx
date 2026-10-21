'use client';

import type { ReactNode } from 'react';
import Link from '../../embed-shims/next-link';
import { cn } from '../../utils/cn';
import { ExternalLinkIcon } from '../icons-v2-generated';
import { TextLineSkeleton } from '../loading/unified-skeleton';
import { Button } from '../ui/button';
import { useLoadingScope } from '../ui/loading-scope';
import { SquareAvatar } from '../ui/square-avatar';

export interface MspOrganizationCardProps {
  /** MSP/organization name. Woven into the default title: "Your IT is managed by {name}". */
  name: string;
  /** Organization website shown beneath the title (e.g. "www.techflow.com"). */
  website?: string;
  /** Organization logo URL. Falls back to initials derived from `name` when absent. */
  logoUrl?: string;
  /** Full title override. Defaults to `Your IT is managed by {name}`. */
  title?: ReactNode;
  /**
   * Website link. When set, the trailing action renders as an anchor
   * (`<a href target="_blank">`). Takes precedence over `onOpenWebsite`.
   */
  href?: string;
  /** Click handler for the trailing action (used when `href` is not set). */
  onOpenWebsite?: () => void;
  /**
   * `card` (default): the welcome-screen card, title with the website beneath.
   * `footer`: the compact sidebar footer of the fae chat v2 layout, a caption
   * "Your IT is managed by" over the name, no website line, no card chrome.
   */
  variant?: 'card' | 'footer';
  /** The organization is still loading: the card draws its own skeleton (either variant). Inside a `LoadingScope` it
   *  does so whatever this says. */
  loading?: boolean;
  /** Appended to the root element. */
  className?: string;
}

/** The card's layout per variant, loaded and loading. */
// Inset ring (box-shadow) instead of `border` so the 1px stroke does not add to the box height — matches Figma's
// 80px frame (16 + 48 + 16) with its inside-aligned stroke. A real border would render 82px.
const CARD_FRAME_CLASS =
  'flex items-start gap-[var(--spacing-system-m)] rounded-md bg-ods-bg p-[var(--spacing-system-m)] ring-1 ring-inset ring-ods-border';
const FOOTER_FRAME_CLASS =
  'flex items-center gap-[var(--spacing-system-s)] px-[var(--spacing-system-m)] py-[var(--spacing-system-s)]';
const TEXT_STACK_CLASS = 'flex min-w-0 flex-1 flex-col';
const FOOTER_CAPTION = 'Your IT is managed by';
const FOOTER_CAPTION_CLASS = 'truncate text-ods-text-secondary text-h6';

/**
 * MSP Organization card for the AI Assistant welcome screen.
 *
 * A horizontal card — square org logo, "Your IT is managed by {name}" title with
 * the website beneath, and a trailing external-link button — so users can confirm
 * which organization they are signing into. Mirrors Figma `openframe — fae-chat`
 * (node 1:5540) using ODS tokens.
 *
 * The trailing button renders only when `href` or `onOpenWebsite` is provided:
 * `href` becomes an anchor (new tab), otherwise `onOpenWebsite` fires on click.
 *
 * ONE switch (`useLoadingScope() || loading`): while the organization is read the SAME card (either variant) draws
 * the logo in its loading form and its read text as bars (the footer's static caption stays real), and its link button
 * real and inert.
 */
export function MspOrganizationCard({
  name,
  website,
  logoUrl,
  title,
  href,
  onOpenWebsite,
  variant = 'card',
  loading: loadingProp = false,
  className,
}: MspOrganizationCardProps) {
  const loading = useLoadingScope() || loadingProp;
  const actionLabel = website ? `Open ${website}` : 'Open organization website';
  const footer = variant === 'footer';
  const buttonSize = footer ? 'icon-sm' : 'icon';

  const action = href ? (
    <Button asChild variant="outline" size={buttonSize} aria-label={actionLabel}>
      <Link href={href} target="_blank" rel="noreferrer noopener">
        <ExternalLinkIcon />
      </Link>
    </Button>
  ) : onOpenWebsite ? (
    <Button variant="outline" size={buttonSize} aria-label={actionLabel} onClick={onOpenWebsite}>
      <ExternalLinkIcon />
    </Button>
  ) : null;
  // The link button is static: drawn real while loading, inert.
  const trailing =
    action && loading ? (
      <span inert aria-hidden className="inline-flex shrink-0">
        {action}
      </span>
    ) : (
      action
    );

  if (footer) {
    return (
      <div className={cn(FOOTER_FRAME_CLASS, className)}>
        <SquareAvatar loading={loading} src={logoUrl} alt={name} fallback={name} size="sm" variant="square" />
        <div className={TEXT_STACK_CLASS}>
          <span className={FOOTER_CAPTION_CLASS}>{FOOTER_CAPTION}</span>
          {loading ? (
            <TextLineSkeleton type="h4" className="w-3/5" />
          ) : (
            <span className="truncate text-ods-text-primary text-h4">{title ?? name}</span>
          )}
        </div>
        {trailing}
      </div>
    );
  }

  return (
    <div className={cn(CARD_FRAME_CLASS, className)}>
      <SquareAvatar loading={loading} src={logoUrl} alt={name} fallback={name} size="lg" variant="square" />

      <div className={TEXT_STACK_CLASS}>
        {loading ? (
          <>
            <TextLineSkeleton type="h3" className="w-3/5" />
            <TextLineSkeleton type="h4" className="w-2/5" />
          </>
        ) : (
          <>
            <span className="truncate text-ods-text-primary text-h3">{title ?? `Your IT is managed by ${name}`}</span>
            {website ? <span className="truncate text-ods-text-secondary text-h4">{website}</span> : null}
          </>
        )}
      </div>

      {trailing}
    </div>
  );
}
