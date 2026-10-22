'use client';

import { type CSSProperties, type ReactNode, useId } from 'react';
import { cn } from '../../utils/cn';
import { isOwnClick } from '../../utils/own-click';
import { useAgentTint } from '../agent-identity';
import { ChatTurn } from '../chat/chat-turn';
import { CheckCircleIcon } from '../icons-v2-generated/signs-and-symbols/check-circle-icon';
import { CheckIcon } from '../icons-v2-generated/signs-and-symbols/check-icon';
import { PlusIcon } from '../icons-v2-generated/signs-and-symbols/plus-icon';
import { LoadingRegion } from '../loading/loading-region';
import { TextLineSkeleton } from '../loading/unified-skeleton';
import { BUTTON_ICON_SM_SIZE, Button } from '../ui/button/button';
import { InertWhileLoading, useLoadingScope } from '../ui/loading-scope';
import { Tag } from '../ui/tag';

/**
 * The lines a part (the outcome, the context "Today") takes at least, on a narrow card (below `content-md`) and from
 * `content-md`. A typical outcome or status quo is a sentence or two: four lines in a phone's card and three in a wide
 * one. A part is never cut: a longer one grows its card (the cards of a row, or of a carousel, stretch to the tallest).
 * A host that lists its own cards (a curated row) may state the counts its list needs (`lines`), so every card of the
 * row keeps the tallest card's lines and the skeleton draws them. The counts reach the class through CSS variables
 * (a class built at runtime emits no CSS); the skeleton draws the same counts.
 */
export interface ConversationCardPartLines {
  phone: number;
  wide: number;
}
export interface ConversationCardLines {
  context?: ConversationCardPartLines;
  outcome?: ConversationCardPartLines;
}
const DEFAULT_PART_LINES: ConversationCardPartLines = { phone: 4, wide: 3 };
/** A part's minimum height, from its two counts (`--cc-lines` below `content-md`, `--cc-lines-wide` from it). */
const PART_LINES_CLASS = 'min-h-[calc(var(--cc-lines)*1lh)] content-md:min-h-[calc(var(--cc-lines-wide)*1lh)]';
const partLines = (lines: ConversationCardPartLines | undefined) => lines ?? DEFAULT_PART_LINES;
/** The style that sets a part's counts on its text. */
const partLinesStyle = (lines: ConversationCardPartLines | undefined) => {
  const { phone, wide } = partLines(lines);
  return { '--cc-lines': phone, '--cc-lines-wide': wide } as CSSProperties;
};
const CONTEXT_LINES_CLASS = PART_LINES_CLASS;
const OUTCOME_LINES_CLASS = PART_LINES_CLASS;
/** The context's text and the outcome's row and text: ONE string each, read by the card and its skeleton. */
const CONTEXT_TEXT_CLASS = cn('m-0 text-ods-text-secondary text-h4', CONTEXT_LINES_CLASS);
const OUTCOME_ROW_CLASS = 'flex items-start gap-[var(--spacing-system-xsf)] text-ods-text-secondary text-h4';
const OUTCOME_TEXT_CLASS = cn('m-0 min-w-0 flex-1', OUTCOME_LINES_CLASS);
/** The outcome's check, centred on its first line (one line high, by style: it is a mark, not a line of text). */
const OUTCOME_CHECK_CLASS = 'flex shrink-0 items-center';
const OUTCOME_CHECK_STYLE = { height: '1lh' } as const;
/** The request's quote: two lines at least, cut at two. Read by the card and its skeleton. */
const REQUEST_TEXT_CLASS = 'm-0 line-clamp-2 min-h-[2lh] text-ods-text-primary text-h3';
/** The request clears the corner toggle when the card is pickable: the toggle's width plus a gap. */
const REQUEST_CLEAR_TOGGLE_STYLE = {
  paddingRight: `calc(${BUTTON_ICON_SM_SIZE} + var(--spacing-system-xsf))`,
} as const;
/** The selection toggle's place, in the card's corner. */
const SELECTION_TOGGLE_CLASS = 'absolute right-[var(--spacing-system-mf)] top-[var(--spacing-system-mf)] z-10';
/** The context's label ("Today"): copy the page states, drawn for real in both forms. */
const CONTEXT_LABEL_CLASS = 'text-ods-text-secondary text-h6';
/** The speakers' avatar corner as the skeleton draws it. */
const SKELETON_AVATAR_SHAPE = 'square';

