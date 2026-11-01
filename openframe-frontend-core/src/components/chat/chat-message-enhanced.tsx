'use client';

import React, { forwardRef, memo, type ReactNode, useEffect, useMemo, useRef } from 'react';
import { parseRecordHref, type RecordLink } from '../../chat-protocol/record-link';
import Link from '../../embed-shims/next-link';
import { cn } from '../../utils/cn';
import { isToday } from '../../utils/date-utils';
import { formatDate, formatTime } from '../../utils/format-date';
import { AgentMark } from '../agent-mark';
import type { MdRenderProps } from '../ui/markdown/base-components';
import { SimpleMarkdownRenderer } from '../ui/markdown/simple-markdown-renderer';
import { SquareAvatar } from '../ui/square-avatar';
import { ApprovalBatchMessage } from './approval-batch-message';
import { ApprovalRequestMessage } from './approval-request-message';
import { AskDisplay } from './ask-display';
import { ChatAppearanceContext, useChatAppearance } from './chat-appearance-context';
import { ChatContextChipStrip } from './chat-context-picker';
import { ChatMarkdownLink } from './chat-markdown-link';
import {
  CHAT_MESSAGE_FACE_PX,
  CHAT_MESSAGE_HEADER_CLASS,
  CHAT_MESSAGE_ROW_PADDING_CLASS,
  CHAT_MESSAGE_SEGMENTS_CLASS,
  CHAT_MESSAGE_STACK_CLASS,
  CHAT_MESSAGE_TEXT_CLASS,
  CHAT_MESSAGE_USER_BUBBLE_CLASS,
  CHAT_MESSAGE_USER_ROW_CLASS,
} from './chat-message-layout';
import type { ChatRef } from './chat-ref.types';
import { ContextCompactionDisplay } from './context-compaction-display';
import { BlockCard, type BlockCardProps } from './entity-cards/block-card';
import { chatCardLabel } from './entity-cards/dispatch';
import { ErrorMessageDisplay } from './error-message-display';
import { EscalationOfferMessage } from './escalation-offer-message';
import { RecordChipProvider } from './record-actions';
import { RecordChip } from './record-chip';
import { recordLinksIn } from './record-links-in';
import { SuggestionsDisplay } from './suggestions-display';
import { SystemEventMessage } from './system-event-message';
import { ThinkingDisplay } from './thinking-display';
import { TicketEscalatedMessage } from './ticket-escalated-message';
import { TicketEventMessage } from './ticket-event-message';
import { ToolExecutionDisplay } from './tool-execution-display';
import type { AskSegment, MessageSegment, MessageContent, ChatMessageEnhancedProps } from './types';
import { CHAT_APPEARANCE } from './types/chat.types';

/** Timestamp label: today's messages show time only ("2:47 PM"),
 *  older messages prepend a locale-formatted date ("05/05/2026 2:47 PM"
 *  in en-US, "05.05.2026 14:47" in european locales). */
function formatMessageTimestamp(timestamp: Date): string {
  const time = formatTime(timestamp);
  return isToday(timestamp) ? time : `${formatDate(timestamp)} ${time}`;
}

/** The plain text of a link's children (its name), as markdown hands them to the `<a>` override. */
function textOf(node: ReactNode): string {
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(textOf).join('');
  if (React.isValidElement<{ children?: ReactNode }>(node)) return textOf(node.props.children);
  return '';
}

/** The records an answer's text links, once each, in the order it first links them, with the name it gave each. */
function linkedRecords(segments: MessageSegment[]): Array<RecordLink & { label: string }> {
  const byKey = new Map<string, RecordLink & { label: string }>();
  for (const segment of segments) {
    if (segment.type !== 'text' || !segment.text) continue;
    for (const record of recordLinksIn(segment.text)) {
      const key = `${record.type}:${record.id}`;
      if (!byKey.has(key)) byKey.set(key, record);
    }
  }
  return [...byKey.values()];
}

function normalizeContent(content: MessageContent): MessageSegment[] {
  if (typeof content === 'string') {
    return content ? [{ type: 'text', text: content }] : [];
  }
  return content;
}

