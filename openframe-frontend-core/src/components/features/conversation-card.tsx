'use client';

import { type ReactNode, useId } from 'react';
import { cn } from '../../utils/cn';
import { isOwnClick } from '../../utils/own-click';
import { useAgentTint } from '../agent-identity';
import { ChatTurn, TURN_BODY_CLASS, TURN_ROW_CLASS } from '../chat/chat-turn';
import { CheckCircleIcon } from '../icons-v2-generated/signs-and-symbols/check-circle-icon';
import { CheckIcon } from '../icons-v2-generated/signs-and-symbols/check-icon';
import { PlusIcon } from '../icons-v2-generated/signs-and-symbols/plus-icon';
import { LoadingRegion } from '../loading/loading-region';
import { TextLineSkeleton } from '../loading/unified-skeleton';
import { BUTTON_ICON_SM_SIZE, Button } from '../ui/button/button';
import { useLoadingScope } from '../ui/loading-scope';
import { SquareAvatarSkeleton } from '../ui/square-avatar';
import { Tag } from '../ui/tag';

/** The card's frame, its parts' blocks and its footer row: ONE string each, read by the card and its skeleton. */
const CARD_FRAME_CLASS =
  'relative flex h-full flex-col gap-[var(--spacing-system-mf)] overflow-hidden rounded-md border border-ods-border bg-ods-bg p-[var(--spacing-system-mf)]';
const ANSWER_BLOCK_CLASS = 'rounded-md border border-ods-border bg-ods-card p-[var(--spacing-system-sf)]';
const CONTEXT_BLOCK_CLASS = 'flex flex-col gap-[var(--spacing-system-xxs)] border-ods-border border-t pt-[var(--spacing-system-sf)]';
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
  className?: string;
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
  className,
}: ConversationCardProps) {
  const tint = useAgentTint(agent);
  const requestId = useId();
  // While the page is read the conversation is not known: the card is its skeleton, with the parts it will have.
  if (useLoadingScope()) {
    return (
      <ConversationCardSkeleton
        avatarPx={CONVERSATION_CARD_AVATAR_PX}
        context={!!context}
        footer={!!footerLabel}
        footerLabel={footerLabel}
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
          className="absolute right-[var(--spacing-system-mf)] top-[var(--spacing-system-mf)] z-10"
        >
          {selection.pressed ? <CheckIcon /> : <PlusIcon />}
        </Button>
      )}
      {/* Every part keeps a fixed number of lines, so cards in a row or a carousel line up part by part. */}
      <ChatTurn avatar={requester.avatar} name={requester.name} meta={requester.meta} time={requester.time}>
        <p
          id={requestId}
          className="m-0 line-clamp-2 min-h-[2lh] text-ods-text-primary text-h3"
          // Clears the corner mark: its width plus a gap.
          style={selection ? { paddingRight: `calc(${BUTTON_ICON_SM_SIZE} + var(--spacing-system-xsf))` } : undefined}
          title={request}
        >
          &ldquo;{request}&rdquo;
        </p>
      </ChatTurn>
      {context && (
        <div className={CONTEXT_BLOCK_CLASS}>
          <span className="text-ods-text-secondary text-h6">{context.label}</span>
          <p className="m-0 line-clamp-3 min-h-[3lh] text-ods-text-secondary text-h4" title={context.text}>
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
        <div className="flex items-start gap-[var(--spacing-system-xsf)] text-ods-text-secondary text-h4">
          <span className="line-clamp-3 min-h-[3lh] min-w-0 flex-1" title={outcome}>
            {outcome}
          </span>
          {outcomeAside}
          <span className="flex h-[1lh] shrink-0 items-center">
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

/** A speaker's turn while loading: the avatar box, the name line, then the turn's own lines. */
function TurnSkeleton({ avatarPx, children }: { avatarPx: number; children: ReactNode }) {
  return (
    <div className={TURN_ROW_CLASS}>
      <SquareAvatarSkeleton sizePx={avatarPx} />
      <div className={TURN_BODY_CLASS}>
        <TextLineSkeleton lines={1} type="h4" className="w-1/2" />
        {children}
      </div>
    </div>
  );
}

/**
 * The card while it loads: the SAME frame, then each part at the number of
 * lines the loaded card keeps for it (the request's two, the context's three,
 * the outcome's three), so a loaded card takes the skeleton's place without
 * moving the page. Pass the parts the loaded card will have.
 */
export function ConversationCardSkeleton({
  avatarPx = CONVERSATION_CARD_AVATAR_PX,
  context = false,
  footer = false,
  footerLabel,
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
  /** The loaded card has a context part ("Today"). */
  context?: boolean;
  /** The loaded card has a footer. */
  footer?: boolean;
  className?: string;
}) {
  return (
    <LoadingRegion label={label} announce={announce} className={cn(CARD_FRAME_CLASS, className)}>
      <TurnSkeleton avatarPx={avatarPx}>
        <TextLineSkeleton lines={2} type="h3" />
      </TurnSkeleton>
      {context && (
        <div className={CONTEXT_BLOCK_CLASS}>
          <TextLineSkeleton lines={1} type="h6" className="w-1/4" />
          <TextLineSkeleton lines={3} type="h4" />
        </div>
      )}
      <div className={ANSWER_BLOCK_CLASS}>
        <TurnSkeleton avatarPx={avatarPx}>
          <TextLineSkeleton lines={3} type="h4" />
        </TurnSkeleton>
      </div>
      {footer && (
        <div className={cn(FOOTER_ROW_CLASS, 'text-ods-text-secondary text-h6')}>
          {footerLabel ? <span>{footerLabel}</span> : <TextLineSkeleton lines={1} type="h6" className="w-1/4" />}
          <Tag as="span" label={'\u00a0'} variant="badge" className="invisible" />
        </div>
      )}
    </LoadingRegion>
  );
}
