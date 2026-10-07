'use client';

import { useAssistantRuntime, type AssistantOpenRequest } from '../../contexts/assistant-runtime-context';
import { AskPrompts, type AskPromptsProps } from './ask-prompts';
import {
  assistantAvailable,
  ASK_PROMPTS_DEFAULT_COUNT,
  useAskPrompts,
  useAssistantOpen,
  useShownAskPrompts,
} from './hooks/use-ask-prompts';

export interface AssistantAskPromptsProps extends Pick<AskPromptsProps, 'align' | 'fadeColor' | 'className'> {
  /** What this row is about: any string the host's questions endpoint knows. Reported with every click. */
  topic?: string;
  /** How many questions the row offers: the same number of slots on every load. */
  count?: number;
  /** The launcher's name. Absent: the assistant's configured name, else the launcher's default. */
  label?: string;
  /** Something else the row waits for (the host is still reading the name it will show). */
  loading?: boolean;
  /** How the chat is opened from THIS row. Absent: the assistant runtime's opener. */
  onOpen?: (request: AssistantOpenRequest) => void;
}

/**
 * A row of questions for the host's assistant, wired by itself: the launcher
 * with the assistant's name and glyph, then the questions the host picked for
 * this row's `topic`, each opening the chat and asking it. Everything comes
 * from the nearest assistant runtime (`AssistantRuntimeContext`): whether a
 * chat is there, the identity, the questions endpoint and the opener. While
 * the pick is on its way the row is the SAME block (a chip skeleton in every
 * slot), so nothing moves when the questions land. The row tells the page
 * which questions it shows, so the FAQ's card never repeats one. Nothing
 * renders with no chat, or once the pick has settled empty.
 */
export function AssistantAskPrompts({
  topic,
  count = ASK_PROMPTS_DEFAULT_COUNT,
  label,
  loading = false,
  onOpen,
  align,
  fadeColor,
  className,
}: AssistantAskPromptsProps) {
  const assistant = useAssistantRuntime();
  const { prompts, isLoading, supported } = useAskPrompts({ topic, count });
  const open = useAssistantOpen(topic, onOpen);
  const shown = assistantAvailable(assistant) && supported;
  // Nothing to say where the row shows nothing; `null` while its pick is on its way.
  useShownAskPrompts(shown ? (isLoading ? null : prompts.map(prompt => prompt.id)) : undefined);
  if (!shown) return null;
  return (
    <AskPrompts
      prompts={prompts}
      loading={isLoading || loading}
      count={count}
      source={assistant.source}
      label={label ?? assistant.name ?? undefined}
      icon={assistant.icon}
      onOpen={open}
      onAsk={prompt => assistant.onAsk?.({ promptId: prompt.id, topic })}
      align={align}
      fadeColor={fadeColor}
      className={className}
    />
  );
}
