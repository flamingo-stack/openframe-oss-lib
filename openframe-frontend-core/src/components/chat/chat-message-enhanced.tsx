'use client';

import React, { forwardRef, memo, type ReactNode, useEffect, useMemo, useState } from 'react';
import {
  type ChatAskPart,
  type ChatFilePart,
  type ChatPart,
  type ChatSourcePart,
  type ChatToolPart,
  approvalBatchIdOf,
  approvalStatusOf,
  isSourcePart,
  isToolPart,
  textOfParts,
} from '../../chat-protocol/chat-message';
import { parseCitationHref, textWithCitationChips } from '../../chat-protocol/citations';
import { normalizeRecordUri, parseRecordHref, recordHref } from '../../chat-protocol/record-link';
import { CHAT_INTERRUPTED_NOTICE } from '../../chat-protocol/ui-chunks';
import { useChatRuntime } from '../../contexts/chat-runtime-context';
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
import { CitationChip, MessageCitationsProvider, useMessageCitations } from './citation-chip';
import { ContextCompactionDisplay } from './context-compaction-display';
import { BlockCard, type BlockCardProps } from './entity-cards/block-card';
import { chatCardLabel } from './entity-cards/dispatch';
import { ErrorMessageDisplay } from './error-message-display';
import { EscalationOfferMessage } from './escalation-offer-message';
import { RecordChipProvider } from './record-actions';
import { RecordChip } from './record-chip';
import { recordLinksInParts } from './record-links-in';
import { SuggestionsDisplay } from './suggestions-display';
import { SystemEventMessage } from './system-event-message';
import { ThinkingDisplay } from './thinking-display';
import { TicketEscalatedMessage } from './ticket-escalated-message';
import { TicketEventMessage } from './ticket-event-message';
import { ToolExecutionDisplay } from './tool-execution-display';
import type { ChatMessageEnhancedProps } from './types';
import { CHAT_APPEARANCE } from './types/chat.types';
import type { ChatMessageActions } from './types/message.types';
import { chatFilePartMarkdown } from './utils/chat-attachment-markdown';
import { sourceRowInputOf, sourceTitleOf } from './utils/cited-sources';
import {
  approvalBatchViewOf,
  approvalRequestDataOf,
  failedBeforeRunning,
  progressExecutionDataOf,
  toolExecutionDataOf,
  waitsOnAnotherTier,
} from './utils/tool-part-display';

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

/**
 * A RUN of consecutive `data-ask` parts is one paged card, not a stack of near-identical ones. Returns the run keyed by
 * the index of its FIRST part; the render draws the card there and skips every later index of the same run (an ask index
 * missing from this map is a tail member).
 */
function groupAskRuns(parts: readonly ChatPart[]): Map<number, ChatAskPart['data'][]> {
  const runs = new Map<number, ChatAskPart['data'][]>();
  let headIndex = -1;
  parts.forEach((part, index) => {
    if (part.type !== 'data-ask') {
      headIndex = -1;
      return;
    }
    if (headIndex === -1) {
      headIndex = index;
      runs.set(index, [part.data]);
      return;
    }
    runs.get(headIndex)?.push(part.data);
  });
  return runs;
}

/**
 * The tool parts of each batch, keyed by the index of the batch's FIRST part: the renderer draws a run with one
 * `batchId` as one card, wherever its rows sit, and skips every later index of the batch.
 */
function groupBatches(parts: readonly ChatPart[]): Map<number, ChatToolPart[]> {
  const heads = new Map<string, number>();
  const batches = new Map<number, ChatToolPart[]>();
  parts.forEach((part, index) => {
    if (!isToolPart(part)) return;
    const batchId = approvalBatchIdOf(part);
    if (batchId === undefined) return;
    const head = heads.get(batchId);
    if (head === undefined) {
      heads.set(batchId, index);
      batches.set(index, [part]);
    } else {
      batches.get(head)?.push(part);
    }
  });
  return batches;
}

/** A card's Approve or Reject: its button calls with the card's own id. */
function bound(handler: ((id: string) => unknown) | undefined, fallbackId: string) {
  return handler
    ? (requestId?: string) => handler(requestId ?? fallbackId) as void | boolean | Promise<void | boolean>
    : undefined;
}

