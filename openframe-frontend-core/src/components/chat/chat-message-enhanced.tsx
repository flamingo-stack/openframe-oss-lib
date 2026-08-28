'use client';

import React, { forwardRef, memo, useEffect, useMemo, useRef } from 'react';
import { cn } from '../../utils/cn';
import { isToday } from '../../utils/date-utils';
import { formatDate, formatTime } from '../../utils/format-date';
import type { MdRenderProps } from '../ui/markdown/base-components';
import { SimpleMarkdownRenderer } from '../ui/markdown/simple-markdown-renderer';
import { SquareAvatar } from '../ui/square-avatar';
import { ApprovalBatchMessage } from './approval-batch-message';
import { ApprovalRequestMessage } from './approval-request-message';
import { AskDisplay } from './ask-display';
import { ChatContextChipStrip } from './chat-context-picker';
import type { ChatRef } from './chat-ref.types';
import { ContextCompactionDisplay } from './context-compaction-display';
import { BlockCard, type BlockCardProps } from './entity-cards/block-card';
import { ErrorMessageDisplay } from './error-message-display';
import { EscalationOfferMessage } from './escalation-offer-message';
import { GuideDisplay } from './guide-display';
import { remarkCardLinks } from './remark-card-links';
import { remarkMentionChips } from './remark-mention-chips';
import { remarkStripCitations } from './remark-strip-citations';
import { ThinkingDisplay } from './thinking-display';
import { TicketEscalatedMessage } from './ticket-escalated-message';
import { TicketEventMessage } from './ticket-event-message';
import { ToolExecutionDisplay } from './tool-execution-display';
import type { AskSegment, MessageSegment, MessageContent, ChatMessageEnhancedProps } from './types';

/** Inline `@marker:id` mention token in the message body (sibling of the
 *  `[card://]` grammar) — used to filter out items rendered inline from the
 *  chip strip below. MUST mirror the left-boundary `(^|\s)` of `MENTION_REGEX`
 *  in `remark-mention-chips.ts`: without it this regex is WIDER than the plugin
 *  (e.g. it matches `x@device:1` mid-word, which the plugin skips), so a context
 *  item would be stripped from the chip strip yet never rendered inline — lost
 *  from display entirely. The id is capture group 2 (group 1 is the boundary).
 *  Marker `[a-zA-Z]+` (markers are mostly lowercase but not all — e.g.
 *  `scheduledScript`); id is the mention-token charset. */
const MENTION_MARKER_REGEX = /(^|[^\w@])@[a-zA-Z]+:([A-Za-z0-9_.+/=-]*[A-Za-z0-9_+/=])/g;

/**
 * Same regex shape as `remarkCardLinks` — kept in lockstep so the
 * pre-scan and the remark plugin see the SAME set of markers. If the
 * grammar widens (today: snake_case OR kebab-case; closer `]` OR `)`),
 * both files must update.
 */
const CARD_MARKER_REGEX = /\[card:\/\/([a-zA-Z0-9_-]+):([a-zA-Z0-9_-]+)[\])]/g;

/** Timestamp label: today's messages show time only ("2:47 PM"),
 *  older messages prepend a locale-formatted date ("05/05/2026 2:47 PM"
 *  in en-US, "05.05.2026 14:47" in european locales). */
