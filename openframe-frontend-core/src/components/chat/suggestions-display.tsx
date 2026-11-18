'use client';

import type { ChatSuggestionsPart } from '../../chat-protocol/chat-message';
import { useChatPanel } from './chat-panel-context';
import { QuickActionChipButton } from './quick-action-chip';

export interface SuggestionsDisplayProps {
  data: ChatSuggestionsPart['data'];
  /** Where a picked prompt goes: the message's `actions.pickSuggestion`. Absent: sent in the chat panel it sits in. */
  onPick?: (prompt: string) => void;
}

/**
 * A `data-suggestions` part: each group's caption over a wrapping row of
 * sentence chips, then the optional note.
 */
export function SuggestionsDisplay({ data, onPick }: SuggestionsDisplayProps) {
  const panel = useChatPanel();
  const pick = onPick ?? panel?.sendPrompt;

  return (
    <div className="flex min-w-0 flex-col gap-[var(--spacing-system-sf)]">
      {data.groups.map(group => (
        <div key={group.label} className="flex min-w-0 flex-col gap-[var(--spacing-system-xs)]">
          <p className="text-ods-text-secondary text-h5">{group.label}</p>
          <div className="flex min-w-0 flex-wrap gap-[var(--spacing-system-xs)]">
            {group.prompts.map(prompt => (
              <QuickActionChipButton
                key={prompt.label}
                variant="question"
                label={prompt.label}
                icon={prompt.icon}
                onSelect={pick ? () => pick(prompt.prompt ?? prompt.label) : undefined}
              />
            ))}
          </div>
        </div>
      ))}
      {data.note && <p className="text-ods-text-secondary text-h6">{data.note}</p>}
    </div>
  );
}
