'use client';

import { forwardRef, type HTMLAttributes } from 'react';
import { InfoCircleIcon } from '../icons-v2-generated';
import { AiAssistantInfo } from './ai-assistant-info';
import type { TicketEscalatedSegment } from './types/message.types';

const TITLE = 'Handed Off to a Technician';

/** Shown when the wire omits `text` (the field is nullable). */
const DEFAULT_BODY = 'A technician will reply when available.';

export interface TicketEscalatedMessageProps extends HTMLAttributes<HTMLDivElement> {
  data: TicketEscalatedSegment['data'];
  /** Timestamp of the message row this block came in on. */
  timestamp?: Date;
}

/**
 * Handoff receipt — the conversation now belongs to a human technician.
 * Figma `ai-assistant-info` (type=escalation); chrome and the wrapping/
 * truncation trade-offs live in the shared `AiAssistantInfo` shell.
 *
 * The body is whatever the backend authored, so the reason it gives stays
 * server-side; the client never composes an explanation and never branches on
 * `data.reason`, which is why a reason added server-side needs no change here.
 */
const TicketEscalatedMessage = forwardRef<HTMLDivElement, TicketEscalatedMessageProps>(
  ({ data, timestamp, ...props }, ref) => {
    const body = data.text?.trim() || DEFAULT_BODY;
    return (
      <AiAssistantInfo
        ref={ref}
        icon={<InfoCircleIcon className="size-6 text-ods-flamingo-pink" />}
        title={TITLE}
        body={body}
        timestamp={timestamp}
        {...props}
      />
    );
  },
);

TicketEscalatedMessage.displayName = 'TicketEscalatedMessage';

export { TicketEscalatedMessage };
