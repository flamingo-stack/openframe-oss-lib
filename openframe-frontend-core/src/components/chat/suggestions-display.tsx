'use client';

import { useChatPanel } from './chat-panel-context';
import { QuickActionChipButton } from './quick-action-chip';
import type { SuggestionsSegment } from './types/message.types';

export interface SuggestionsDisplayProps {
  segment: SuggestionsSegment;
}

/**
 * A `suggestions` segment: each group's caption over a wrapping row of
 * sentence chips, then the optional note. A chip hands its prompt to the
 * segment's `onPick`, else to the composer of the chat panel it sits in.
 */
export function SuggestionsDisplay({ segment }: SuggestionsDisplayProps) {
  const panel = useChatPanel();
  const pick = segment.onPick ?? panel?.fillComposer;

  return (
    <div className="flex min-w-0 flex-col gap-[var(--spacing-system-sf)]">
      {segment.groups.map(group => (
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
      {segment.note && <p className="text-ods-text-secondary text-h6">{segment.note}</p>}
    </div>
  );
}
