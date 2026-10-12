'use client';

import { useState } from 'react';
import type { AssistantOpenRequest, AssistantRuntime } from '../../contexts/assistant-runtime-context';
import { useInView } from '../../hooks/ui/use-in-view';
import { AssistantAskPrompts } from '../chat/assistant-ask-prompts';
import { assistantAvailable } from '../chat/hooks/use-ask-prompts';

/** The card beside a FAQ, as a host may shape it. Every field is optional. */
export interface FaqAskOptions {
  /**
   * What this FAQ is about: ANY string the host's questions endpoint knows (it
   * is sent as `section`, and reported with every click). Questions written
   * for the topic are picked first. Whoever renders the FAQ passes it. Absent:
   * the entity the FAQ is attached to (`FaqSection`'s `entityType`). With
   * neither, the FAQ has no card: the lib names no topic of its own.
   */
  topic?: string;
  /**
   * Ids of questions never to offer. Absent: the ones the page's other "ask"
   * surfaces show, which the card waits for. `null`: wait.
   */
  exclude?: readonly string[] | null;
  /** How many questions the card offers. Absent: the runtime's, else three. */
  count?: number;
  /** The card's wording. `{assistant}` is replaced by the assistant's name. Absent: the runtime's, else the lib's. */
  title?: string;
  description?: string;
  /**
   * How the chat is opened and asked from THIS card. Absent: the assistant
   * runtime's `open`, else the `ask-ai:open` event of its source. A FAQ that
   * sits beside its own chat (an embedded one) passes that chat's opener.
   */
  onOpen?: (request: AssistantOpenRequest) => void;
}

/** How far below the viewport the card is when it picks its questions. */
const PICK_ROOT_MARGIN = '600px';

/** True when a FAQ under this runtime shows the card: a chat to open, and a name for the card's words. */
export function faqAskCardShown(assistant: AssistantRuntime | null): assistant is AssistantRuntime {
  return assistantAvailable(assistant) && !!assistant.name;
}

/**
 * The "ask the assistant" card of a FAQ: THE ask surface (`AssistantAskPrompts`)
 * as a card, told when to pick. It picks ONCE, when the card first comes near
 * the viewport: a visitor who never reaches the FAQ costs no request, and the
 * card then leaves out every question the page above already shows. The card
 * is the same height before and after the questions arrive.
 */
export function FaqAskCard({ topic, exclude, count, title, description, onOpen }: FaqAskOptions & { topic: string }) {
  const { ref, inView } = useInView<HTMLDivElement>({ rootMargin: PICK_ROOT_MARGIN });
  const [reached, setReached] = useState(false);
  if (inView && !reached) setReached(true);
  return (
    <div ref={ref}>
      <AssistantAskPrompts
        variant="card"
        topic={topic}
        count={count}
        exclude={exclude}
        enabled={reached}
        title={title}
        description={description}
        onOpen={onOpen}
      />
    </div>
  );
}
