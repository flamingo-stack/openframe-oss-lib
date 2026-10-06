import type { ReactNode } from 'react';
import { cn } from '../../utils/cn';
import { CheckCircleIcon } from '../icons-v2-generated/signs-and-symbols/check-circle-icon';

export interface ConversationCardSpeaker {
  /** Rendered as given (an avatar, an agent mark). */
  avatar: ReactNode;
  name: string;
  /** A quieter word after the name ("on her laptop", "this computer"). */
  meta?: string;
}

export interface ConversationCardProps {
  requester: ConversationCardSpeaker;
  /** What they said, shown in quotation marks. */
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
  className?: string;
}

function Who({ speaker }: { speaker: ConversationCardSpeaker }) {
  return (
    <div className="flex items-baseline gap-2 text-ods-text-primary text-h4">
      {speaker.name}
      {speaker.meta && <span className="text-ods-text-secondary text-h6">{speaker.meta}</span>}
    </div>
  );
}

/**
 * A request and what was done about it, as two turns and a footer: who asked
 * and what they said, who answered and the result, then one line that sums up
 * the reader's own part in it.
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
  className,
}: ConversationCardProps) {
  return (
    <div
      className={cn('flex h-full flex-col gap-4 rounded-xl border border-ods-border bg-ods-card p-5 md:p-7', className)}
    >
      <div className="flex items-start gap-3">
        <span className="shrink-0">{requester.avatar}</span>
        <div className="min-w-0 flex-1">
          <Who speaker={requester} />
          {/* Every part keeps a fixed number of lines, so cards in a row or a carousel line up part by part. */}
          <p className="m-0 mt-1 line-clamp-2 min-h-[2lh] text-ods-text-primary text-h3" title={request}>
            &ldquo;{request}&rdquo;
          </p>
        </div>
      </div>
      <div className="flex items-start gap-3 rounded-md border border-ods-border bg-ods-bg p-3.5">
        <span className="shrink-0">{responder.avatar}</span>
        <div className="min-w-0 flex-1">
          <Who speaker={responder} />
          <div className="mt-1 flex items-start gap-2 text-ods-text-secondary text-h4">
            <CheckCircleIcon size={16} className="mt-1 shrink-0 text-ods-success" aria-hidden />
            <span className="line-clamp-3 min-h-[3lh] min-w-0 flex-1" title={outcome}>
              {outcome}
            </span>
            {outcomeAside}
          </div>
        </div>
      </div>
      <div className="mt-auto flex items-center justify-between gap-3 border-t border-ods-border pt-3.5 text-ods-text-secondary text-h6">
        <span>{footerLabel}</span>
        <span
          className={cn(
            'inline-flex whitespace-nowrap rounded-full border px-3 py-1',
            footerTone === 'attention'
              ? 'border-ods-warning text-ods-warning'
              : 'border-ods-border text-ods-text-secondary',
          )}
        >
          {footerValue}
        </span>
      </div>
    </div>
  );
}