function formatMessageTimestamp(timestamp: Date): string {
  const time = formatTime(timestamp);
  return isToday(timestamp) ? time : `${formatDate(timestamp)} ${time}`;
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
      authorType: authorTypeProp,
      assistantIcon,
      contextItems,
      resolveContextIcon,
      renderContextItem,
      renderMention,
      renderEntityCard,
      onAskSelect,
      NavLinkAnchor,
      ...props
    },
    ref,
  ) => {
    const isUser = role === 'user';
    const isError = role === 'error';
    const authorType = authorTypeProp ?? (isUser ? 'user' : assistantType === 'mingo' ? 'mingo' : 'fae');

    // Inline-card rendering uses a HOST-PROVIDED `renderEntityCard` function
    // (v6.1 §B.2.7 — DRY duplications #2). The OSS-lib stays data-agnostic:
    // it doesn't know about entity types, slash commands, or app routing.
    // The host (multi-platform-hub) returns whatever JSX it wants for each
    // marker's descriptor — typically a self-fetching card that hydrates by
    // id from the host's per-object APIs.
    //
    // The remark plugin runs whenever the host opts in with
    // `renderEntityCard`, so we always strip raw markers from rendered text
    // (Logic MED-4). When the host's `renderEntityCard` is unset OR returns
    // null, the override falls back to the bare cardId. Never renders the
    // literal `[card://...]` URL.
    const hasMarkerSupport = !!renderEntityCard;

    const segments = useMemo(() => normalizeContent(content), [content]);

    const askRuns = useMemo(() => groupAskRuns(segments), [segments]);

    // Inline `@marker:id` mentions: the composer commits these tokens when the
    // user picks context via the `@`-flow, and the ASSISTANT routinely echoes
    // the same `@device:machineId` token back in its reply. The lib detects the
    // token and delegates rendering to the host's `renderMention` (mirror of
    // `renderEntityCard`): the host returns a SELF-FETCHING chip per entity
    // type. Enabled whenever the host opts in by supplying `renderMention`.
    const hasMentionSupport = !!renderMention;

    // Ids that appear as `@marker:id` in the body → rendered inline, so they are
    // excluded from the chip strip below (no duplicate inline + strip).
    const inlineMentionIds = useMemo(() => {
      const ids = new Set<string>();
      if (!hasMentionSupport) return ids;
      for (const seg of segments) {
        if (seg.type !== 'text' || !seg.text || !seg.text.includes('@')) continue;
        for (const mm of seg.text.matchAll(MENTION_MARKER_REGEX)) ids.add(mm[2]);
      }
      return ids;
    }, [hasMentionSupport, segments]);

    // Chip strip = only context NOT already shown inline (e.g. `+`-added items).
    const stripContextItems = useMemo(
      () =>
        inlineMentionIds.size > 0 && contextItems
          ? contextItems.filter(it => !inlineMentionIds.has(it.id))
          : contextItems,
      [contextItems, inlineMentionIds],
    );

    // Markdown plugins per message: card markers (assistant) + mention tokens
    // (user). Each is gated independently so neither fires without its data.
    const cardRemarkPlugins = useMemo(
      () => [
        ...(hasMarkerSupport ? [remarkCardLinks, remarkStripCitations] : []),
        ...(hasMentionSupport ? [remarkMentionChips] : []),
      ],
      [hasMarkerSupport, hasMentionSupport],
    );

    // Cross-render cache of rendered inline-card nodes, keyed by `type:id`.
    // A fetch-mode card lives inside the assistant message, which re-renders on
    // every stream chunk (and the whole list re-renders when a new message
    // arrives). `renderEntityCard` produces a FRESH element each time, so React
    // re-mounts the card — closing any open menu/popover and re-triggering its
    // fetch. Caching the produced node by key and returning the SAME element
    // reference lets React bail out of re-rendering that subtree, so the card
    // (and its open menu) survives across chunks. Invalidated per key when the
    // render fn identity changes.
    const renderedCardNodeCache = useRef(
      new Map<string, { render: ((ref: ChatRef) => React.ReactNode) | undefined; node: React.ReactNode }>(),
    );

    /**
     * Per-message rendering plan for `[card://type:id]` markers.
     *
     * Block-bearing markers SPLIT their containing text segment so the
     * block payload (e.g. video player) renders AT THE MARKER POSITION
     * in the text flow — not at the end of the segment, which causes
     * the block to "appear high and drift down" while text streams in.
     *
     * Per-segment output is an array of parts:
     *   - `{ kind: 'text' }` — substring of the segment text, rendered
     *                         through `<SimpleMarkdownRenderer>`. Ends
     *                         with the block marker so the inline pill
     *                         lands at the right spot via the `<a>`
     *                         override.
     *   - `{ kind: 'block' }` — block payload, rendered as a sibling
     *                         BELOW the preceding text chunk and above
     *                         the next one.
     *
     * Inline-only markers (no `<BlockCard>` wrapper) do NOT split the
     * segment; they're handled by the override at marker position via
     * the shared `inlineByKey` map.
     *
     * Streaming behaviour: as a marker becomes complete in the streamed
     * text, the regex matches, the segment splits at that point, and
     * the block card lands right after the inline pill. Subsequent
     * tokens render in the trailing chunk — block stays in position.
     */
    const renderingPlan = useMemo(() => {
      if (!hasMarkerSupport) return null;
      const render = renderEntityCard;
      const inlineByKey = new Map<string, React.ReactNode>();
      type SegmentPart = { kind: 'text'; text: string } | { kind: 'block'; key: string; node: React.ReactNode };
      const partsBySegment = new Map<number, SegmentPart[]>();
      const usedKeys = new Set<string>();
      if (!render) return { inlineByKey, partsBySegment, usedKeys };
      const cache = renderedCardNodeCache.current;
      // Card keys already emitted as a hoisted block (`b-<key>`). The same
      // marker can legitimately appear twice in one message (LLM references
      // the same entity twice); we hoist the FIRST occurrence and skip the
      // duplicates so two siblings never collide on the same React key.
      const emittedBlockKeys = new Set<string>();
      segments.forEach((segment, segIdx) => {
        // Both markdown-bearing segment types take part: a `guide` body is
        // authored by the same LLM and carries the same `[card://]` markers,
        // so skipping it here left its markers with no `inlineByKey` entry and
        // no hoisted card — the `<a card://>` override silently degraded them
        // to a bare title / id.
        if (segment.type !== 'text' && segment.type !== 'guide') return;
        const text = segment.text;
        const parts: SegmentPart[] = [];
        let cursor = 0;
        CARD_MARKER_REGEX.lastIndex = 0;
        let match: RegExpExecArray | null;
        while ((match = CARD_MARKER_REGEX.exec(text)) !== null) {
          const cardType = match[1];
          const cardId = match[2];
          const key = `${cardType}:${cardId}`;
          usedKeys.add(key);
          // Reuse the cached node when the render fn didn't change —
          // returning the SAME element reference across renders is what
          // stops React from re-mounting the card (and closing its open
          // menu / re-fetching) on every stream chunk. Also dedups the same
          // key emitted twice within one message.
          let entry = cache.get(key);
          if (!entry || entry.render !== render) {
            // The marker is the ONLY data on the wire: cards hydrate by id
            // from the host's per-object APIs, so a minimal {type, id}
            // descriptor is all the renderer needs to mount the loader.
            // For types with nothing to fetch the host's render() returns
            // null and we fall through to the bare-cardId fallback in the
            // `<a card://…>` override below.
            //
            // DESCRIPTOR DEFAULTS: `ChatRef.title` and `ChatRef.url` are
            // non-optional in the type; a bare `{type, id}` cast would lie
            // to consumers that read those fields. Default `title` to the
            // cardId (so any host renderer that prints `ref.title` shows
            // the id rather than `undefined`) and `url` to null (matches
            // the no-link semantics fetch-mode cards rely on — they
            // resolve their own URL after fetch).
            const refForRender: ChatRef = {
              type: cardType,
              id: cardId,
              title: cardId,
              url: null,
            };
            entry = { render, node: render(refForRender) };
            cache.set(key, entry);
          }
          const rendered = entry.node;
          if (React.isValidElement(rendered) && rendered.type === BlockCard) {
            const cardProps = rendered.props as BlockCardProps;
            const markerEnd = match.index + match[0].length;
            // Text chunk INCLUDING the marker — the inline pill renders
            // at the marker position via the `<a>` override.
            parts.push({ kind: 'text', text: text.slice(cursor, markerEnd) });
            // Hoist the block payload only on the FIRST occurrence of this key
            // — a repeated marker still gets its inline pill (text + override
            // above) but must not push a second `b-<key>` sibling.
            if (!emittedBlockKeys.has(key)) {
              emittedBlockKeys.add(key);
              parts.push({ kind: 'block', key, node: cardProps.children });
            }
            cursor = markerEnd;
            inlineByKey.set(
              key,
              cardProps.inline != null ? (
                cardProps.inline
              ) : (
                <span className="font-medium text-ods-text-primary">{cardId}</span>
              ),
            );
          } else if (rendered != null) {
            // Hoist fetch-mode entity cards (roadmap/blog/case-study/release/…)
            // OUT of the markdown as stable-keyed block siblings — exactly like
            // BlockCard. Rendered INSIDE `<SimpleMarkdownRenderer>` they remount
            // on every streaming re-parse (react-markdown rebuilds its subtree
            // token-by-token), which closes any open menu/popover and re-fires
            // the card's fetch. As a sibling keyed by the card key (`b-<key>`)
            // the card survives streaming: appending more text/markers only adds
            // NEW siblings, existing cards keep their React instance.
            //
            // We EXCLUDE the marker from the surrounding text (cursor jumps past
            // it) so no inline pill renders — the full card IS the content.
            // Hoist only the FIRST occurrence; a duplicate marker is dropped
            // entirely (no inline pill for hoisted cards) so we never push a
            // second sibling colliding on the same `b-<key>` React key.
            parts.push({ kind: 'text', text: text.slice(cursor, match.index) });
            if (!emittedBlockKeys.has(key)) {
              emittedBlockKeys.add(key);
              parts.push({ kind: 'block', key, node: rendered });
            }
            cursor = match.index + match[0].length;
          }
        }
        // Trailing text after the last block marker (or the entire
        // segment when no block markers fired).
        if (cursor < text.length) {
          parts.push({ kind: 'text', text: text.slice(cursor) });
        }
        // Only register the split plan when at least one block marker
        // fired — otherwise the segment renders as one SimpleMarkdown-
        // Renderer call (existing behaviour preserved for the
        // overwhelming majority of segments that have no block cards).
        if (parts.some(p => p.kind === 'block')) {
          partsBySegment.set(segIdx, parts);
        }
      });
      return { inlineByKey, partsBySegment, usedKeys };
    }, [hasMarkerSupport, renderEntityCard, segments]);

    // Drop cached nodes for markers no longer present so the cache can't grow
    // unbounded as a long message's markers change. Deliberately an EFFECT,
    // not part of the memo above: pruning is a mutation, and doing it in the
    // render phase is non-idempotent (StrictMode's double-invoke, or a render
    // React throws away, would evict nodes the committed tree still uses and
    // remount the cards it was built to preserve).
    useEffect(() => {
      const cache = renderedCardNodeCache.current;
      const usedKeys = renderingPlan?.usedKeys;
      if (!usedKeys) return;
      if (cache.size <= usedKeys.size) return;
      for (const k of [...cache.keys()]) {
        if (!usedKeys.has(k)) cache.delete(k);
      }
    }, [renderingPlan]);

    // The plan is read through a REF inside the `<a>` override, not captured
    // in the override's closure. `renderingPlan` is rebuilt on every text
    // delta (its `segments` dep is a fresh array per delta), so depending on
    // it here would give `cardComponentOverrides` a new identity every token
    // — which re-creates the markdown engine's `components` memo and defeats
    // its per-block `StreamingBlockRenderer` memoization for the WHOLE
    // message, on every token. The ref keeps the override identity stable
    // while still reading the current plan at call time.
    const renderingPlanRef = useRef(renderingPlan);
    renderingPlanRef.current = renderingPlan;

    const cardComponentOverrides = useMemo(() => {
      if (!hasMarkerSupport && !hasMentionSupport) return undefined;
      return {
        // Override `<a>` to detect `card://` URLs emitted by `remarkCardLinks`.
        // The render result was pre-computed in `renderingPlan` so block-level
        // payloads (e.g. video player cards) can be hoisted out of the
        // paragraph as siblings — the inline pill stays at the marker
        // position. Other href schemes pass through unchanged.
        a: ({ href, children, className: linkClassName, ...rest }: MdRenderProps<'a'>) => {
          // Inline entity mention `@marker:id`, emitted as a `mention://marker:id`
          // link by `remarkMentionChips`. Delegate to the host's `renderMention`
          // (mirror of the `card://` → `renderEntityCard` path): the host returns
          // a self-fetching chip for that entity type. Null/unknown → raw token.
          if (typeof href === 'string' && href.startsWith('mention://')) {
            const stripped = href.slice('mention://'.length);
            const sepIdx = stripped.indexOf(':');
            const marker = sepIdx === -1 ? stripped : stripped.slice(0, sepIdx);
            const id = sepIdx === -1 ? '' : stripped.slice(sepIdx + 1);
            const node = renderMention?.({ marker, id });
            if (node != null) return <>{node}</>;
            return <span className="text-ods-text-secondary opacity-60">{children}</span>;
          }
          if (typeof href === 'string' && href.startsWith('card://')) {
            const stripped = href.slice('card://'.length);
            const sepIdx = stripped.lastIndexOf(':');
            if (sepIdx !== -1) {
              const cardType = stripped.slice(0, sepIdx);
              const cardId = stripped.slice(sepIdx + 1);
              const key = `${cardType}:${cardId}`;
              const inline = renderingPlanRef.current?.inlineByKey.get(key);
              if (inline != null) return inline;
              // No rendered card for this marker (the host's renderer
              // returned null — no card type registered for `cardType`, or
              // the id resolved to nothing). Render the raw `cardId` as a
              // dim span so the marker never LOOKS like a real card: a
              // hallucinated id must stay visibly broken, never dressed up
              // with borrowed data.
              return <span className="text-ods-text-secondary opacity-60">{cardId}</span>;
            }
          }
          // Unified click rule — delegated to the host's `NavLinkAnchor`
          // component. The host wraps its own `useNavLink` hook so EVERY
          // clickable surface (source chips, inline cards, search rows,
          // action cards, chat-markdown links) shares the same routing
          // decision: modifier-clicks pass through, cross-origin → new
          // tab, in-page doc-tree path → soft swap, same-origin → soft
          // RSC nav. Single mental model across the app, single source
          // of truth in the hub.
          //
          // Anchor-only links (`#section`) bypass NavLinkAnchor — the
          // host's router would treat them as navigation, but the user
          // wants the browser's native scroll-to-anchor behavior.
          //
          // When the host has NOT supplied `NavLinkAnchor` (e.g. the
          // flamingo hero-demo with mock content), fall back to a plain
          // `<a href>`. No cross-origin sniffing here — the OSS-lib does
          // not own routing decisions; the host does.
          if (typeof href === 'string' && NavLinkAnchor && !href.startsWith('#')) {
            return (
              <NavLinkAnchor href={href} className={linkClassName} {...rest}>
                {children}
              </NavLinkAnchor>
            );
          }
          return (
            <a href={href} className={linkClassName} {...rest}>
              {children}
            </a>
          );
        },
      };
      // DEPS ARE DELIBERATELY MINIMAL — every one of them is stable across a
      // streaming turn (booleans + host-stable fn/component identities, both
      // enforced by this file's `memo` comparator). The rendering plan is
      // read through a ref above precisely so it does NOT appear here.
    }, [hasMarkerSupport, hasMentionSupport, renderMention, NavLinkAnchor]);

    /**
     * Body of a markdown-bearing segment (`text` / `guide`).
     *
     * No block markers in this segment → a single SimpleMarkdownRenderer call
     * (the vast majority of messages). Otherwise the text is split at each
     * marker and block payloads are interleaved: each text chunk includes its
     * trailing marker so the inline pill renders at the right position via the
     * `<a>` override, and block payloads land AS SIBLINGS between text chunks —
     * HTML-valid (block DOM never nests inside `<p>`) AND positionally correct
     * (the block appears where the marker is in the flow, not at the segment's
     * end). Stable React keys come from the card key (block) and chunk position
     * (text); streaming token-by-token reuses the same React instances so
     * `<Video>` doesn't remount mid-play.
     *
     * `isStreaming` opts the segment into the markdown engine's streaming path
     * (atomic-block memoization + fence tail-completion + aria-live). Only the
     * actively streaming segment gets it, and within a marker-split segment
     * only the LAST text chunk — the earlier chunks are already final.
     */
    const renderSegmentBody = (segIndex: number, text: string, isStreaming: boolean) => {
      const parts = renderingPlan?.partsBySegment.get(segIndex);
      if (!parts || parts.length === 0) {
        return (
          <SimpleMarkdownRenderer
            content={text}
            textSize="compact"
            additionalRemarkPlugins={cardRemarkPlugins}
            componentOverrides={cardComponentOverrides}
            streaming={isStreaming}
          />
        );
      }
      return parts.map((part, pIdx) => {
        if (part.kind === 'text') {
          return (
            <SimpleMarkdownRenderer
              key={`t-${pIdx}`}
              content={part.text}
              textSize="compact"
              additionalRemarkPlugins={cardRemarkPlugins}
              componentOverrides={cardComponentOverrides}
              streaming={isStreaming && pIdx === parts.length - 1}
            />
          );
        }
        return (
          <div key={`b-${part.key}`} className="my-3">
            {part.node}
          </div>
        );
      });
    };

    const getAvatarProps = () => {
      const displayName = name || (isUser ? 'User' : assistantType === 'mingo' ? 'Mingo' : 'Fae');
      const isMingo = assistantType === 'mingo';

      return {
        src: avatar || undefined,
        alt: `${displayName} avatar`,
        // Pass the FULL name — SquareAvatar derives first+last initials itself
        // (passing pre-joined initials like "PS" would collapse to one letter,
        // since getFirstLastInitials treats it as a single word).
        fallback: displayName,
        size: 'sm' as const,
        variant: 'round' as const,
        // User avatar: compact 20×20 with 2px padding and a subtle gray fill
        // (`bg-ods-card`) so the `border-ods-border` ring stays visible — the
        // brand fill reads poorly for a user. Assistant/Fae keep their brand
        // fill. Initials are smaller + muted gray for the user placeholder.
        ...(isUser ? { initialsClassName: 'text-[9px] text-ods-text-secondary' } : {}),
        className: cn(
          'flex-shrink-0',
          isUser ? 'h-5 w-5 bg-ods-card p-0.5' : isMingo ? 'bg-ods-flamingo-cyan' : 'bg-ods-flamingo-pink',
        ),
      };
    };

    const avatarProps = getAvatarProps();

    const isSystem = authorType === 'system';

    return (
      <div ref={ref} className={cn('relative py-[var(--spacing-system-s)]', className)} {...props}>
        {/* Message Content — full panel width.
            Avatar is INLINE in the name row below (2025-2026 chat
            pattern — Claude.ai, ChatGPT, Gemini, Perplexity).
            Legacy hanging-avatar layout (`absolute -left-16`) wasted
            64px of gutter and clipped in narrow panels. */}
        <div className="flex min-w-0 flex-col gap-[var(--spacing-system-xxs)]">
          {/* Avatar + Name + Timestamp Row.
              Sizing rationale (per design-token measurements):
                - Name uses `text-h3` = 14px mobile / 18px desktop.
                - Avatar uses `SquareAvatar size="sm"` = 32px — the
                  canonical primitive at the smallest preset, giving a
                  ~1.78x ratio against the 18px name text (Material
                  Design 3 + Apple HIG inline-avatar standard).
                - Gap is `var(--spacing-system-xs)` = 8px, the standard
                  inline-component separator across this design system.
              For the `assistantIcon` branch (host supplies a JSX icon
              like the Mingo logo), the wrapper matches `SquareAvatar
              size="sm"` (h-8 w-8 = 32px) so BOTH branches present at
              the same visual weight. Host-supplied icons render
              inside via `flex items-center justify-center` — they
              should be sized at ~50-60% of the wrapper (h-4 w-4 =
              16px works well for a 32px circle). */}
          <div className="flex items-center gap-[var(--spacing-system-xs)]">
            {/* Avatar rules:
                - Assistant/Fae always show an avatar — host brand icon when no
                  image is supplied, else the filled SquareAvatar.
                - User shows the SquareAvatar ONLY when an avatar image actually
                  arrived. With no user avatar we hide the block entirely (just
                  the name), instead of an initials placeholder. TEMPORARY —
                  restore the user placeholder when user avatars ship. */}
            {showAvatar &&
              !isSystem &&
              !(isUser && !avatar) &&
              (!isUser && assistantIcon && !avatar ? (
                // Host-supplied brand icon (e.g. Mingo): render it directly,
                // no filled pill — the icon carries its own brand accent.
                <div className="flex flex-shrink-0 items-center justify-center">{assistantIcon}</div>
              ) : (
                <SquareAvatar {...avatarProps} />
              ))}
            <span
              className={cn(
                'flex-1 !font-mono !font-medium text-h3',
                authorType === 'system'
                  ? 'text-ods-open-yellow'
                  : authorType === 'admin'
                    ? 'text-ods-open-yellow'
                    : authorType === 'mingo'
                      ? 'text-ods-flamingo-cyan'
                      : authorType === 'fae'
                        ? 'text-ods-flamingo-pink'
                        : 'text-ods-text-secondary',
              )}
            >
              {name || (isUser ? 'User' : assistantType === 'mingo' ? 'Mingo' : 'Fae')}
              {!isSystem && ':'}
            </span>
            {timestamp && (
              <span className="shrink-0 whitespace-nowrap text-ods-text-secondary text-h6">
                {formatMessageTimestamp(timestamp)}
              </span>
            )}
          </div>

          {/* Message segments — hidden for system messages without content */}
          {(!isSystem || segments.length > 0) && (
            <div className="flex flex-col gap-2">
              {segments.map((segment, index) => {
                // The engine's streaming path (atomic-block memoization +
                // fence tail-completion + aria-live) applies ONLY to the
                // actively streaming segment: last segment of a message that
                // is still typing. On completion `isTyping` flips false and
                // the engine does one authoritative whole-document parse.
                const segmentIsStreaming = index === segments.length - 1 && !!isTyping;
                if (segment.type === 'text') {
                  return (
                    <div
                      key={index}
                      className={cn(
                        'w-full min-w-0 break-words text-h4',
                        isError ? 'text-ods-error' : 'text-ods-text-primary',
                      )}
                    >
                      {renderSegmentBody(index, segment.text, segmentIsStreaming)}
                    </div>
                  );
                } else if (segment.type === 'guide') {
                  return (
                    <GuideDisplay key={index}>
                      {renderSegmentBody(index, segment.text, segmentIsStreaming)}
                    </GuideDisplay>
                  );
                } else if (segment.type === 'ask') {
                  // Only the run's head draws — the tail segments are pages of
                  // the card already rendered above them.
                  const run = askRuns.get(index);
                  if (!run) return null;
                  return <AskDisplay key={index} cards={run} onSelect={onAskSelect} />;
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
                }
                return null;
              })}
            </div>
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
    prevProps.authorType === nextProps.authorType &&
    prevProps.assistantIcon === nextProps.assistantIcon &&
    prevProps.className === nextProps.className &&
    // Reference equality — the host re-uses the same array instance per
    // message (it's set once on the optimistic send and never mutated).
    prevProps.contextItems === nextProps.contextItems &&
    prevProps.resolveContextIcon === nextProps.resolveContextIcon &&
    prevProps.renderContextItem === nextProps.renderContextItem &&
    // Host keeps this stable (module const / useCallback), so reference
    // equality holds across streaming chunks.
    prevProps.renderMention === nextProps.renderMention &&
    prevProps.renderEntityCard === nextProps.renderEntityCard &&
    // Same stability contract as the renderers above: hosts pass a `useCallback`
    // (EmbeddableChat passes its memoized `handleSend`), so this holds across
    // streaming chunks instead of re-rendering every ask card per chunk.
    prevProps.onAskSelect === nextProps.onAskSelect &&
    prevProps.NavLinkAnchor === nextProps.NavLinkAnchor
  );
});

MemoizedChatMessageEnhanced.displayName = 'MemoizedChatMessageEnhanced';

export { MemoizedChatMessageEnhanced as ChatMessageEnhanced };