/** The card's frame, its parts' blocks and its footer row: ONE string each, read by the card and its skeleton. */
const CARD_FRAME_CLASS =
  'relative flex h-full flex-col gap-[var(--spacing-system-mf)] overflow-hidden rounded-md border border-ods-border bg-ods-bg p-[var(--spacing-system-mf)]';
const ANSWER_BLOCK_CLASS = 'rounded-md border border-ods-border bg-ods-card p-[var(--spacing-system-sf)]';
/** Only stacks its label and text: a one-column grid, not a column flexbox inside the card's own (WEBVIEW-001). */
const CONTEXT_BLOCK_CLASS =
  'grid grid-cols-1 gap-[var(--spacing-system-xxs)] border-ods-border border-t pt-[var(--spacing-system-sf)]';
const FOOTER_ROW_CLASS = 'mt-auto flex items-center justify-between gap-[var(--spacing-system-sf)]';
/** The speakers' avatar size the skeleton draws when the card draws it in a loading scope. */
export const CONVERSATION_CARD_AVATAR_PX = 32;

export interface ConversationCardSpeaker {
  /** Rendered as given (an avatar, an agent mark). */
  avatar: ReactNode;
  name: string;
  /** A quieter word after the name ("on her laptop", "this computer"). */
  meta?: string;
  /** When they spoke, as shown ("2:47 PM"). */
  time?: string;
}

export interface ConversationCardProps {
  requester: ConversationCardSpeaker;
  /** What they said. */
  request: string;
  responder: ConversationCardSpeaker;
  /** What was done about it. */
  outcome: string;
  /** Beside the outcome (the person who approved it). */
  outcomeAside?: ReactNode;
  /**
   * Between the request and the answer: how it is today, before the agent
   * ("Today" and a line). A pain card's status quo; omitted on a request card.
   */
  context?: { label: string; text: string };
  /** The footer's question ("Your part"). Omitted: no footer. */
  footerLabel?: string;
  /** The footer's answer ("Nothing", "One tap"). */
  footerValue?: string;
  /** `attention` paints the answer in the warning colour: it needs a person. */
  footerTone?: 'default' | 'attention';
  /**
   * The slug of the agent that answered. The card takes that agent's tint from
   * its identity, so it reads as that agent's at a glance. A card names its
   * agent, never a colour.
   */
  agent?: string | null;
  /**
   * The card is a toggle the reader picks ("this sounds like me"): one button
   * with `aria-pressed`, named by the request, stretched over the whole card so
   * a tap anywhere toggles it; a mark in its corner says whether it is picked,
   * and a picked card takes the accent ring.
   */
  selection?: { pressed: boolean; onToggle: () => void };
  /** The lines the context and the outcome keep at least (default four on a phone, three wide). */
  lines?: ConversationCardLines;
  className?: string;
  /** Draw the card's loading form outside a loading scope too (`useLoadingScope() || loading`). */
  loading?: boolean;
}

/**
 * A request and what was done about it, as two turns and a footer: who asked
 * and what they said, who answered and the result (a command block with its
 * check), then one line that sums up the reader's own part in it.
 */
