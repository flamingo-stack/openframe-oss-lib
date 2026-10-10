'use client';

import {
  AssistantRuntimeContext,
  useAssistantRuntime,
  type AssistantOpenRequest,
} from '../../contexts/assistant-runtime-context';
import { AskCard, AskPrompts, type AskPromptsProps } from './ask-prompts';
import { assistantAvailable, ASK_PROMPTS_DEFAULT_COUNT, useAskSurface } from './hooks/use-ask-prompts';

/** The lib's own wording of the card, when neither the host nor the runtime states it. */
const DEFAULT_ASK_CARD = {
  title: 'Still deciding?',
  description: '{assistant} answers from our docs and customer stories.',
} as const;

const fillAssistant = (text: string, name: string) => text.split('{assistant}').join(name);

export interface AssistantAskPromptsProps extends Pick<AskPromptsProps, 'align' | 'fadeColor' | 'className'> {
  /**
   * How the surface looks. `row` (default): the launcher, then the questions,
   * for a page section. `card`: the "still deciding?" card beside a list of
   * questions (a FAQ), with a title, a line of description and the launcher.
   */
  variant?: 'row' | 'card';
  /** What this surface is about: any string the host's questions endpoint knows. Reported with every click. */
  topic?: string;
  /** How many questions it offers: the same number of slots on every load. Absent: three (a card: the runtime's, else three). */
  count?: number;
  /**
   * Ids of questions never to offer. Absent: the ones the page's other "ask"
   * surfaces show, which this one waits for. `null`: wait.
   */
  exclude?: readonly string[] | null;
  /** False: the surface does not pick yet (its host is waiting for it to be reached). Default true. */
  enabled?: boolean;
  /** The launcher's name. Absent: the assistant's configured name, else the launcher's default. */
  label?: string;
  /** Something else the surface waits for (the host is still reading the name it will show). */
  loading?: boolean;
  /** A card's wording. `{assistant}` is replaced by the assistant's name. Absent: the runtime's, else the lib's. */
  title?: string;
  description?: string;
  /** How the chat is opened from THIS surface. Absent: the assistant runtime's opener. */
  onOpen?: (request: AssistantOpenRequest) => void;
}

/**
 * THE "ask the assistant" surface, wired by itself: a row of questions in a
 * page section, or the card beside a FAQ (`variant`). Everything comes from
 * the nearest assistant runtime (`AssistantRuntimeContext`) through ONE hook,
 * `useAskSurface`: whether a chat is there, the identity, the questions the
 * host picked for this surface's `topic`, the opener and the click report.
 * Surfaces of one page pick one after another and never show a question
 * another already shows, so two of them may share a topic. While a pick is on
 * its way the surface is the SAME block (a chip skeleton in every slot), so
 * nothing moves when the questions land.
 *
 * Nothing renders with no chat. A row also renders nothing with no questions
 * endpoint, or once its pick has settled empty; a card needs the assistant's
 * name for its words, and with no endpoint is the launcher alone.
 */
export function AssistantAskPrompts({
  variant = 'row',
  topic,
  count,
  exclude,
  enabled,
  label,
  loading = false,
  title,
  description,
  onOpen,
  align,
  fadeColor,
  className,
}: AssistantAskPromptsProps) {
  const card = variant === 'card';
  const assistant = useAssistantRuntime();
  const slots = count ?? (card ? assistant?.askCard?.count : undefined) ?? ASK_PROMPTS_DEFAULT_COUNT;
  const ask = useAskSurface({ topic, count: slots, exclude, enabled, onOpen });
  if (!assistantAvailable(assistant)) return null;

  const shared = {
    prompts: ask.prompts,
    loading: ask.isLoading || loading,
    source: assistant.source,
    icon: assistant.icon,
    onOpen: ask.open,
    onAsk: ask.reportAsk,
  };
  if (card) {
    const name = label ?? assistant.name;
    if (!name) return null;
    const words = description ?? assistant.askCard?.description ?? DEFAULT_ASK_CARD.description;
    return (
      <AssistantRuntimeContext.Provider value={ask.scoped}>
        <AskCard
          {...shared}
          title={fillAssistant(title ?? assistant.askCard?.title ?? DEFAULT_ASK_CARD.title, name)}
          description={words ? fillAssistant(words, name) : undefined}
          // Fixed slots, one question per row: chip skeletons until the pick lands, the same box after.
          count={ask.supported ? slots : 0}
          label={name}
          className={className}
        />
      </AssistantRuntimeContext.Provider>
    );
  }
  if (!ask.supported) return null;
  return (
    <AssistantRuntimeContext.Provider value={ask.scoped}>
      <AskPrompts
        {...shared}
        count={slots}
        label={label ?? assistant.name ?? undefined}
        align={align}
        fadeColor={fadeColor}
        className={className}
      />
    </AssistantRuntimeContext.Provider>
  );
}
