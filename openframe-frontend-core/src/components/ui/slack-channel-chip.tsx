import React from 'react';
import { cn } from '../../utils/cn';
import { SlackIcon } from '../icons/slack-icon';

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
 * to the channel's web deep link. Server-component safe (no hooks/state).
 * Degrades gracefully: no name renders plain "Slack", no href renders unlinked.
 */
export function SlackChannelChip({ name, href, className }: SlackChannelChipProps) {
  const inner = (
    <span className={cn('inline-flex items-center gap-1 align-baseline text-ods-text-primary', className)}>
      <SlackIcon className="h-4 w-4 flex-shrink-0" />
      {name ? `#${name}` : 'Slack'}
    </span>
  );
  if (!href) return inner;
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className="hover:underline">
      {inner}
    </a>
  );
}