export function ConversationCard({
  requester,
  request,
  responder,
  outcome,
  outcomeAside,
  footerLabel,
  footerValue,
  footerTone = 'default',
  agent,
  selection,
  context,
  lines,
  className,
  loading: loadingProp,
}: ConversationCardProps) {
  const tint = useAgentTint(agent);
  const requestId = useId();
  const loading = useLoadingScope() || loadingProp;
  // While the page is read the conversation is not known: the card is its skeleton, with the parts it will have.
  if (loading) {
    return (
      <ConversationCardSkeleton
        avatarPx={CONVERSATION_CARD_AVATAR_PX}
        // The context's label is the page's copy: drawn for real.
        context={context ? context.label || true : false}
        requesterMeta={!!requester.meta}
        responderMeta={!!responder.meta}
        requesterTime={!!requester.time}
        responderTime={!!responder.time}
        selection={selection ? { pressed: selection.pressed } : undefined}
        // The loaded card draws a footer only with a label AND a value; a value left undefined says there is none.
        footer={!!footerLabel && footerValue !== undefined}
        footerLabel={footerLabel}
        lines={lines}
        className={className}
      />
    );
  }
  return (
    <div
      className={cn(
        CARD_FRAME_CLASS,
        selection && 'cursor-pointer transition-colors hover:border-ods-border-hover',
        selection?.pressed && 'border-ods-accent ring-1 ring-ods-accent',
        className,
      )}
      style={tint}
      onClick={
        selection &&
        (event => {
          // A pointer convenience: the primary button only, never the end of a text selection,
          // and only the card's own click (`isOwnClick`: not a control or link inside it, not a portal).
          if (event.button !== 0 || window.getSelection()?.toString()) return;
          if (!isOwnClick(event.target, event.currentTarget, { controls: true })) return;
          selection.onToggle();
        })
      }
    >
      {selection && (
        // The toggle is a regular boxed Button in the card's corner, named by the
        // request; a click anywhere on the card toggles it too (a pointer
        // convenience: the Button is the control keyboards and screen readers use).
        <Button
          type="button"
          variant={selection.pressed ? 'accent' : 'outline'}
          size="icon-sm"
          aria-pressed={selection.pressed}
          aria-labelledby={requestId}
          onClick={event => {
            event.stopPropagation();
            selection.onToggle();
          }}
          className={SELECTION_TOGGLE_CLASS}
        >
          {selection.pressed ? <CheckIcon /> : <PlusIcon />}
        </Button>
      )}
      {/* Every part keeps at least its number of lines, so cards in a row or a carousel line up part by part. */}
      <ChatTurn avatar={requester.avatar} name={requester.name} meta={requester.meta} time={requester.time}>
        <p
          id={requestId}
          className={REQUEST_TEXT_CLASS}
          style={selection ? REQUEST_CLEAR_TOGGLE_STYLE : undefined}
          title={request}
        >
          &ldquo;{request}&rdquo;
        </p>
      </ChatTurn>
      {context && (
        <div className={CONTEXT_BLOCK_CLASS}>
          <span className={CONTEXT_LABEL_CLASS}>{context.label}</span>
          <p className={CONTEXT_TEXT_CLASS} style={partLinesStyle(lines?.context)}>
            {context.text}
          </p>
        </div>
      )}
      {/* The answer is a command block: who did it, what was done, and its check. */}
      <ChatTurn
        avatar={responder.avatar}
        name={responder.name}
        meta={responder.meta}
        time={responder.time}
        className={ANSWER_BLOCK_CLASS}
      >
        <div className={OUTCOME_ROW_CLASS}>
          <p className={OUTCOME_TEXT_CLASS} style={partLinesStyle(lines?.outcome)}>
            {outcome}
          </p>
          {outcomeAside}
          <span className={OUTCOME_CHECK_CLASS} style={OUTCOME_CHECK_STYLE}>
            <CheckCircleIcon size={16} className="text-ods-success" aria-hidden />
          </span>
        </div>
      </ChatTurn>
      {footerLabel && footerValue && (
        <div className={cn(FOOTER_ROW_CLASS, 'text-ods-text-secondary text-h6')}>
          <span>{footerLabel}</span>
          <Tag as="span" label={footerValue} variant={footerTone === 'attention' ? 'warning' : 'badge'} />
        </div>
      )}
    </div>
  );
}

/**
 * The card while it loads: the SAME frame, each turn drawn by `ChatTurn`'s own loading form (its picture, name row
 * and the part under it at the line count the loaded card keeps: the request's two, the context's `lines`, four on a
 * phone and three wide by default), so a loaded card takes the skeleton's place without moving the page. The page's
 * own copy (the context's label, the footer's question) and the selection toggle are drawn for real, the toggle inert.
 * Pass the parts the loaded card will have.
 */
