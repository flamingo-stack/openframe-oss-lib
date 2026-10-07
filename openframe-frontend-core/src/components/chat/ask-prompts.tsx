'use client';

import type { ReactNode } from 'react';
import { cn } from '../../utils/cn';
import { AgentMark } from '../agent-mark';
import { MingoAiButton, openAskAi } from '../navigation/mingo-ai-button';
import { QuickActionChipButton, QuickActionChipSkeleton, type QuickActionIconSpec } from './quick-action-chip';

/** One question a page offers: the chip shows `label` as written, the chat is sent `prompt`. */
export interface AskPrompt {
  id: string;
  label: string;
  /** What is sent to the chat. Absent: the label itself. */
  prompt?: string;
  icon?: ReactNode | QuickActionIconSpec;
}

export interface AskPromptsProps {
  prompts: readonly AskPrompt[];
  /**
   * How many chips the block shows and reserves room for: the same number in
   * the same slots on every load. Default: the prompts given (while `loading`,
   * when there are none yet, two).
   */
  count?: number;
  /** The questions are still being read: `count` chip skeletons in the chips' own slots. */
  loading?: boolean;
  /** `end`: the rows sit at the far end (a block beside a heading). Default `start`. */
  align?: 'start' | 'end';
  /** The chat source the page's chat panel runs on (the `ask-ai:open` filter). */
  source?: string;
  /** The assistant's configured name: the launcher before the chips ("Ask Mingo").
   *  Absent: the launcher's own default name. */
  label?: string;
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

/** How many slots a loading block reserves when its host names no `count`. */
const DEFAULT_LOADING_SLOTS = 2;
/** The slots a block shows: the host's `count`; else the prompts it has, or the default while they load. */
const slotCount = (count: number | undefined, loading: boolean, prompts: readonly AskPrompt[]) =>
  count ?? (loading ? DEFAULT_LOADING_SLOTS : prompts.length);

/** A skeleton chip's label width (in `ch`), by slot: a believable spread that is the same on every load. */
const SKELETON_LABEL_CH = [26, 22, 30, 24, 20, 28] as const;
/** One chip's slot: the chip's own height, so an empty slot holds the same room. */
/**
 * In a narrow column (a phone) a chip takes the column's whole width, so the
 * questions read as one list and no ragged space is left beside them; from the
 * content `md` step a chip is as wide as its question.
 */
const CHIP_SLOT_CLASS =
  'flex h-9 w-full min-w-0 max-w-full content-md:w-auto [&>button]:w-full [&>button>*]:w-full [&>button>*]:justify-start content-md:[&>button]:w-auto content-md:[&>button>*]:w-auto';

/**
 * The questions themselves, in `count` fixed slots: a sentence-case chip each
 * (a click opens the chat and sends that question once), a chip skeleton each
 * while loading, and an empty slot where fewer questions exist than slots.
 */
function QuestionChips({
  prompts,
  count,
  loading,
  source,
  onAsk,
  slotClassName,
}: Pick<AskPromptsProps, 'prompts' | 'loading' | 'source' | 'onAsk'> & { count: number; slotClassName?: string }) {
  return (
    <>
      {Array.from({ length: count }, (_, slot) => {
        const prompt = loading ? undefined : prompts[slot];
        return (
          <span key={prompt?.id ?? `slot-${slot}`} className={cn(CHIP_SLOT_CLASS, slotClassName)}>
            {loading ? (
              <QuickActionChipSkeleton
                variant="question"
                labelCh={SKELETON_LABEL_CH[slot % SKELETON_LABEL_CH.length]}
              />
            ) : prompt ? (
              <QuickActionChipButton
                variant="question"
                label={prompt.label}
                icon={prompt.icon}
                onSelect={() => {
                  openAskAi(source, { prompt: prompt.prompt ?? prompt.label });
                  onAsk?.(prompt);
                }}
              />
            ) : null}
          </span>
        );
      })}
    </>
  );
}

/**
 * A row of questions that open the site chat and ask it: THE assistant
 * launcher (`MingoAiButton`, its in-page variant: the mark and the name), then
 * `count` question chips, ONE PER ROW in fixed slots, so the block's height is
 * known before the questions are (a chip is one line: a longer question clips
 * and its tooltip shows it whole). A click on a chip opens the
 * chat and sends that question once (`openAskAi` with a prompt); the launcher
 * only opens it. While `loading` the slots hold chip skeletons and the launcher
 * keeps its place. Loaded with no prompt it renders nothing.
 */
export function AskPrompts({
  prompts,
  count: countProp,
  loading = false,
  align = 'start',
  source,
  label,
  icon,
  onAsk,
  className,
}: AskPromptsProps) {
  const count = slotCount(countProp, loading, prompts);
  if (!loading && prompts.length === 0) return null;
  const end = align === 'end';
  return (
    <div
      className={cn(
        'flex w-full min-w-0 flex-col gap-2 content-md:w-auto',
        end ? 'items-end' : 'items-start',
        className,
      )}
    >
      <MingoAiButton variant="button" source={source} label={label} icon={icon} />
      <QuestionChips
        prompts={prompts}
        count={count}
        loading={loading}
        source={source}
        onAsk={onAsk}
        slotClassName={end ? 'justify-end' : undefined}
      />
    </div>
  );
}

export interface AskCardProps extends Omit<AskPromptsProps, 'label' | 'className' | 'align'> {
  title: string;
  description?: string;
  /** The assistant's configured name: the launcher's label. */
  label: string;
  /** Show the Cmd+K / Ctrl+K key cap on the launcher (and bind it). Default true: the card's launcher reads like the header's. */
  shortcutHint?: boolean;
  className?: string;
}

/**
 * The "still deciding?" card beside a list of questions: the assistant's mark,
 * a title, a line of description, `count` questions (one per row, in fixed
 * slots, chip skeletons while `loading`) and the chat launcher. The card is the
 * same height before and after the questions arrive.
 */
export function AskCard({
  title,
  description,
  prompts,
  count: countProp,
  loading = false,
  source,
  label,
  icon,
  onAsk,
  shortcutHint = true,
  className,
}: AskCardProps) {
  const count = slotCount(countProp, loading, prompts);
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
      {(loading || prompts.length > 0) && (
        <div className="flex min-w-0 flex-col items-start gap-2">
          <QuestionChips prompts={prompts} count={count} loading={loading} source={source} onAsk={onAsk} />
        </div>
      )}
      <MingoAiButton
        variant="button"
        source={source}
        label={label}
        icon={icon}
        shortcutHint={shortcutHint}
        className="self-start"
      />
    </div>
  );
}
