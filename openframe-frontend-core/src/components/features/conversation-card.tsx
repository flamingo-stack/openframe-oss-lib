'use client';

import { type ReactNode, useId } from 'react';
import { cn } from '../../utils/cn';
import { useAgentTint } from '../agent-identity';
import { ChatTurn } from '../chat/chat-turn';
import { CheckCircleIcon } from '../icons-v2-generated/signs-and-symbols/check-circle-icon';
import { CheckIcon } from '../icons-v2-generated/signs-and-symbols/check-icon';
import { PlusIcon } from '../icons-v2-generated/signs-and-symbols/plus-icon';
import { Tag } from '../ui/tag';

export interface ConversationCardSpeaker {
  /** Rendered as given (an avatar, an agent mark). */
  avatar: ReactNode;
  name: string;
  /** A quieter word after the name ("on her laptop", "this computer"). */
  meta?: string;
  /** When they spoke, as shown ("2:47 PM"). */
  time?: string;
}

export interface ConversationCardProps {
  requester: ConversationCardSpeaker;
  /** What they said. */
  request: string;
  responder: ConversationCardSpeaker;
  /** What was done about it. */
  outcome: string;
  /** Beside the outcome (the person who approved it). */
  outcomeAside?: ReactNode;
  /**
   * Between the request and the answer: how it is today, before the agent
   * ("Today" and a line). A pain card's status quo; omitted on a request card.
   */
  context?: { label: string; text: string };
  /** The footer's question ("Your part"). Omitted: no footer. */
  footerLabel?: string;
  /** The footer's answer ("Nothing", "One tap"). */
  footerValue?: string;
  /** `attention` paints the answer in the warning colour: it needs a person. */
  footerTone?: 'default' | 'attention';
  /**
   * The slug of the agent that answered. The card takes that agent's tint from
   * its identity, so it reads as that agent's at a glance. A card names its
   * agent, never a colour.
   */
  agent?: string | null;
  /**
   * The card is a toggle the reader picks ("this sounds like me"): one button
   * with `aria-pressed`, named by the request, stretched over the whole card so
   * a tap anywhere toggles it; a mark in its corner says whether it is picked,
   * and a picked card takes the accent ring.
   */
  selection?: { pressed: boolean; onToggle: () => void };
  className?: string;
}

/**
 * A request and what was done about it, as two turns and a footer: who asked
 * and what they said, who answered and the result (a command block with its
 * check), then one line that sums up the reader's own part in it.
 */
export function ConversationCard({
  requester,
  request,
  responder,
  outcome,
  outcomeAside,
  footerLabel,
  footerValue,
  footerTone = 'default',
  agent,
  selection,
  context,
  className,
}: ConversationCardProps) {
  const tint = useAgentTint(agent);
  const requestId = useId();
  return (
    <div
      className={cn(
        'relative flex h-full flex-col gap-[var(--spacing-system-mf)] overflow-hidden rounded-md border border-ods-border bg-ods-bg p-[var(--spacing-system-mf)]',
        selection && 'transition-colors hover:border-ods-text-secondary',
        selection?.pressed && 'border-ods-accent ring-1 ring-ods-accent',
        className,
      )}
      style={tint}
    >
      {selection && (
        // ONE toggle, over the whole card: the card's text is its content, not a button's.
        <button
          type="button"
          aria-pressed={selection.pressed}
          aria-labelledby={requestId}
          onClick={selection.onToggle}
          className="absolute inset-0 z-10 cursor-pointer rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ods-focus"
        >
          <span
            aria-hidden
            className={cn(
              'absolute right-[var(--spacing-system-mf)] top-[var(--spacing-system-mf)] flex size-6 items-center justify-center rounded-sm border',
              selection.pressed
                ? 'border-ods-accent bg-ods-accent text-ods-text-on-accent'
                : 'border-ods-border text-ods-text-secondary',
            )}
          >
            {selection.pressed ? <CheckIcon size={14} /> : <PlusIcon size={14} />}
          </span>
        </button>
      )}
      {/* Every part keeps a fixed number of lines, so cards in a row or a carousel line up part by part. */}
      <ChatTurn avatar={requester.avatar} name={requester.name} meta={requester.meta} time={requester.time}>
        <p
          id={requestId}
          className={cn(
            'm-0 line-clamp-2 min-h-[2lh] text-ods-text-primary text-h3',
            // Clears the corner mark: its width plus a gap.
            selection && 'pr-[calc(var(--spacing-system-lf)+var(--spacing-system-xsf))]',
          )}
          title={request}
        >
          &ldquo;{request}&rdquo;
        </p>
      </ChatTurn>
      {context && (
        <div className="flex flex-col gap-[var(--spacing-system-xxs)] border-ods-border border-t pt-[var(--spacing-system-sf)]">
          <span className="text-ods-text-secondary text-h6">{context.label}</span>
          <p className="m-0 line-clamp-3 min-h-[3lh] text-ods-text-secondary text-h4" title={context.text}>
            {context.text}
          </p>
        </div>
      )}
      {/* The answer is a command block: who did it, what was done, and its check. */}
      <ChatTurn
        avatar={responder.avatar}
        name={responder.name}
        meta={responder.meta}
        time={responder.time}
        className="rounded-md border border-ods-border bg-ods-card p-[var(--spacing-system-sf)]"
      >
        <div className="flex items-start gap-[var(--spacing-system-xsf)] text-ods-text-secondary text-h4">
          <span className="line-clamp-3 min-h-[3lh] min-w-0 flex-1" title={outcome}>
            {outcome}
          </span>
          {outcomeAside}
          <span className="flex h-[1lh] shrink-0 items-center">
            <CheckCircleIcon size={16} className="text-ods-success" aria-hidden />
          </span>
        </div>
      </ChatTurn>
      {footerLabel && footerValue && (
        <div className="mt-auto flex items-center justify-between gap-[var(--spacing-system-sf)] text-ods-text-secondary text-h6">
          <span>{footerLabel}</span>
          <Tag as="span" label={footerValue} variant={footerTone === 'attention' ? 'warning' : 'badge'} />
        </div>
      )}
    </div>
  );
}