function ConversationCardSkeleton({
  avatarPx = CONVERSATION_CARD_AVATAR_PX,
  context = false,
  requesterMeta = false,
  responderMeta = false,
  requesterTime = true,
  responderTime = true,
  selection,
  footer = false,
  footerLabel,
  lines,
  label = 'Loading a conversation',
  announce = true,
  className,
}: {
  /** What a screen reader hears while it loads. */
  label?: string;
  /** `false` inside another loading region (a row of cards): only the outermost region announces. */
  announce?: boolean;
  /** The speakers' avatar size, as the host draws it. */
  avatarPx?: number;
  /** The footer's question when the page states it ("Your part"): drawn for real. */
  footerLabel?: string;
  /** The loaded card has a context part ("Today"); a string is its label, drawn for real. */
  context?: boolean | string;
  /** The asker's name carries a meta line (their role); a string is static copy, drawn for real. */
  requesterMeta?: boolean | string;
  /** The answerer's name carries a meta line ("What changes"); a string is static copy, drawn for real. */
  responderMeta?: boolean | string;
  /** The asker's name row carries a time at its far end. */
  requesterTime?: boolean;
  /** The answerer's name row carries a time at its far end. */
  responderTime?: boolean;
  /** The loaded card is pickable: its toggle is drawn for real (at its state), inert while it loads. */
  selection?: { pressed: boolean };
  /** The loaded card has a footer. */
  footer?: boolean;
  /** The lines the loaded card keeps for its context and outcome (`ConversationCardProps.lines`). */
  lines?: ConversationCardLines;
  className?: string;
}) {
  const contextLines = partLines(lines?.context);
  const outcomeLines = partLines(lines?.outcome);
  return (
    <LoadingRegion label={label} announce={announce} className={cn(CARD_FRAME_CLASS, className)}>
      {selection && (
        <InertWhileLoading className="contents">
          <Button
            type="button"
            variant={selection.pressed ? 'accent' : 'outline'}
            size="icon-sm"
            aria-pressed={selection.pressed}
            className={SELECTION_TOGGLE_CLASS}
          >
            {selection.pressed ? <CheckIcon /> : <PlusIcon />}
          </Button>
        </InertWhileLoading>
      )}
      <ChatTurn
        loading
        name=""
        skeleton={{
          avatarPx,
          avatarShape: SKELETON_AVATAR_SHAPE,
          meta: requesterMeta,
          time: requesterTime,
          body: (
            <div style={selection ? REQUEST_CLEAR_TOGGLE_STYLE : undefined}>
              <TextLineSkeleton lines={2} type="h3" />
            </div>
          ),
        }}
      />
      {context && (
        <div className={CONTEXT_BLOCK_CLASS}>
          {typeof context === 'string' ? (
            <span className={CONTEXT_LABEL_CLASS}>{context}</span>
          ) : (
            <TextLineSkeleton lines={1} type="h6" className="w-1/4" />
          )}
          <p className={CONTEXT_TEXT_CLASS} style={partLinesStyle(contextLines)}>
            <TextLineSkeleton as="span" lines={contextLines.phone} type="h4" className="content-md:hidden" />
            <TextLineSkeleton as="span" lines={contextLines.wide} type="h4" className="hidden content-md:flex" />
          </p>
        </div>
      )}
      <ChatTurn
        loading
        name=""
        className={ANSWER_BLOCK_CLASS}
        skeleton={{
          avatarPx,
          avatarShape: SKELETON_AVATAR_SHAPE,
          meta: responderMeta,
          time: responderTime,
          // The outcome's row: its text at a typical line count, beside the check's place (the row's width).
          body: (
            <div className={OUTCOME_ROW_CLASS}>
              <p className={OUTCOME_TEXT_CLASS} style={partLinesStyle(outcomeLines)}>
                <TextLineSkeleton as="span" lines={outcomeLines.phone} type="h4" className="content-md:hidden" />
                <TextLineSkeleton as="span" lines={outcomeLines.wide} type="h4" className="hidden content-md:flex" />
              </p>
              <span className={cn(OUTCOME_CHECK_CLASS, 'invisible')} style={OUTCOME_CHECK_STYLE}>
                <CheckCircleIcon size={16} aria-hidden />
              </span>
            </div>
          ),
        }}
      />
      {footer && (
        <div className={cn(FOOTER_ROW_CLASS, 'text-ods-text-secondary text-h6')}>
          {footerLabel ? <span>{footerLabel}</span> : <TextLineSkeleton lines={1} type="h6" className="w-1/4" />}
          <Tag as="span" label={'\u00a0'} variant="badge" className="invisible" />
        </div>
      )}
    </LoadingRegion>
  );
}
