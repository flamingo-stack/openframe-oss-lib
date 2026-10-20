'use client';

import Link from '../../embed-shims/next-link';
import { ICON_SIZE } from '../../styles/component-sizes';
import { cn } from '../../utils/cn';
import { SlackIcon } from '../icons-v2-generated/brand-logos/slack-icon';
import { TextLineSkeleton } from '../loading/unified-skeleton';
import { useLoadingScope } from './loading-scope';

/** The chip: Slack's mark, then the channel. Read by the chip and by its skeleton. */
const CHIP_CLASS = 'inline-flex items-center gap-1 align-baseline text-ods-text-primary';
const MARK_CLASS = `${ICON_SIZE.sm} flex-shrink-0`;

export interface SlackChannelChipProps {
  /** Channel display name, no '#' prefix. Falls back to plain "Slack" when null. */
  name?: string | null;
  /** Web deep link to the channel (e.g. https://app.slack.com/client/T…/C…). Renders unlinked when null. */
  href?: string | null;
  /** Extra classes merged onto the chip span. */
  className?: string;
}

/**
 * Inline Slack-channel reference: the Slack icon + "#name", optionally linked
 * to the channel's web deep link. In a page's loading state the channel is read: the chip is its skeleton.
 * Degrades gracefully: no name renders plain "Slack", no href renders unlinked.
 */
export function SlackChannelChip({ name, href, className }: SlackChannelChipProps) {
  if (useLoadingScope()) return <SlackChannelChipSkeleton className={className} />;
  const inner = (
    <span className={cn(CHIP_CLASS, className)}>
      <SlackIcon className={MARK_CLASS} />
      {name ? `#${name}` : 'Slack'}
    </span>
  );
  if (!href) return inner;
  return (
    <Link href={href} target="_blank" rel="noopener noreferrer" className="hover:underline">
      {inner}
    </Link>
  );
}

/** A SlackChannelChip while its channel is read: Slack's mark (static), the channel's name a bar of its line. */
export function SlackChannelChipSkeleton({ className }: { className?: string }) {
  return (
    <span className={cn(CHIP_CLASS, className)} aria-hidden>
      <SlackIcon className={MARK_CLASS} />
      <TextLineSkeleton type="inherit" as="span" className="inline-block w-24 align-bottom" />
    </span>
  );
}
