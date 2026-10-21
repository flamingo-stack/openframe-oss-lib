'use client';

import type { ReactNode } from 'react';
import Link from '../../embed-shims/next-link';
import { cn } from '../../utils/cn';
import { ExternalLinkIcon } from '../icons-v2-generated';
import { InteractiveSkeleton, TextLineSkeleton } from '../loading/unified-skeleton';
import { Button } from '../ui/button';
import { useLoadingScope } from '../ui/loading-scope';
import { SquareAvatar, SquareAvatarSkeleton } from '../ui/square-avatar';

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

/** The card's layout per variant, read by the card and by its skeleton. */
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
 */
export function MspOrganizationCard({
  name,
  website,
  logoUrl,
  title,
  href,
  onOpenWebsite,
  variant = 'card',
  loading = false,
  className,
}: MspOrganizationCardProps) {
  const isLoading = useLoadingScope() || loading;
  if (isLoading) return <MspOrganizationCardSkeleton variant={variant} className={className} />;
  const actionLabel = website ? `Open ${website}` : 'Open organization website';

  if (variant === 'footer') {
    return (
      <div className={cn(FOOTER_FRAME_CLASS, className)}>
        <SquareAvatar src={logoUrl} alt={name} fallback={name} size="sm" variant="square" />
        <div className={TEXT_STACK_CLASS}>
          <span className={FOOTER_CAPTION_CLASS}>{FOOTER_CAPTION}</span>
          <span className="truncate text-ods-text-primary text-h4">{title ?? name}</span>
        </div>
        {href ? (
          <Button asChild variant="outline" size="icon-sm" aria-label={actionLabel}>
            <Link href={href} target="_blank" rel="noreferrer noopener">
              <ExternalLinkIcon />
            </Link>
          </Button>
        ) : onOpenWebsite ? (
          <Button variant="outline" size="icon-sm" aria-label={actionLabel} onClick={onOpenWebsite}>
            <ExternalLinkIcon />
          </Button>
        ) : null}
      </div>
    );
  }

  return (
    <div className={cn(CARD_FRAME_CLASS, className)}>
      <SquareAvatar src={logoUrl} alt={name} fallback={name} size="lg" variant="square" />

      <div className={TEXT_STACK_CLASS}>
        <span className="truncate text-ods-text-primary text-h3">{title ?? `Your IT is managed by ${name}`}</span>
        {website ? <span className="truncate text-ods-text-secondary text-h4">{website}</span> : null}
      </div>

      {href ? (
        <Button asChild variant="outline" size="icon" aria-label={actionLabel}>
          <Link href={href} target="_blank" rel="noreferrer noopener">
            <ExternalLinkIcon />
          </Link>
        </Button>
      ) : onOpenWebsite ? (
        <Button variant="outline" size="icon" aria-label={actionLabel} onClick={onOpenWebsite}>
          <ExternalLinkIcon />
        </Button>
      ) : null}
    </div>
  );
}

export interface MspOrganizationCardSkeletonProps {
  /** The card's variant, as the loaded card's (`card` by default). */
  variant?: 'card' | 'footer';
  /** Appended to the root element. */
  className?: string;
}

/**
 * {@link MspOrganizationCard} while the organization is read, in the card's own frame per variant: the logo's box,
 * the title (h3) over the website (h4) for the card, the static caption over the name (h4) for the footer, and the
 * trailing link button's box.
 */
export function MspOrganizationCardSkeleton({ variant = 'card', className }: MspOrganizationCardSkeletonProps) {
  if (variant === 'footer') {
    return (
      <div className={cn(FOOTER_FRAME_CLASS, className)}>
        <SquareAvatarSkeleton size="sm" variant="square" />
        <div className={TEXT_STACK_CLASS}>
          <span className={FOOTER_CAPTION_CLASS}>{FOOTER_CAPTION}</span>
          <TextLineSkeleton type="h4" className="w-3/5" />
        </div>
        <InteractiveSkeleton.Button size="icon-sm" className="shrink-0" />
      </div>
    );
  }
  return (
    <div className={cn(CARD_FRAME_CLASS, className)}>
      <SquareAvatarSkeleton size="lg" variant="square" />
      <div className={TEXT_STACK_CLASS}>
        <TextLineSkeleton type="h3" className="w-3/5" />
        <TextLineSkeleton type="h4" className="w-2/5" />
      </div>
      <InteractiveSkeleton.Button size="icon" className="shrink-0" />
    </div>
  );
}
