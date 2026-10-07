'use client';

import type { ReactNode } from 'react';
import { cn } from '../../utils/cn';
import { AgentMark } from '../agent-mark';
import { MingoAiButton, openAskAi } from '../navigation/mingo-ai-button';
import { ScrollShadow } from '../ui/scroll-fade';
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
  /** The surface the row sits on, as a CSS colour: what its edge fade dissolves into. Default: the page background. */
  fadeColor?: string;
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
/** One chip's slot in a stacked block (a card): the chip's own height, so an empty slot holds the same room. */
const CHIP_SLOT_CLASS = 'flex h-9 min-w-0 max-w-full';
/**
 * One chip's slot in `AskPrompts`. In a narrow column the block is ONE row that
 * scrolls sideways, so a chip keeps its question's width and never shrinks;
 * from the content `md` step the block stacks and a long question clips.
 */
const ROW_CHIP_SLOT_CLASS = 'flex h-9 shrink-0 content-md:min-w-0 content-md:max-w-full content-md:shrink';
/**
 * `AskPrompts`' block. Narrow (a phone): the launcher and the chips are one row
 * that scrolls sideways and fades where it continues (the lib's `ScrollShadow`),
 * the suggestion-chip row of Material's guidance: one row high whatever the
 * questions are, and no ragged space beside them. From the content `md` step:
 * stacked, one chip per row.
 */
const ASK_PROMPTS_ROW_CLASS =
  'flex min-w-0 flex-row items-center gap-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden content-md:flex-col content-md:overflow-visible';

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
          <span key={prompt?.id ?? `slot-${slot}`} className={slotClassName ?? CHIP_SLOT_CLASS}>
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
 * `count` question chips in fixed slots, so the block's height is known before
 * the questions are: ONE scrolling row on a narrow column, one chip per row
 * from the content `md` step (a chip is one line: a longer question clips there
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
  fadeColor,
  className,
}: AskPromptsProps) {
  const count = slotCount(countProp, loading, prompts);
  if (!loading && prompts.length === 0) return null;
  const end = align === 'end';
  return (
    <ScrollShadow
      axis="horizontal"
      color={fadeColor}
      className="w-full min-w-0 content-md:w-auto"
      scrollClassName={cn(ASK_PROMPTS_ROW_CLASS, end ? 'content-md:items-end' : 'content-md:items-start', className)}
    >
      <MingoAiButton variant="button" source={source} label={label} icon={icon} className="shrink-0" />
      <QuestionChips
        prompts={prompts}
        count={count}
        loading={loading}
        source={source}
        onAsk={onAsk}
        slotClassName={cn(ROW_CHIP_SLOT_CLASS, end && 'content-md:justify-end')}
      />
    </ScrollShadow>
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
