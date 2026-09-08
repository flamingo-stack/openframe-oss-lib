'use client';

import { forwardRef, type HTMLAttributes } from 'react';
import { CheckCircleIcon, InfoCircleIcon } from '../icons-v2-generated';
import { AiAssistantInfo } from './ai-assistant-info';
import { TICKET_EVENT_KIND, type TicketEventSegment } from './types/message.types';

/** Actor types the backend uses for the AI agent. Open set on the wire —
 *  compared case-insensitively; anything else is treated as a human. */
const AI_ACTOR_TYPES = new Set(['AI', 'AGENT', 'ASSISTANT', 'BOT']);

function isAiActor(actorType?: string): boolean {
  return !!actorType && AI_ACTOR_TYPES.has(actorType.toUpperCase());
}

/** `TICKET_ON_HOLD` → `Ticket On Hold` — neutral title for kinds this build
 *  does not know, which must still render (the vocabulary is open). */
function humanizeKind(kind: string): string {
  return kind
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

export interface TicketEventMessageProps extends HTMLAttributes<HTMLDivElement> {
  data: TicketEventSegment['data'];
  /** Timestamp of the message row this block came in on. */
  timestamp?: Date;
}

/** Where the ticket reopened INTO → the "who picks it up next" line.
 *  Kind-tokens per the lifecycle statuses; the vocabulary is open, so an
 *  unrecognized target falls back to the actor heuristic below. */
const REOPEN_TARGET_COPY: Record<string, string> = {
  AI_ASSISTANCE: 'The AI assistant will continue helping you in this conversation.',
  TECH_REQUIRED: 'A technician will reply when available.',
};

/**
 * Ticket lifecycle receipt — resolved / reopened / an unknown future kind.
 * Figma `ai-assistant-info` (type=resolved-fae | resolved-tech |
 * reopened-fae | reopened-tech | reopened-reason).
 *
 * Copy is composed client-side from the event's fields (unlike
 * `ticket_escalated`, whose body the backend authors):
 *   RESOLVED → "Resolved by {actorName}." under a green check;
 *   REOPENED → the reason when the wire carries one; otherwise who picks the
 *     conversation up next — `targetStatusKind` decides deterministically,
 *     with the `actorType` heuristic as the fallback for older backends
 *     that don't send the target;
 *   unknown kind → a neutral info line: humanized kind as the title, the
 *     reason or actor as the body. Never dropped — the vocabulary is open.
 */
const TicketEventMessage = forwardRef<HTMLDivElement, TicketEventMessageProps>(({ data, timestamp, ...props }, ref) => {
  const { kind, actorName, actorType, reason, targetStatusKind } = data;
  const resolved = kind === TICKET_EVENT_KIND.RESOLVED;
  const reopened = kind === TICKET_EVENT_KIND.REOPENED;

  const title = resolved ? 'Ticket Resolved' : reopened ? 'Ticket Reopened' : humanizeKind(kind);

  let body: string | undefined;
  if (resolved) {
    body = actorName ? `Resolved by ${actorName}.` : 'The ticket has been resolved.';
  } else if (reopened) {
    body =
      (reason ? `Reason: ${reason}` : undefined) ??
      (targetStatusKind ? REOPEN_TARGET_COPY[targetStatusKind] : undefined) ??
      (isAiActor(actorType)
        ? `${actorName || 'Fae'} will continue assisting in this conversation.`
        : 'A technician will reply when available.');
  } else {
    body = reason || (actorName ? `By ${actorName}.` : undefined);
  }

  const icon = resolved ? (
    <CheckCircleIcon className="size-6 text-ods-attention-green-success" />
  ) : (
    <InfoCircleIcon className="size-6 text-ods-flamingo-pink" />
  );

  return <AiAssistantInfo ref={ref} icon={icon} title={title} body={body} timestamp={timestamp} {...props} />;
});

TicketEventMessage.displayName = 'TicketEventMessage';

export { TicketEventMessage };