/**
 * A RUN of consecutive `ask` segments is one paged card, not a stack of
 * near-identical ones. Returns the run keyed by the index of its FIRST segment;
 * the render draws the card there and skips every later index of the same run
 * (an `ask` index missing from this map is a tail member).
 */
function groupAskRuns(segments: MessageSegment[]): Map<number, AskSegment[]> {
  const runs = new Map<number, AskSegment[]>();
  let headIndex = -1;
  segments.forEach((segment, index) => {
    if (segment.type !== 'ask') {
      headIndex = -1;
      return;
    }
    if (headIndex === -1) {
      headIndex = index;
      runs.set(index, [segment]);
      return;
    }
    runs.get(headIndex)?.push(segment);
  });
  return runs;
}

const ChatMessageEnhanced = forwardRef<HTMLDivElement, ChatMessageEnhancedProps>(
  (
    {
      className,
      role,
      content,
      name,
      avatar,
      isTyping = false,
      timestamp,
      showAvatar = true,
      assistantType,
      approvalVariant,
      appearance: appearanceProp,
      authorType: authorTypeProp,
      selfAuthorType,
      nameEveryTurn = false,
      assistantIcon,
      contextItems,
      resolveContextIcon,
      renderContextItem,
      renderRecordChip,
      renderEntityCard,
      refs,
      onAskSelect,
      NavLinkAnchor,
      ...props
    },
    ref,
  ) => {
    // A `user` row is a PERSON (the end user, a technician, a system line); the
    // agent's turns are `assistant`. Which person is the viewer is the thread's
    // call (`selfAuthorType`): the viewer's own turns draw as the bubble on the
    // right, another person's as an incoming reply.
    const isHuman = role === 'user';
    const isError = role === 'error';
    const inheritedAppearance = useChatAppearance();
    const appearance = appearanceProp ?? inheritedAppearance;
    const isV2 = appearance === CHAT_APPEARANCE.V2;
    const authorType = authorTypeProp ?? (isHuman ? 'user' : assistantType === 'mingo' ? 'mingo' : 'fae');
    const isOtherPerson =
      isHuman && selfAuthorType !== undefined && authorType !== 'system' && authorType !== selfAuthorType;
    const isUser = isHuman && !isOtherPerson;

    const segments = useMemo(() => normalizeContent(content), [content]);

    const askRuns = useMemo(() => groupAskRuns(segments), [segments]);

    // Records the body links (`[name](record://type/id)`) are drawn inline, so they are left off the chip strip below.
    const inlineRecordIds = useMemo(() => {
      const ids = new Set<string>();
      for (const seg of segments) {
        if (seg.type !== 'text' || !seg.text) continue;
        for (const record of recordLinksIn(seg.text)) ids.add(record.id);
      }
      return ids;
    }, [segments]);

    // Chip strip = only context NOT already shown inline (e.g. `+`-added items).
    const stripContextItems = useMemo(
      () =>
        inlineRecordIds.size > 0 && contextItems
          ? contextItems.filter(it => !inlineRecordIds.has(it.id))
          : contextItems,
      [contextItems, inlineRecordIds],
    );

    /** The answer's own references, by `type:id`. What turns a bare marker into
     *  a card with a title and a link, without a per-entity lookup the host may
     *  not even have an API for. */
    const refByKey = useMemo(() => {
      const byKey = new Map<string, ChatRef>();
      for (const described of refs ?? []) byKey.set(`${described.type}:${described.id}`, described);
      return byKey;
    }, [refs]);

    /**
     * The answer's record cards, by segment: each `record_cards` part (the model's `show_records` call, checked by the
     * server) is drawn where it sits in the message, between the text before and after the call, the way a tool's
     * widget sits in a reply. Never read out of the text: a record the text names is a chip there. A card takes its
     * title from the answer's own references, else from the name the text gives the record, and loads the rest itself.
     *
     * Each card's node is kept across renders (same `type:id`, same render function, same described ref) so a card
     * does not remount, re-fetch or close its open menu on every streamed token.
     */
    const recordCardCache = useRef(
      new Map<
        string,
        { render: (ref: ChatRef) => React.ReactNode; ref: ChatRef | undefined; label: string; node: React.ReactNode }
      >(),
    );
    const recordCards = useMemo(() => {
      const bySegment = new Map<number, Array<{ key: string; node: React.ReactNode }>>();
      if (!renderEntityCard || isHuman) return bySegment;
      if (!segments.some(segment => segment.type === 'record_cards')) return bySegment;
      const names = new Map(linkedRecords(segments).map(record => [`${record.type}:${record.id}`, record.label]));
      const cache = recordCardCache.current;
      segments.forEach((segment, index) => {
        if (segment.type !== 'record_cards') return;
        const cards: Array<{ key: string; node: React.ReactNode }> = [];
        for (const record of segment.cards) {
          // A type the chat draws no card for (a device, a script) stays a chip in the text.
          if (record.type !== 'video' && !chatCardLabel(record.type)) continue;
          const key = `${record.type}:${record.id}`;
          const described = refByKey.get(key);
          const label = names.get(key) ?? '';
          let entry = cache.get(key);
          if (!entry || entry.render !== renderEntityCard || entry.ref !== described || entry.label !== label) {
            const cardRef: ChatRef = described ?? { type: record.type, id: record.id, title: label, url: null };
            const rendered = renderEntityCard(cardRef);
            // A block card (a video) draws its block here.
            const node =
              React.isValidElement(rendered) && rendered.type === BlockCard
                ? (rendered.props as BlockCardProps).children
                : rendered;
            entry = { render: renderEntityCard, ref: described, label, node };
            cache.set(key, entry);
          }
          if (entry.node != null && !cards.some(card => card.key === key)) cards.push({ key, node: entry.node });
        }
        if (cards.length > 0) bySegment.set(index, cards);
      });
      return bySegment;
    }, [renderEntityCard, isHuman, segments, refByKey]);

    useEffect(() => {
      const cache = recordCardCache.current;
      const shown = new Set([...recordCards.values()].flat().map(card => card.key));
      for (const key of [...cache.keys()]) if (!shown.has(key)) cache.delete(key);
    }, [recordCards]);

    const cardComponentOverrides = useMemo(() => {
      return {
        // Override `<a>`: a record link becomes its chip; every other link goes through the host's navigation.
        a: ({ href, children, className: linkClassName, ...rest }: MdRenderProps<'a'>) => {
          // A record link (`[Patch script](record://script/<id>)`, `chat-protocol/record-link.ts`): the chip, inside
          // the sentence, showing the link's own text. The host draws its own chip for the type where it has one
          // (`renderRecordChip`, given the name); otherwise the lib's, which opens the record where its card does.
          const record = parseRecordHref(href);
          if (record) {
            const label = textOf(children) || record.id;
            const hosted = renderRecordChip?.({ type: record.type, id: record.id, label });
            // In its record's context, so the host's chip can offer the record's menu (`useRecordChipMenu`).
            if (hosted != null)
              return (
                <RecordChipProvider value={{ type: record.type, id: record.id, label }}>{hosted}</RecordChipProvider>
              );
            return <RecordChip type={record.type} id={record.id} label={label} />;
          }
          // The host's `NavLinkAnchor` draws the link (the lib's
          // `NavLinkAnchorViaRuntime`, or a host anchor over the same
          // `useNavLinkViaRuntime`), so every clickable surface (source chips,
          // inline cards, search rows, markdown links) follows the one
          // navigation decision (`navLinkTarget`) and executor.
          //
          // Anchor-only links (`#section`) bypass NavLinkAnchor — the
          // host's router would treat them as navigation, but the user
          // wants the browser's native scroll-to-anchor behavior.
          //
          // When the host has NOT supplied `NavLinkAnchor` (e.g. the
          // flamingo hero-demo with mock content), fall back to a plain
          // `<a href>`.
          if (typeof href === 'string' && NavLinkAnchor && !href.startsWith('#')) {
            return (
              <ChatMarkdownLink anchor={NavLinkAnchor} href={href} className={linkClassName} {...rest}>
                {children}
              </ChatMarkdownLink>
            );
          }
          return (
            <Link href={href} className={linkClassName} {...rest}>
              {children}
            </Link>
          );
        },
      };
      // DEPS ARE DELIBERATELY MINIMAL: both are host-stable identities (enforced by this file's `memo` comparator), so
      // the overrides keep one identity across a streaming turn and the markdown engine's block memoization holds.
    }, [renderRecordChip, NavLinkAnchor]);

    /**
     * Body of a markdown-bearing segment (`text` / `guide`). `isStreaming` opts the segment into the markdown engine's
     * streaming path (atomic-block memoization, fence tail-completion, aria-live); only the actively streaming segment
     * gets it.
     */
    const renderSegmentBody = (text: string, isStreaming: boolean) => (
      <SimpleMarkdownRenderer
        content={text}
        textSize="compact"
        componentOverrides={cardComponentOverrides}
        streaming={isStreaming}
      />
    );

    const isSystem = authorType === 'system';

    // A thread can hold several people (a user, a colleague, a technician, two
    // agents), so every turn says who is speaking with a FACE. The face sits on
    // its own short line above the message (on the right for the user), never
    // beside it: a face in the row indents every line of the message by its
    // width. The NAME is written only where it is the information itself: a
    // system line and another person answering (a technician in the end
    // user's thread). Mingo sends the admin's own turns as `admin` too; those
    // are the user's words and draw as such. Every face carries its name for
    // assistive tech and on hover. A thread of several parties names every
    // turn (`nameEveryTurn`: a ticket, where an end user, the agent and any
    // number of technicians write): the agent's turn as an incoming one, the
    // viewer's own bubble with the name beside the face, on the bubble's side.
    const showName =
      isSystem || isOtherPerson || (authorType === 'admin' && !isUser) || (nameEveryTurn && role === 'assistant');
    const showSelfName = nameEveryTurn && isUser && !isSystem;
    const displayName = name || (isHuman ? 'User' : assistantType === 'mingo' ? 'Mingo' : 'Fae');
    const nameLabel = <span className="min-w-0 truncate text-ods-open-yellow text-h6">{displayName}</span>;
    const faceBox = 'h-5 w-5 flex-shrink-0';
    const face: ReactNode =
      !showAvatar || isSystem ? null : !isHuman && !avatar && assistantIcon ? (
        <span title={displayName} className={cn('flex items-center justify-center', faceBox)}>
          {assistantIcon}
        </span>
      ) : !isHuman && !avatar && assistantType ? (
        // An agent with no picture shows its packaged mark, never initials.
        <span role="img" aria-label={displayName} title={displayName} className={cn('inline-flex', faceBox)}>
          <AgentMark agent={assistantType} className="h-full w-full rounded-full" />
        </span>
      ) : (
        <span title={displayName} className="inline-flex flex-shrink-0">
          <SquareAvatar
            src={avatar || undefined}
            alt={displayName}
            fallback={displayName}
            variant="round"
            size="xs"
            sizePx={CHAT_MESSAGE_FACE_PX}
            initialsClassName="text-[9px] text-ods-text-secondary"
          />
        </span>
      );

    // v2 draws a system line (e.g. a technician joining) as an in-thread
    // receipt card rather than as an author row with no body.
    if (isV2 && isSystem && name) {
      return (
        <div
          ref={ref}
          className={cn('relative', CHAT_MESSAGE_ROW_PADDING_CLASS[CHAT_APPEARANCE.V2], className)}
          {...props}
        >
          <ChatAppearanceContext.Provider value={appearance}>
            <SystemEventMessage text={name} timestamp={timestamp} />
          </ChatAppearanceContext.Provider>
        </div>
      );
    }

    return (
      <ChatAppearanceContext.Provider value={appearance}>
        <div
          ref={ref}
          className={cn(
            'relative',
            CHAT_MESSAGE_ROW_PADDING_CLASS[isV2 ? CHAT_APPEARANCE.V2 : CHAT_APPEARANCE.CLASSIC],
            className,
          )}
          {...props}
        >
          {/* Message Content — full panel width.
            Avatar is INLINE in the name row below (2025-2026 chat
            pattern — Claude.ai, ChatGPT, Gemini, Perplexity).
            Legacy hanging-avatar layout (`absolute -left-16`) wasted
            64px of gutter and clipped in narrow panels.

            Single-column GRID, not `flex flex-col` — here, in the segment
            stack below, in the thread's per-message wrapper and in the
            card/video pair (entity-cards/dispatch): WebKit re-lays-out the
            children of every nested column flexbox to measure them, so the
            cost compounds per level. One 9-level Mingo reply took ~155ms of
            layout per drawer-resize frame in Safari / the desktop WKWebView
            vs ~9ms as grid (Chrome: ~2ms either way). Same gap and stretch,
            no margin collapsing — visually identical. */}
          <div className={CHAT_MESSAGE_STACK_CLASS}>
            {(face || showName || showSelfName) && (
              <div className={cn(CHAT_MESSAGE_HEADER_CLASS, isUser && 'justify-end')}>
                {showSelfName && nameLabel}
                {face}
                {showName && nameLabel}
                {showName && timestamp && (
                  <span className="ml-auto shrink-0 whitespace-nowrap text-ods-text-secondary text-h6">
                    {formatMessageTimestamp(timestamp)}
                  </span>
                )}
              </div>
            )}

            {/* Message segments — hidden for system messages without content */}
            {(!isSystem || segments.length > 0) && (
              <div className={CHAT_MESSAGE_SEGMENTS_CLASS}>
                {segments.map((segment, index) => {
                  // The engine's streaming path (atomic-block memoization +
                  // fence tail-completion + aria-live) applies ONLY to the
                  // actively streaming segment: last segment of a message that
                  // is still typing. On completion `isTyping` flips false and
                  // the engine does one authoritative whole-document parse.
                  const segmentIsStreaming = index === segments.length - 1 && !!isTyping;
                  if (segment.type === 'text') {
                    // The layout of Claude and ChatGPT: what the USER said is a
                    // bubble on the right; what anyone else says is plain text
                    // across the thread's full width, with no bubble. Nothing
                    // takes a column, so every line gets the whole width (the
                    // speaker's face is the short line above).
                    if (isUser) {
                      return (
                        <div key={index} className={CHAT_MESSAGE_USER_ROW_CLASS}>
                          <div className={CHAT_MESSAGE_USER_BUBBLE_CLASS}>
                            {renderSegmentBody(segment.text, segmentIsStreaming)}
                          </div>
                        </div>
                      );
                    }
                    return (
                      <div
                        key={index}
                        className={cn(CHAT_MESSAGE_TEXT_CLASS, isError ? 'text-ods-error' : 'text-ods-text-primary')}
                      >
                        {renderSegmentBody(segment.text, segmentIsStreaming)}
                      </div>
                    );
                  } else if (segment.type === 'ask') {
                    // Only the run's head draws — the tail segments are pages of
                    // the card already rendered above them.
                    const run = askRuns.get(index);
                    if (!run) return null;
                    return <AskDisplay key={index} cards={run} onSelect={onAskSelect} />;
                  } else if (segment.type === 'suggestions') {
                    return <SuggestionsDisplay key={index} segment={segment} />;
                  } else if (segment.type === 'tool_execution') {
                    return (
                      <ToolExecutionDisplay
                        key={index}
                        message={segment.data}
                        assistantType={assistantType}
                        variant={approvalVariant}
                      />
                    );
                  } else if (segment.type === 'approval_request') {
                    return (
                      <ApprovalRequestMessage
                        key={index}
                        data={segment.data}
                        status={segment.status}
                        resolvedByName={segment.resolvedByName}
                        onApprove={segment.onApprove}
                        onReject={segment.onReject}
                        assistantType={assistantType}
                        variant={approvalVariant}
                      />
                    );
                  } else if (segment.type === 'approval_batch') {
                    return (
                      <ApprovalBatchMessage
                        key={index}
                        data={segment.data}
                        status={segment.status}
                        resolvedByName={segment.resolvedByName}
                        onApprove={segment.onApprove}
                        onReject={segment.onReject}
                        assistantType={assistantType}
                        variant={approvalVariant}
                      />
                    );
                  } else if (segment.type === 'escalation_offer') {
                    return (
                      <EscalationOfferMessage
                        key={index}
                        data={segment.data}
                        status={segment.status}
                        resolvedByName={segment.resolvedByName}
                        onApprove={segment.onApprove}
                        onReject={segment.onReject}
                      />
                    );
                  } else if (segment.type === 'ticket_escalated') {
                    return <TicketEscalatedMessage key={index} data={segment.data} timestamp={timestamp} />;
                  } else if (segment.type === 'ticket_event') {
                    // The card's own event time; the bubble timestamp is the
                    // turn's FIRST row and lags every later lifecycle event.
                    return (
                      <TicketEventMessage key={index} data={segment.data} timestamp={segment.occurredAt ?? timestamp} />
                    );
                  } else if (segment.type === 'error') {
                    return <ErrorMessageDisplay key={index} title={segment.title} details={segment.details} />;
                  } else if (segment.type === 'context_compaction') {
                    return <ContextCompactionDisplay key={index} status={segment.status} />;
                  } else if (segment.type === 'thinking') {
                    const isStreaming = index === segments.length - 1 && isTyping;
                    return <ThinkingDisplay key={index} text={segment.text} isStreaming={isStreaming} />;
                  } else if (segment.type === 'record_cards') {
                    // A record-cards part, drawn where it sits: between the text around the call.
                    const cards = recordCards.get(index);
                    if (!cards) return null;
                    return (
                      <div key={index} className={CHAT_MESSAGE_SEGMENTS_CLASS} data-testid="chat-record-cards">
                        {cards.map(card => (
                          <div key={`r-${card.key}`}>{card.node}</div>
                        ))}
                      </div>
                    );
                  }
                  return null;
                })}
              </div>
            )}

            {timestamp && !showName && (
              <span className={cn('text-ods-text-secondary text-h6', isUser && 'justify-self-end')}>
                {formatMessageTimestamp(timestamp)}
              </span>
            )}

            {/* Attached entity-context chips (user bubbles). Read-only — no
              remove affordance once the message is sent (Figma 31:28709). */}
            {stripContextItems && stripContextItems.length > 0 && (
              <ChatContextChipStrip
                items={stripContextItems}
                resolveIcon={resolveContextIcon}
                renderItem={renderContextItem}
                className="mt-2"
              />
            )}
          </div>
        </div>
      </ChatAppearanceContext.Provider>
    );
  },
);