/** The handlers of a card that resolves, or none: a thread with no way to act draws it read-only. */
function approvalHandlers(actions: ChatMessageActions | undefined, id: string) {
  return { onApprove: bound(actions?.approve, id), onReject: bound(actions?.reject, id) };
}

/** What a user attached, inside their bubble: the same two forms a bubble has always shown. */
function ChatFileParts({
  files,
  componentOverrides,
}: {
  files: ChatFilePart[];
  componentOverrides: React.ComponentProps<typeof SimpleMarkdownRenderer>['componentOverrides'];
}) {
  const viewUrlPrefix = useChatRuntime()?.endpoints.attachmentViewUrlPrefix;
  return (
    <SimpleMarkdownRenderer
      content={files.map(file => chatFilePartMarkdown(file, viewUrlPrefix)).join('\n\n')}
      textSize="compact"
      componentOverrides={componentOverrides}
    />
  );
}

const ChatMessageEnhanced = forwardRef<HTMLDivElement, ChatMessageEnhancedProps>(
  (
    {
      className,
      role,
      parts,
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
      actions,
      displayApprovalTypes,
      progress,
      interrupted = false,
      NavLinkAnchor,
      ...props
    },
    ref,
  ) => {
    // A `user` row is a PERSON (the end user, a technician); a `system` row is a line
    // said to the thread; the agent's turns are `assistant`. Which person is the viewer
    // is the thread's call (`selfAuthorType`): the viewer's own turns draw as the bubble
    // on the right, another person's as an incoming reply.
    const isSystemRow = role === 'system';
    const isHuman = role === 'user' || isSystemRow;
    const inheritedAppearance = useChatAppearance();
    const appearance = appearanceProp ?? inheritedAppearance;
    const isV2 = appearance === CHAT_APPEARANCE.V2;
    const authorType =
      authorTypeProp ?? (isSystemRow ? 'system' : isHuman ? 'user' : assistantType === 'mingo' ? 'mingo' : 'fae');
    const isOtherPerson =
      isHuman && selfAuthorType !== undefined && authorType !== 'system' && authorType !== selfAuthorType;
    const isUser = isHuman && !isOtherPerson;

    // What the renderer maps over: source parts are not drawn in the body, and a source arriving mid-answer (a cited
    // collection) must not shift an index and remount every part after it. A system row's words are its name line.
    const bodyParts = useMemo(
      () => (isSystemRow ? [] : parts.filter(part => !isSourcePart(part))),
      [isSystemRow, parts],
    );

    const citations = useMessageCitations(parts);
    const { sources, numbers } = citations;

    const askRuns = useMemo(() => groupAskRuns(bodyParts), [bodyParts]);
    const batches = useMemo(() => groupBatches(bodyParts), [bodyParts]);

    // Records the body links (`[name](record://type/id)`) are drawn inline, so they are left off the chip strip below.
    const inlineRecordIds = useMemo(() => new Set(recordLinksInParts(bodyParts).map(record => record.id)), [bodyParts]);

    // Chip strip = only context NOT already shown inline (e.g. `+`-added items).
    const stripContextItems = useMemo(
      () =>
        inlineRecordIds.size > 0 && contextItems
          ? contextItems.filter(it => !inlineRecordIds.has(it.id))
          : contextItems,
      [contextItems, inlineRecordIds],
    );

    /** The message's own source parts, by URI: what gives a card its title and link before its row loads. */
    const sourceByUri = useMemo(() => {
      const byUri = new Map<string, ChatSourcePart>();
      for (const source of sources) byUri.set(normalizeRecordUri(source.sourceId) ?? source.sourceId, source);
      return byUri;
    }, [sources]);

    /**
     * The answer's record cards, by part: each `data-record-cards` part (the model's `show_records` call, checked by the
     * server) is drawn where it sits in the message, between the text before and after the call, the way a tool's
     * widget sits in a reply. Never read out of the text: a record the text names is a chip there. A card takes its
     * title and url from the message's own source part with the same URI, else the name the text gives the record, and
     * loads the rest itself.
     *
     * Each card's node is kept across renders (same URI, same render function, same source part) so a card does not
     * remount, re-fetch or close its open menu on every streamed token.
     */
    const [recordCardCache] = useState(
      () =>
        new Map<
          string,
          {
            render: (ref: ChatRef) => React.ReactNode;
            source: ChatSourcePart | undefined;
            label: string;
            node: React.ReactNode;
          }
        >(),
    );
    const recordCards = useMemo(() => {
      const byPart = new Map<number, Array<{ key: string; node: React.ReactNode }>>();
      if (!renderEntityCard || isHuman) return byPart;
      if (!bodyParts.some(part => part.type === 'data-record-cards')) return byPart;
      const names = new Map(
        recordLinksInParts(bodyParts).map(record => [recordHref(record.type, record.id), record.label]),
      );
      const cache = recordCardCache;
      // One card per record in a message, where it first shows: every wire and stored row can name a record again.
      const shown = new Set<string>();
      bodyParts.forEach((part, index) => {
        if (part.type !== 'data-record-cards') return;
        const cards: Array<{ key: string; node: React.ReactNode }> = [];
        for (const uri of part.data.records) {
          const record = parseRecordHref(uri);
          // A type the chat draws no card for (a device, a script) stays a chip in the text.
          if (!record || (record.type !== 'video' && !chatCardLabel(record.type))) continue;
          const key = recordHref(record.type, record.id);
          if (shown.has(key)) continue;
          shown.add(key);
          const source = sourceByUri.get(key);
          const label = names.get(key) ?? '';
          let entry = cache.get(key);
          if (!entry || entry.render !== renderEntityCard || entry.source !== source || entry.label !== label) {
            const row = source ? sourceRowInputOf(source) : null;
            const cardRef: ChatRef = {
              type: record.type,
              id: record.id,
              title: source ? sourceTitleOf(source) : label,
              url: row?.externalUrl ?? null,
              // TODO(CU-17tkuw61kfy): an old doc source arrives with no url, and opens by its tree path.
              ...(row?.path ? { metadata: { path: row.path } } : {}),
            };
            const rendered = renderEntityCard(cardRef);
            // A block card (a video) draws its block here.
            const node =
              React.isValidElement(rendered) && rendered.type === BlockCard
                ? (rendered.props as BlockCardProps).children
                : rendered;
            entry = { render: renderEntityCard, source, label, node };
            cache.set(key, entry);
          }
          if (entry.node != null) cards.push({ key, node: entry.node });
        }
        if (cards.length > 0) byPart.set(index, cards);
      });
      return byPart;
    }, [renderEntityCard, isHuman, bodyParts, sourceByUri, recordCardCache]);

    useEffect(() => {
      const cache = recordCardCache;
      const shown = new Set([...recordCards.values()].flat().map(card => card.key));
      for (const key of [...cache.keys()]) if (!shown.has(key)) cache.delete(key);
    }, [recordCards, recordCardCache]);

    const cardComponentOverrides = useMemo(() => {
      return {
        // Override `<a>`: a record link becomes its chip; every other link goes through the host's navigation.
        a: ({ href, children, className: linkClassName, ...rest }: MdRenderProps<'a'>) => {
          // A citation's chip (`[3](#citation-3)`, written into a render-only copy of the text). Before the
          // anchor-only branch below, which would take it for a place on the page.
          const citationNumber = parseCitationHref(href);
          if (citationNumber !== null) return <CitationChip number={citationNumber} />;
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
      // the overrides keep one identity across a streaming turn and the markdown engine's block memoization holds. A
      // citation chip reads its message from context for this reason.
    }, [renderRecordChip, NavLinkAnchor]);

    /**
     * Body of a text part. `isStreaming` opts it into the markdown engine's streaming path (atomic-block memoization,
     * fence tail-completion, aria-live); only the actively streaming part gets it.
     */
    const renderTextBody = (text: string, isStreaming: boolean) => (
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
    const systemLine = isSystemRow ? textOfParts(parts) : '';
    const displayName = systemLine || name || (isHuman ? 'User' : assistantType === 'mingo' ? 'Mingo' : 'Fae');
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

    const hasBody = !isSystem || bodyParts.length > 0;
    const files = bodyParts.filter((part): part is ChatFilePart => part.type === 'file');
    const lastTextIndex = bodyParts.reduce(
      (last, part, index) => (part.type === 'text' && part.text.trim() !== '' ? index : last),
      -1,
    );
    // A stream cut before any text says so too: the notice is all that row has. Text of its own may say it already (a
    // server that writes the notice itself).
    const showInterruptedNotice = interrupted && !textOfParts(bodyParts).includes(CHAT_INTERRUPTED_NOTICE);

    // v2 draws a system line (e.g. a technician joining) as an in-thread
    // receipt card rather than as an author row with no body.
    const systemText = systemLine || name;
    if (isV2 && isSystem && systemText) {
      return (
        <div
          ref={ref}
          className={cn('relative', CHAT_MESSAGE_ROW_PADDING_CLASS[CHAT_APPEARANCE.V2], className)}
          {...props}
        >
          <ChatAppearanceContext.Provider value={appearance}>
            <SystemEventMessage text={systemText} timestamp={timestamp} />
          </ChatAppearanceContext.Provider>
        </div>
      );
    }

    return (
      <ChatAppearanceContext.Provider value={appearance}>
        <MessageCitationsProvider value={citations}>
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

            Single-column GRID, not `flex flex-col` — here, in the part
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

              {/* The message's parts, in order, under the turn's stage rows. Hidden for a system line: its words are the
              name line above. */}
              {hasBody && (
                <div className={CHAT_MESSAGE_SEGMENTS_CLASS}>
                  {progress?.map(row => (
                    <ToolExecutionDisplay
                      key={row.id}
                      message={progressExecutionDataOf(row)}
                      assistantType={assistantType}
                      variant={approvalVariant}
                    />
                  ))}
                  {bodyParts.map((part, index) => {
                    // The engine's streaming path (atomic-block memoization +
                    // fence tail-completion + aria-live) applies ONLY to the
                    // actively streaming part: the last part of a message that
                    // is still typing. On completion `isTyping` flips false and
                    // the engine does one authoritative whole-document parse.
                    const partIsStreaming = index === bodyParts.length - 1 && !!isTyping;
                    switch (part.type) {
                      case 'text': {
                        // Whitespace between two cards draws nothing, not an empty block with its gap.
                        if (part.text.trim() === '') return null;
                        // The layout of Claude and ChatGPT: what the USER said is a
                        // bubble on the right; what anyone else says is plain text
                        // across the thread's full width, with no bubble. Nothing
                        // takes a column, so every line gets the whole width (the
                        // speaker's face is the short line above).
                        if (isUser) {
                          return (
                            <div key={index} className={CHAT_MESSAGE_USER_ROW_CLASS}>
                              <div className={CHAT_MESSAGE_USER_BUBBLE_CLASS}>
                                {renderTextBody(part.text, partIsStreaming)}
                                {index === lastTextIndex && files.length > 0 && (
                                  <ChatFileParts files={files} componentOverrides={cardComponentOverrides} />
                                )}
                              </div>
                            </div>
                          );
                        }
                        return (
                          <div key={index} className={cn(CHAT_MESSAGE_TEXT_CLASS, 'text-ods-text-primary')}>
                            {renderTextBody(textWithCitationChips(part, numbers), partIsStreaming)}
                            {index === lastTextIndex && files.length > 0 && (
                              <ChatFileParts files={files} componentOverrides={cardComponentOverrides} />
                            )}
                          </div>
                        );
                      }
                      case 'file':
                        // In the bubble of the text beside it. A message of attachments alone has a bubble of its own.
                        if (lastTextIndex !== -1 || part !== files[0]) return null;
                        return (
                          <div key={index} className={CHAT_MESSAGE_USER_ROW_CLASS}>
                            <div className={CHAT_MESSAGE_USER_BUBBLE_CLASS}>
                              <ChatFileParts files={files} componentOverrides={cardComponentOverrides} />
                            </div>
                          </div>
                        );
                      case 'data-ask': {
                        // Only the run's head draws: the tail parts are pages of the card already drawn above them.
                        const run = askRuns.get(index);
                        if (!run) return null;
                        return <AskDisplay key={index} cards={run} onSelect={actions?.selectAsk} />;
                      }
                      case 'data-suggestions':
                        return <SuggestionsDisplay key={index} data={part.data} onPick={actions?.pickSuggestion} />;
                      case 'dynamic-tool': {
                        if (approvalBatchIdOf(part) !== undefined) {
                          const batch = batches.get(index);
                          if (!batch || batch.some(row => waitsOnAnotherTier(row, displayApprovalTypes))) return null;
                          const view = approvalBatchViewOf(batch);
                          return (
                            <ApprovalBatchMessage
                              key={index}
                              data={view.data}
                              status={view.status}
                              resolvedByName={view.resolvedByName}
                              {...approvalHandlers(actions, view.data.approvalRequestId)}
                              assistantType={assistantType}
                              variant={approvalVariant}
                            />
                          );
                        }
                        if (failedBeforeRunning(part) && part.state === 'output-error') {
                          return <ErrorMessageDisplay key={index} title={part.errorText} />;
                        }
                        const approval = approvalRequestDataOf(part);
                        if (!approval) {
                          return (
                            <ToolExecutionDisplay
                              key={index}
                              message={toolExecutionDataOf(part)}
                              assistantType={assistantType}
                              variant={approvalVariant}
                            />
                          );
                        }
                        if (waitsOnAnotherTier(part, displayApprovalTypes)) return null;
                        return (
                          <React.Fragment key={index}>
                            <ApprovalRequestMessage
                              data={approval}
                              status={approvalStatusOf(part) ?? undefined}
                              resolvedByName={part.toolMetadata?.resolvedByName}
                              {...approvalHandlers(actions, approval.requestId ?? part.toolCallId)}
                              assistantType={assistantType}
                              variant={approvalVariant}
                            />
                            {/* Approved and refused all the same (an expired proposal): the card stays, and says why. */}
                            {part.state === 'output-error' && <ErrorMessageDisplay title={part.errorText} />}
                          </React.Fragment>
                        );
                      }
                      case 'data-escalation-offer':
                        return (
                          <EscalationOfferMessage
                            key={index}
                            data={{ offerId: part.id, text: part.data.text ?? '', origin: part.data.origin }}
                            status={part.data.status}
                            resolvedByName={part.data.resolvedByName}
                            onApprove={bound(actions?.approveEscalation, part.id)}
                            onReject={bound(actions?.rejectEscalation, part.id)}
                          />
                        );
                      case 'data-ticket-escalated':
                        return <TicketEscalatedMessage key={index} data={part.data} timestamp={timestamp} />;
                      case 'data-ticket-event':
                        // The card's own event time; the bubble timestamp is the
                        // turn's FIRST row and lags every later lifecycle event.
                        return (
                          <TicketEventMessage
                            key={index}
                            data={part.data}
                            timestamp={part.data.occurredAt ? new Date(part.data.occurredAt) : timestamp}
                          />
                        );
                      case 'data-error':
                        return <ErrorMessageDisplay key={index} title={part.data.title} details={part.data.details} />;
                      case 'data-context-compaction':
                        return <ContextCompactionDisplay key={index} status={part.data.status} />;
                      case 'reasoning':
                        return <ThinkingDisplay key={index} text={part.text} isStreaming={partIsStreaming} />;
                      case 'data-record-cards': {
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
                      default:
                        return null;
                    }
                  })}
                  {showInterruptedNotice && (
                    <p className="text-ods-text-secondary text-h6">{CHAT_INTERRUPTED_NOTICE}</p>
                  )}
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
        </MessageCitationsProvider>
      </ChatAppearanceContext.Provider>
    );
  },
);

ChatMessageEnhanced.displayName = 'ChatMessageEnhanced';

const MemoizedChatMessageEnhanced = memo(ChatMessageEnhanced, (prevProps, nextProps) => {
  return (
    prevProps.role === nextProps.role &&
    // Copy-on-write: an unchanged message keeps its array, however long the thread.
    prevProps.parts === nextProps.parts &&
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
    // A stable object from each adapter, so this holds across streaming chunks instead of re-rendering every card.
    prevProps.actions === nextProps.actions &&
    prevProps.displayApprovalTypes === nextProps.displayApprovalTypes &&
    prevProps.progress === nextProps.progress &&
    prevProps.interrupted === nextProps.interrupted &&
    prevProps.NavLinkAnchor === nextProps.NavLinkAnchor
  );
});

MemoizedChatMessageEnhanced.displayName = 'MemoizedChatMessageEnhanced';

export { MemoizedChatMessageEnhanced as ChatMessageEnhanced };
