'use client';

import type { ReactNode } from 'react';
import { cn } from '../../utils/cn';
import { AgentMark } from '../agent-mark';
import { MingoAiButton, openAskAi } from '../navigation/mingo-ai-button';
import { QuickActionChipButton, type QuickActionIconSpec } from './quick-action-chip';

/** One question a page offers: the chip shows `label`, the chat is sent `prompt`. */
export interface AskPrompt {
  id: string;
  label: string;
  /** What is sent to the chat. Absent: the label itself. */
  prompt?: string;
  icon?: ReactNode | QuickActionIconSpec;
}

export interface AskPromptsProps {
  prompts: readonly AskPrompt[];
  /** The chat source the page's chat panel runs on (the `ask-ai:open` filter). */
  source?: string;
  /** The assistant's configured name, shown before the chips ("Ask Mingo"). */
  label: string;
  /** The assistant's configured glyph. Absent: the packaged Mingo mark. */
  icon?: ReactNode;
  /** After the chat was asked (analytics). */
  onAsk?: (prompt: AskPrompt) => void;
  className?: string;
}

function AssistantGlyph({ icon, className }: { icon?: ReactNode; className: string }) {
  return (
    <span className={cn('inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full', className)}>
      {icon ?? <AgentMark agent="mingo" className="size-full" />}
    </span>
  );
}

/**
 * A row of questions that open the site chat and ask it: the assistant's mark
 * and name, then one quick-action chip per prompt. A click opens the chat and
 * sends that prompt once (`openAskAi` with a prompt). With no prompt it renders
 * nothing.
 */
export function AskPrompts({ prompts, source, label, icon, onAsk, className }: AskPromptsProps) {
  if (prompts.length === 0) return null;
  return (
    <div className={cn('flex flex-wrap items-center gap-2', className)}>
      <span className="flex items-center gap-2 pr-1 text-ods-text-secondary text-h6">
        <AssistantGlyph icon={icon} className="size-5" />
        {label}
      </span>
      {prompts.map(prompt => (
        <QuickActionChipButton
          key={prompt.id}
          label={prompt.label}
          icon={prompt.icon}
          onSelect={() => {
            openAskAi(source, { prompt: prompt.prompt ?? prompt.label });
            onAsk?.(prompt);
          }}
        />
      ))}
    </div>
  );
}

export interface AskCardProps extends Omit<AskPromptsProps, 'label' | 'className'> {
  title: string;
  description?: string;
  /** The assistant's configured name: the launcher's label. */
  label: string;
  /** Show the Cmd+K / Ctrl+K key cap on the launcher. Default false: a page binds it once, in its header. */
  shortcutHint?: boolean;
  className?: string;
}

/**
 * The "still deciding?" card beside a list of questions: the assistant's mark,
 * a title, a line of description, the page's prompts and the chat launcher.
 */
export function AskCard({
  title,
  description,
  prompts,
  source,
  label,
  icon,
  onAsk,
  shortcutHint = false,
  className,
}: AskCardProps) {
  return (
    <div
      className={cn(
        'flex flex-col gap-[var(--spacing-system-m)] rounded-md border border-ods-border bg-ods-card p-[var(--spacing-system-l)]',
        className,
      )}
    >
      <div className="flex items-center gap-3">
        <AssistantGlyph icon={icon} className="size-8" />
        <div className="min-w-0">
          <p className="text-ods-text-primary text-h4">{title}</p>
          {description && <p className="text-ods-text-secondary text-h6">{description}</p>}
        </div>
      </div>
      {prompts.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {prompts.map(prompt => (
            <QuickActionChipButton
              key={prompt.id}
              label={prompt.label}
              icon={prompt.icon}
              onSelect={() => {
                openAskAi(source, { prompt: prompt.prompt ?? prompt.label });
                onAsk?.(prompt);
              }}
            />
          ))}
        </div>
      )}
      <MingoAiButton source={source} label={label} icon={icon} shortcutHint={shortcutHint} className="self-start" />
    </div>
  );
}