ChatMessageEnhanced.displayName = 'ChatMessageEnhanced';

const MemoizedChatMessageEnhanced = memo(ChatMessageEnhanced, (prevProps, nextProps) => {
  return (
    prevProps.role === nextProps.role &&
    prevProps.content === nextProps.content &&
    prevProps.name === nextProps.name &&
    prevProps.avatar === nextProps.avatar &&
    prevProps.isTyping === nextProps.isTyping &&
    prevProps.timestamp?.getTime() === nextProps.timestamp?.getTime() &&
    prevProps.showAvatar === nextProps.showAvatar &&
    prevProps.assistantType === nextProps.assistantType &&
    prevProps.approvalVariant === nextProps.approvalVariant &&
    prevProps.appearance === nextProps.appearance &&
    prevProps.authorType === nextProps.authorType &&
    prevProps.selfAuthorType === nextProps.selfAuthorType &&
    prevProps.nameEveryTurn === nextProps.nameEveryTurn &&
    prevProps.assistantIcon === nextProps.assistantIcon &&
    prevProps.className === nextProps.className &&
    // Reference equality — the host re-uses the same array instance per
    // message (it's set once on the optimistic send and never mutated).
    prevProps.contextItems === nextProps.contextItems &&
    prevProps.resolveContextIcon === nextProps.resolveContextIcon &&
    prevProps.renderContextItem === nextProps.renderContextItem &&
    // Host keeps this stable (module const / useCallback), so reference
    // equality holds across streaming chunks.
    prevProps.renderRecordChip === nextProps.renderRecordChip &&
    prevProps.renderEntityCard === nextProps.renderEntityCard &&
    // Reference equality: the reducer sets this once per answer and the host
    // forwards the same array instance, so it holds across streaming chunks.
    prevProps.refs === nextProps.refs &&
    // Same stability contract as the renderers above: hosts pass a `useCallback`
    // (EmbeddableChat passes its memoized `handleSend`), so this holds across
    // streaming chunks instead of re-rendering every ask card per chunk.
    prevProps.onAskSelect === nextProps.onAskSelect &&
    prevProps.NavLinkAnchor === nextProps.NavLinkAnchor
  );
});

MemoizedChatMessageEnhanced.displayName = 'MemoizedChatMessageEnhanced';

export { MemoizedChatMessageEnhanced as ChatMessageEnhanced };
