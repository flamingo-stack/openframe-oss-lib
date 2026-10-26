'use client';

import { forwardRef, type HTMLAttributes } from 'react';
import { InfoCircleIcon } from '../icons-v2-generated';
import { SquareAvatar } from '../ui/square-avatar';
import { AiAssistantInfo } from './ai-assistant-info';

// The chat backend announces a technician taking the chat over (or handing it
// back) as a plain system line: "{name} joined the chat" / "{name} left the
// chat". The copy is fixed server-side, so these two shapes are the contract.
const JOINED = /^(.+) joined the chat$/;
const LEFT = /^(.+) left the chat$/;

export interface SystemEventMessageProps extends HTMLAttributes<HTMLDivElement> {
  /** The system line as the backend sent it. */
  text: string;
  timestamp?: Date;
}

/**
 * A system line in the fae chat v2 thread (`ai-assistant-info`,
 * type=direct-chat): a technician joining becomes "Technician Joined" with
 * their initials; any other line keeps its own wording under an info icon.
 */
const SystemEventMessage = forwardRef<HTMLDivElement, SystemEventMessageProps>(({ text, timestamp, ...props }, ref) => {
  const joined = JOINED.exec(text)?.[1];
  if (joined) {
    return (
      <AiAssistantInfo
        ref={ref}
        leading={<SquareAvatar alt={joined} fallback={joined} size="lg" variant="round" className="shrink-0" />}
        title="Technician Joined"
        body={`You're now chatting with ${joined}.`}
        timestamp={timestamp}
        {...props}
      />
    );
  }
  const left = LEFT.exec(text)?.[1];
  return (
    <AiAssistantInfo
      ref={ref}
      icon={<InfoCircleIcon className="size-6 text-ods-accent" />}
      title={left ? 'Technician Left' : text}
      body={left ? `${left} left the conversation.` : undefined}
      timestamp={timestamp}
      {...props}
    />
  );
});

SystemEventMessage.displayName = 'SystemEventMessage';

export { SystemEventMessage };
