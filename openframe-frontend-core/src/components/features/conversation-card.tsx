import type { ReactNode } from 'react';
import { cn } from '../../utils/cn';
import { identityTint } from '../../utils/identity-tint';
import { ChatTurn } from '../chat/chat-turn';
import { CheckCircleIcon } from '../icons-v2-generated/signs-and-symbols/check-circle-icon';
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
  /** The footer's question ("Your part"). */
  footerLabel: string;
  /** The footer's answer ("Nothing", "One tap"). */
  footerValue: string;
  /** `attention` paints the answer in the warning colour: it needs a person. */
  footerTone?: 'default' | 'attention';
  /**
   * The responder's identity colour (a CSS colour, such as the hex an agent's
   * identity stores). It tints the card's border and surface, so a card reads
   * as that agent's at a glance.
   */
  accent?: string;
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
  accent,
  className,
}: ConversationCardProps) {
  return (
    <div
      className={cn(
        'flex h-full flex-col gap-[var(--spacing-system-mf)] overflow-hidden rounded-md border border-ods-border bg-ods-bg p-[var(--spacing-system-mf)]',
        className,
      )}
      style={identityTint(accent)}
    >
      {/* Every part keeps a fixed number of lines, so cards in a row or a carousel line up part by part. */}
      <ChatTurn avatar={requester.avatar} name={requester.name} meta={requester.meta} time={requester.time}>
        <p className="m-0 line-clamp-2 min-h-[2lh] text-ods-text-primary text-h3" title={request}>
          &ldquo;{request}&rdquo;
        </p>
      </ChatTurn>
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
      <div className="mt-auto flex items-center justify-between gap-[var(--spacing-system-sf)] text-ods-text-secondary text-h6">
        <span>{footerLabel}</span>
        <Tag as="span" label={footerValue} variant={footerTone === 'attention' ? 'warning' : 'badge'} />
      </div>
    </div>
  );
}
