'use client';

import { useState } from 'react';
import {
  useAssistantRuntime,
  type AssistantOpenRequest,
  type AssistantRuntime,
} from '../../contexts/assistant-runtime-context';
import { useInView } from '../../hooks/ui/use-in-view';
import { AskCard } from '../chat/ask-prompts';
import {
  assistantAvailable,
  ASK_PROMPTS_DEFAULT_COUNT,
  useAskPrompts,
  useAssistantOpen,
  useShownAskPromptIds,
} from '../chat/hooks/use-ask-prompts';

/** The card beside a FAQ, as a host may shape it. Every field is optional. */
export interface FaqAskOptions {
  /**
   * What this FAQ is about: ANY string the host's questions endpoint knows (it
   * is sent as `section`, and reported with every click). Questions written
   * for the topic are picked first. Absent: the FAQ's `entityType`, else
   * general questions.
   */
  topic?: string;
  /**
   * Ids of questions never to offer. Absent: the ones the page's other "ask"
   * surfaces show (`AssistantAskPrompts` rows say so themselves), which the
   * card waits for. `null`: wait.
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

/** The lib's own wording, when neither the host nor the runtime states it. */
const DEFAULT_ASK_CARD = {
  title: 'Still deciding?',
  description: '{assistant} answers from our docs and customer stories.',
} as const;

/** How far below the viewport the card is when it picks its questions. */
const PICK_ROOT_MARGIN = '600px';

const fillAssistant = (text: string, name: string) => text.split('{assistant}').join(name);

/** True when a FAQ under this runtime shows the card: a chat to open, and a name for the card's words. */
export function faqAskCardShown(assistant: AssistantRuntime | null): assistant is AssistantRuntime {
  return assistantAvailable(assistant) && !!assistant.name;
}

/**
 * The "ask the assistant" card of a FAQ: the assistant's identity and the
 * chat's opener from the nearest assistant runtime, its questions from the
 * host's endpoint. It picks ONCE, when the card first comes near the viewport:
 * by then the page above has said which questions it shows itself, and a
 * visitor who never reaches the FAQ costs no request. The card is the same
 * height before and after the questions arrive. A host with no questions
 * endpoint gets the launcher with no questions.
 */
export function FaqAskCard({ topic, exclude, count, title, description, onOpen }: FaqAskOptions) {
  const assistant = useAssistantRuntime();
  const { ref, inView } = useInView<HTMLDivElement>({ rootMargin: PICK_ROOT_MARGIN });
  const [reached, setReached] = useState(false);
  if (inView && !reached) setReached(true);

  const shownElsewhere = useShownAskPromptIds();
  const excluded = exclude === undefined ? shownElsewhere : exclude;
  const slots = count ?? assistant?.askCard?.count ?? ASK_PROMPTS_DEFAULT_COUNT;
  const { prompts, isLoading, supported } = useAskPrompts({
    topic,
    count: slots,
    exclude: excluded ?? undefined,
    enabled: reached && excluded !== null,
  });
  const open = useAssistantOpen(topic, onOpen);

  if (!faqAskCardShown(assistant) || !assistant.name) return null;
  const name = assistant.name;
  const cardDescription = description ?? assistant.askCard?.description ?? DEFAULT_ASK_CARD.description;
  return (
    <div ref={ref}>
      <AskCard
        title={fillAssistant(title ?? assistant.askCard?.title ?? DEFAULT_ASK_CARD.title, name)}
        description={cardDescription ? fillAssistant(cardDescription, name) : undefined}
        prompts={prompts}
        // Fixed slots, one question per row: chip skeletons until the pick lands, the same box after.
        count={supported ? slots : 0}
        loading={isLoading}
        source={assistant.source}
        label={name}
        icon={assistant.icon}
        onOpen={open}
        onAsk={prompt => assistant.onAsk?.({ promptId: prompt.id, topic })}
      />
    </div>
  );
}
