"use client"

import React, { forwardRef, memo, useEffect, useMemo, useRef } from "react"
import { cn } from "../../utils/cn"
import { isToday } from "../../utils/date-utils"
import { formatDate, formatTime } from "../../utils/format-date"
import { SquareAvatar } from "../ui/square-avatar"
import { ToolExecutionDisplay } from "./tool-execution-display"
import { ApprovalRequestMessage } from "./approval-request-message"
import { ApprovalBatchMessage } from "./approval-batch-message"
import { ErrorMessageDisplay } from "./error-message-display"
import { ContextCompactionDisplay } from "./context-compaction-display"
import { ThinkingDisplay } from "./thinking-display"
import { SimpleMarkdownRenderer } from "../ui/markdown/simple-markdown-renderer"
import type { ChatRef } from "./chat-ref.types"
import { remarkCardLinks } from "./remark-card-links"
import { remarkMentionChips } from "./remark-mention-chips"
import { BlockCard, type BlockCardProps } from "./entity-cards/block-card"
import { ChatContextChipStrip } from "./chat-context-picker"
import type { MessageSegment, MessageContent, ChatMessageEnhancedProps } from "./types"

/** Inline `@marker:id` mention token in the message body (sibling of the
 *  `[card://]` grammar) — used to filter out items rendered inline from the
 *  chip strip below. MUST mirror the left-boundary `(^|\s)` of `MENTION_REGEX`
 *  in `remark-mention-chips.ts`: without it this regex is WIDER than the plugin
 *  (e.g. it matches `x@device:1` mid-word, which the plugin skips), so a context
 *  item would be stripped from the chip strip yet never rendered inline — lost
 *  from display entirely. The id is capture group 2 (group 1 is the boundary).
 *  Marker lowercase; id is the mention-token charset. */
const MENTION_MARKER_REGEX = /(^|[^\w@])@[a-z]+:([A-Za-z0-9_.+/=-]*[A-Za-z0-9_+/=])/g

/**
 * Same regex shape as `remarkCardLinks` — kept in lockstep so the
 * pre-scan and the remark plugin see the SAME set of markers. If the
 * grammar widens (today: snake_case OR kebab-case; closer `]` OR `)`),
 * both files must update.
 */
const CARD_MARKER_REGEX = /\[card:\/\/([a-zA-Z0-9_-]+):([a-zA-Z0-9_-]+)[\])]/g

/** Timestamp label: today's messages show time only ("2:47 PM"),
 *  older messages prepend a locale-formatted date ("05/05/2026 2:47 PM"
 *  in en-US, "05.05.2026 14:47" in european locales). */
function formatMessageTimestamp(timestamp: Date): string {
  const time = formatTime(timestamp)
  return isToday(timestamp) ? time : `${formatDate(timestamp)} ${time}`
}

function normalizeContent(content: MessageContent): MessageSegment[] {
  if (typeof content === 'string') {
    return content ? [{ type: 'text', text: content }] : []
  }
  return content
}

const ChatMessageEnhanced = forwardRef<HTMLDivElement, ChatMessageEnhancedProps>(
  ({ className, role, content, name, avatar, isTyping = false, timestamp, showAvatar = true, assistantType, approvalVariant, authorType: authorTypeProp, assistantIcon, chatRefs, contextItems, resolveContextIcon, renderContextItem, renderMention, renderEntityCard, NavLinkAnchor, ...props }, ref) => {
    const isUser = role === 'user'
    const isError = role === 'error'
    const authorType = authorTypeProp ?? (isUser ? 'user' : assistantType === 'mingo' ? 'mingo' : 'fae')

    // Inline-card rendering uses a HOST-PROVIDED `renderEntityCard` function
    // (v6.1 §B.2.7 — DRY duplications #2). The OSS-lib stays data-agnostic:
    // it doesn't know about entity types, slash commands, or app routing.
    // The host (multi-platform-hub) returns whatever JSX it wants for each
    // resolved ChatRef — typically a hover-card pill that composes the
    // canonical entity card from the host's design system.
    //
    // The remark plugin runs whenever the assistant emits a `[card://]`
    // marker (chatRefs present OR not), so we always strip raw markers
    // from rendered text (Logic MED-4). When the host's `renderEntityCard`
    // is unset OR returns null, the override falls back to the ref's
    // title — or, if even the ref is unknown, the bare cardId. Never
    // renders the literal `[card://...]` URL.
    const hasMarkerSupport = !!chatRefs || !!renderEntityCard

    const segments = useMemo(() => normalizeContent(content), [content])

    // Inline `@marker:id` mentions: the composer commits these tokens when the
    // user picks context via the `@`-flow, and the ASSISTANT routinely echoes
    // the same `@device:machineId` token back in its reply. The lib detects the
    // token and delegates rendering to the host's `renderMention` (mirror of
    // `renderEntityCard`): the host returns a SELF-FETCHING chip per entity
    // type. Enabled whenever the host opts in by supplying `renderMention`.
    const hasMentionSupport = !!renderMention

    // Ids that appear as `@marker:id` in the body → rendered inline, so they are
    // excluded from the chip strip below (no duplicate inline + strip).
    const inlineMentionIds = useMemo(() => {
      const ids = new Set<string>()
      if (!hasMentionSupport) return ids
      for (const seg of segments) {
        if (seg.type !== 'text' || !seg.text || !seg.text.includes('@')) continue
        for (const mm of seg.text.matchAll(MENTION_MARKER_REGEX)) ids.add(mm[2])
      }
      return ids
    }, [hasMentionSupport, segments])

    // Chip strip = only context NOT already shown inline (e.g. `+`-added items).
    const stripContextItems = useMemo(
      () =>
        inlineMentionIds.size > 0 && contextItems
          ? contextItems.filter((it) => !inlineMentionIds.has(it.id))
          : contextItems,
      [contextItems, inlineMentionIds],
    )

    // Markdown plugins per message: card markers (assistant) + mention tokens
    // (user). Each is gated independently so neither fires without its data.
    const cardRemarkPlugins = useMemo(
      () => [
        ...(hasMarkerSupport ? [remarkCardLinks] : []),
        ...(hasMentionSupport ? [remarkMentionChips] : []),
      ],
      [hasMarkerSupport, hasMentionSupport],
    )

    // Cross-render cache of rendered inline-card nodes, keyed by `type:id`.
    // A fetch-mode card lives inside the assistant message, which re-renders on
    // every stream chunk (and the whole list re-renders when a new message
    // arrives). `renderEntityCard` produces a FRESH element each time, so React
    // re-mounts the card — closing any open menu/popover and re-triggering its
    // fetch. Caching the produced node by key and returning the SAME element
    // reference lets React bail out of re-rendering that subtree, so the card
    // (and its open menu) survives across chunks. Invalidated per key when the
    // backing ref or the render fn identity changes.
    const renderedCardNodeCache = useRef(
      new Map<string, { refMatch: ChatRef | undefined; render: ((ref: ChatRef) => React.ReactNode) | undefined; node: React.ReactNode }>(),
    )

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
      if (!hasMarkerSupport) return null
      const refs = chatRefs ?? {}
      const render = renderEntityCard
      const inlineByKey = new Map<string, React.ReactNode>()
      type SegmentPart =
        | { kind: 'text'; text: string }
        | { kind: 'block'; key: string; node: React.ReactNode }
      const partsBySegment = new Map<number, SegmentPart[]>()
      const usedKeys = new Set<string>()
      if (!render) return { inlineByKey, partsBySegment, usedKeys }
      const cache = renderedCardNodeCache.current
      // Card keys already emitted as a hoisted block (`b-<key>`). The same
      // marker can legitimately appear twice in one message (LLM references
      // the same entity twice); we hoist the FIRST occurrence and skip the
      // duplicates so two siblings never collide on the same React key.
      const emittedBlockKeys = new Set<string>()
      segments.forEach((segment, segIdx) => {
        if (segment.type !== 'text') return
        const text = segment.text
        const parts: SegmentPart[] = []
        let cursor = 0
        CARD_MARKER_REGEX.lastIndex = 0
        let match: RegExpExecArray | null
        while ((match = CARD_MARKER_REGEX.exec(text)) !== null) {
          const cardType = match[1]
          const cardId = match[2]
          const key = `${cardType}:${cardId}`
          usedKeys.add(key)
          // Reuse the cached node when neither the backing ref nor the render
          // fn changed — returning the SAME element reference across renders is
          // what stops React from re-mounting the card (and closing its open
          // menu / re-fetching) on every stream chunk. Also dedups the same key
          // emitted twice within one message.
          const refMatch = refs[key]
          let entry = cache.get(key)
          if (!entry || entry.refMatch !== refMatch || entry.render !== render) {
            // Always invoke render() — even when the metadata map has
            // no entry for this marker. Fetch-mode card types
            // (delivery_item, roadmap_item, internal_task, etc.) don't
            // ship metadata in the SSE frame; they self-fetch by `id`
            // via the host's list-API hook, so a minimal {type,id}
            // ChatRef is all the renderer needs to mount the loader.
            // For no-fetch types (hubspot_ticket_self, slack_message,
            // …) without a refMatch the host's render() returns null
            // and we fall through to the bare-cardId fallback in the
            // `<a card://…>` override below.
            //
            // SYNTHETIC REF DEFAULTS: `ChatRef.title` and `ChatRef.url`
            // are non-optional in the type; a bare `{type, id}` cast
            // would lie to consumers that read those fields. Default
            // `title` to the cardId (so any host renderer that prints
            // `ref.title` shows the id rather than `undefined`) and
            // `url` to null (matches the no-link semantics fetch-mode
            // cards rely on — they resolve their own URL after fetch).
            const refForRender: ChatRef = refMatch ?? {
              type: cardType,
              id: cardId,
              title: cardId,
              url: null,
            }
            entry = { refMatch, render, node: render(refForRender) }
            cache.set(key, entry)
          }
          const rendered = entry.node
          if (React.isValidElement(rendered) && rendered.type === BlockCard) {
            const props = rendered.props as BlockCardProps
            const markerEnd = match.index + match[0].length
            // Text chunk INCLUDING the marker — the inline pill renders
            // at the marker position via the `<a>` override.
            parts.push({ kind: 'text', text: text.slice(cursor, markerEnd) })
            // Hoist the block payload only on the FIRST occurrence of this key
            // — a repeated marker still gets its inline pill (text + override
            // above) but must not push a second `b-<key>` sibling.
            if (!emittedBlockKeys.has(key)) {
              emittedBlockKeys.add(key)
              parts.push({ kind: 'block', key, node: props.children })
            }
            cursor = markerEnd
            inlineByKey.set(
              key,
              props.inline != null
                ? props.inline
                : <span className="text-ods-text-primary font-medium">{refMatch?.title ?? cardId}</span>,
            )
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
            parts.push({ kind: 'text', text: text.slice(cursor, match.index) })
            if (!emittedBlockKeys.has(key)) {
              emittedBlockKeys.add(key)
              parts.push({ kind: 'block', key, node: rendered })
            }
            cursor = match.index + match[0].length
          }
        }
        // Trailing text after the last block marker (or the entire
        // segment when no block markers fired).
        if (cursor < text.length) {
          parts.push({ kind: 'text', text: text.slice(cursor) })
        }
        // Only register the split plan when at least one block marker
        // fired — otherwise the segment renders as one SimpleMarkdown-
        // Renderer call (existing behaviour preserved for the
        // overwhelming majority of segments that have no block cards).
        if (parts.some((p) => p.kind === 'block')) {
          partsBySegment.set(segIdx, parts)
        }
      })
      return { inlineByKey, partsBySegment, usedKeys }
    }, [hasMarkerSupport, chatRefs, renderEntityCard, segments])

    // Drop cached nodes for markers no longer present so the cache can't grow
    // unbounded as a long message's markers change. Deliberately an EFFECT,
    // not part of the memo above: pruning is a mutation, and doing it in the
    // render phase is non-idempotent (StrictMode's double-invoke, or a render
    // React throws away, would evict nodes the committed tree still uses and
    // remount the cards it was built to preserve).
    useEffect(() => {
      const cache = renderedCardNodeCache.current
      const usedKeys = renderingPlan?.usedKeys
      if (!usedKeys) return
      if (cache.size <= usedKeys.size) return
      for (const k of [...cache.keys()]) {
        if (!usedKeys.has(k)) cache.delete(k)
      }
    }, [renderingPlan])

    // The plan is read through a REF inside the `<a>` override, not captured
    // in the override's closure. `renderingPlan` is rebuilt on every text
    // delta (its `segments` dep is a fresh array per delta), so depending on
    // it here would give `cardComponentOverrides` a new identity every token
    // — which re-creates the markdown engine's `components` memo and defeats
    // its per-block `StreamingBlockRenderer` memoization for the WHOLE
    // message, on every token. The ref keeps the override identity stable
    // while still reading the current plan at call time.
    const renderingPlanRef = useRef(renderingPlan)
    renderingPlanRef.current = renderingPlan
    const chatRefsRef = useRef(chatRefs)
    chatRefsRef.current = chatRefs

    // Ref-SET token. The override reads `chatRefsRef` at CALL time, but the
    // markdown engine memoizes completed blocks on the override map's
    // identity — so on a COMPLETED (no longer streaming) message, a ref that
    // resolves late would never be re-read: nothing else about the renderer's
    // props changes, the engine's memo bails, and the pill stays stuck on its
    // fallback (`refMatch.title`, or the raw cardId) forever. Streaming is
    // covered because `card://` blocks are excluded from the block cache; the
    // completed path has no other escape.
    //
    // The token fingerprints VALUES, not just the key set: a later refs frame
    // REPLACES the whole map for a send index, and the enrichment case that
    // matters most — a `title` going from the raw cardId to the resolved
    // document title — keeps the key set IDENTICAL. A key-only token would be
    // unchanged, the override map would keep its identity, the engine's
    // completed-block memo would bail, and the pill would stay on its fallback
    // forever. Every `ChatRef` field is included because the host's
    // `renderEntityCard` receives the whole ref and may render any of them.
    //
    // Still STABLE per text delta (the refs map doesn't change while tokens
    // stream), and the cost is one pass over a handful of refs per CHANGED
    // `chatRefs` identity — the dep list is unchanged.
    //
    // Fields are joined by `JSON.stringify`, NOT by a separator character.
    // `title`, `preview` and `url` are free-form HOST strings, so any
    // delimiter we pick is one the data may also contain: joined with a plain
    // space, `title: 'a b'` + empty `url` fingerprints identically to
    // `title: 'a'` + `url: 'b'`, silently reintroducing the stale-pill memo
    // bail this token exists to fix. (An earlier revision used a literal NUL
    // byte as the separator: collision-free in practice, but it made the
    // source file itself binary to grep and diff tooling.) `JSON.stringify`
    // escapes every field, so no value can forge a boundary.
    //
    // Caveat worth stating: `JSON.stringify` on `metadata` is key-ORDER
    // dependent: two structurally equal objects built in different insertion
    // orders fingerprint differently. Acceptable here because every refs map
    // arrives from ONE decoder with a fixed field order, and the failure mode
    // is a redundant re-render, never a stale pill.
    const refsKey = useMemo(
      () =>
        Object.entries(chatRefs ?? {})
          .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
          .map(([k, v]) =>
            JSON.stringify([
              k,
              v.type,
              v.sourceRepo ?? null,
              v.id,
              v.title,
              v.url ?? null,
              v.targetPlatform ?? null,
              v.date ?? null,
              v.preview ?? null,
              v.metadata ?? null,
            ]),
          )
          .join('|'),
      [chatRefs],
    )

    const cardComponentOverrides = useMemo(() => {
      if (!hasMarkerSupport && !hasMentionSupport) return undefined
      return {
        // Override `<a>` to detect `card://` URLs emitted by `remarkCardLinks`.
        // The render result was pre-computed in `renderingPlan` so block-level
        // payloads (e.g. video player cards) can be hoisted out of the
        // paragraph as siblings — the inline pill stays at the marker
        // position. Other href schemes pass through unchanged.
        a: ({ href, children, className: linkClassName, ...rest }: any) => {
          // Inline entity mention `@marker:id`, emitted as a `mention://marker:id`
          // link by `remarkMentionChips`. Delegate to the host's `renderMention`
          // (mirror of the `card://` → `renderEntityCard` path): the host returns
          // a self-fetching chip for that entity type. Null/unknown → raw token.
          if (typeof href === 'string' && href.startsWith('mention://')) {
            const stripped = href.slice('mention://'.length)
            const sepIdx = stripped.indexOf(':')
            const marker = sepIdx === -1 ? stripped : stripped.slice(0, sepIdx)
            const id = sepIdx === -1 ? '' : stripped.slice(sepIdx + 1)
            const node = renderMention?.({ marker, id })
            if (node != null) return <>{node}</>
            return <span className="text-ods-text-secondary opacity-60">{children}</span>
          }
          if (typeof href === 'string' && href.startsWith('card://')) {
            const stripped = href.slice('card://'.length)
            const sepIdx = stripped.lastIndexOf(':')
            if (sepIdx !== -1) {
              const cardType = stripped.slice(0, sepIdx)
              const cardId = stripped.slice(sepIdx + 1)
              const key = `${cardType}:${cardId}`
              const inline = renderingPlanRef.current?.inlineByKey.get(key)
              if (inline != null) return inline
              // Three fallback cases — keep them DISTINCT, never blur them
              // together. Mixing them up (which the old code did by reaching
              // for "any same-type ref's title") makes LLM hallucinations
              // LOOK like real cards, which the user can't tell apart from
              // genuine references.
              //
              //   (1) Exact ref present, renderer returned null:
              //       The marker is legit (server confirmed the row exists)
              //       but no compact-card type is registered for `cardType`.
              //       Render the ref's REAL title as plain text — accurate,
              //       just no rich UI.
              //
              //   (2) Exact ref absent (refs map has no `${cardType}:${cardId}`):
              //       The LLM emitted a marker for an ID the server did NOT
              //       surface. Either the LLM hallucinated the id, or the
              //       refs map and the snapshot drifted (server-side bug
              //       worth fixing — see `MAX_ROWS_PER_ENTITY_GROUP` in
              //       `doc-chat-utils.ts:buildSourcesMeta`). Render the raw
              //       `cardId` so the breakage is VISIBLE; never borrow a
              //       title from an unrelated ref — that hides the bug and
              //       deceives the reader into thinking they're looking at
              //       a real card.
              const refMatch: ChatRef | undefined = chatRefsRef.current?.[key]
              if (refMatch) {
                return <span className="text-ods-text-primary">{refMatch.title}</span>
              }
              return <span className="text-ods-text-secondary opacity-60">{cardId}</span>
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
          if (
            typeof href === 'string' &&
            NavLinkAnchor &&
            !href.startsWith('#')
          ) {
            return (
              <NavLinkAnchor href={href} className={linkClassName} {...rest}>
                {children}
              </NavLinkAnchor>
            )
          }
          return (
            <a href={href} className={linkClassName} {...rest}>
              {children}
            </a>
          )
        },
      }
      // DEPS ARE DELIBERATELY MINIMAL — every one of them is stable across a
      // streaming turn (booleans + host-stable fn/component identities, both
      // enforced by this file's `memo` comparator). The rendering plan and the
      // refs MAP are read through refs above precisely so they do NOT appear
      // here; `refsKey` is the one ref-derived dep, and it only moves when the
      // ref set OR any ref VALUE does (see its definition).
    }, [hasMarkerSupport, hasMentionSupport, renderMention, NavLinkAnchor, refsKey])

    const getAvatarProps = () => {
      const displayName = name || (isUser ? "User" : assistantType === 'mingo' ? "Mingo" : "Fae")
      const isMingo = assistantType === 'mingo'

      return {
        src: avatar || undefined,
        alt: `${displayName} avatar`,
        // Pass the FULL name — SquareAvatar derives first+last initials itself
        // (passing pre-joined initials like "PS" would collapse to one letter,
        // since getFirstLastInitials treats it as a single word).
        fallback: displayName,
        size: "sm" as const,
        variant: "round" as const,
        // User avatar: compact 20×20 with 2px padding and a subtle gray fill
        // (`bg-ods-card`) so the `border-ods-border` ring stays visible — the
        // brand fill reads poorly for a user. Assistant/Fae keep their brand
        // fill. Initials are smaller + muted gray for the user placeholder.
        ...(isUser ? { initialsClassName: "text-[9px] text-ods-text-secondary" } : {}),
        className: cn(
          "flex-shrink-0",
          isUser
            ? "h-5 w-5 p-0.5 bg-ods-card"
            : isMingo
              ? "bg-ods-flamingo-cyan"
              : "bg-ods-flamingo-pink"
        )
      }
    }
    
    const avatarProps = getAvatarProps()

    const isSystem = authorType === 'system'

    return (
      <div
        ref={ref}
        className={cn(
          "relative py-[var(--spacing-system-s)]",
          className
        )}
        {...props}
      >
        {/* Message Content — full panel width.
            Avatar is INLINE in the name row below (2025-2026 chat
            pattern — Claude.ai, ChatGPT, Gemini, Perplexity).
            Legacy hanging-avatar layout (`absolute -left-16`) wasted
            64px of gutter and clipped in narrow panels. */}
        <div className="flex flex-col gap-[var(--spacing-system-xxs)] min-w-0">
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
            {showAvatar && !isSystem && !(isUser && !avatar) && (
              !isUser && assistantIcon && !avatar ? (
                // Host-supplied brand icon (e.g. Mingo): render it directly,
                // no filled pill — the icon carries its own brand accent.
                <div className="flex items-center justify-center flex-shrink-0">
                  {assistantIcon}
                </div>
              ) : (
                <SquareAvatar {...avatarProps} />
              )
            )}
            <span className={cn(
              "text-h3 !font-mono !font-medium flex-1",
              authorType === 'system' ? "text-ods-open-yellow" :
              authorType === 'admin' ? "text-ods-open-yellow" :
              authorType === 'mingo' ? "text-ods-flamingo-cyan" :
              authorType === 'fae' ? "text-ods-flamingo-pink" :
              "text-ods-text-secondary"
            )}>
              {name || (isUser ? "User" : assistantType === 'mingo' ? "Mingo" : "Fae")}{!isSystem && ':'}
            </span>
            {timestamp && (
              <span className="text-h6 text-ods-text-secondary shrink-0 whitespace-nowrap">
                {formatMessageTimestamp(timestamp)}
              </span>
            )}
          </div>
          
          {/* Message segments — hidden for system messages without content */}
          {(!isSystem || segments.length > 0) && <div className="flex flex-col gap-2">
            {segments.map((segment, index) => {
                if (segment.type === 'text') {
                  const parts = renderingPlan?.partsBySegment.get(index)
                  const wrapperClass = cn(
                    "min-w-0 w-full break-words text-h4",
                    isError ? "text-ods-error" : "text-ods-text-primary",
                  )
                  // The engine's streaming path (atomic-block memoization +
                  // fence tail-completion + aria-live) applies ONLY to the
                  // actively streaming segment: last segment of a message
                  // that is still typing. On completion `isTyping` flips
                  // false and the engine does one authoritative
                  // whole-document parse.
                  const segmentIsStreaming = index === segments.length - 1 && !!isTyping
                  // No block markers in this segment → single
                  // SimpleMarkdownRenderer call (existing behaviour
                  // preserved for the vast majority of messages).
                  if (!parts || parts.length === 0) {
                    return (
                      <div key={index} className={wrapperClass}>
                        <SimpleMarkdownRenderer
                          content={segment.text}
                          textSize="compact"
                          additionalRemarkPlugins={cardRemarkPlugins}
                          componentOverrides={cardComponentOverrides}
                          streaming={segmentIsStreaming}
                        />
                      </div>
                    )
                  }
                  // Block markers present → split text at each marker
                  // and interleave block payloads. Each text chunk
                  // includes its trailing marker so the inline pill
                  // renders at the right position via the `<a>`
                  // override. Block payloads land AS SIBLINGS between
                  // text chunks — HTML-valid (block DOM never nests
                  // inside `<p>`) AND positionally correct (block
                  // appears where the marker is in the flow, not at
                  // the segment's end). Stable React keys come from
                  // the card key (block) and chunk position (text);
                  // streaming token-by-token reuses the same React
                  // instances so `<Video>` doesn't remount mid-play.
                  return (
                    <div key={index} className={wrapperClass}>
                      {parts.map((part, pIdx) => {
                        if (part.kind === 'text') {
                          return (
                            <SimpleMarkdownRenderer
                              key={`t-${pIdx}`}
                              content={part.text}
                              textSize="compact"
                              additionalRemarkPlugins={cardRemarkPlugins}
                              componentOverrides={cardComponentOverrides}
                              streaming={segmentIsStreaming && pIdx === parts.length - 1}
                            />
                          )
                        }
                        return (
                          <div key={`b-${part.key}`} className="my-3">
                            {part.node}
                          </div>
                        )
                      })}
                    </div>
                  )
                } else if (segment.type === 'tool_execution') {
                  return (
                    <ToolExecutionDisplay
                      key={index}
                      message={segment.data}
                      assistantType={assistantType}
                    />
                  )
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
                  )
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
                  )
                } else if (segment.type === 'error') {
                  return (
                    <ErrorMessageDisplay
                      key={index}
                      title={segment.title}
                      details={segment.details}
                    />
                  )
                } else if (segment.type === 'context_compaction') {
                  return (
                    <ContextCompactionDisplay
                      key={index}
                      status={segment.status}
                    />
                  )
                } else if (segment.type === 'thinking') {
                  const isStreaming = index === segments.length - 1 && isTyping
                  return (
                    <ThinkingDisplay
                      key={index}
                      text={segment.text}
                      isStreaming={isStreaming}
                    />
                  )
                }
                return null
              })}
          </div>}

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
    )
  }
)

ChatMessageEnhanced.displayName = "ChatMessageEnhanced"

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
    // Reference equality on chatRefs is sufficient — the host's hooks should
    // re-use the same Record instance per turn; mutations create a new map.
    // Without this check, a parent re-render with a new (but equivalent)
    // refs object would force a full markdown re-render every keystroke.
    prevProps.chatRefs === nextProps.chatRefs &&
    // Reference equality — the host re-uses the same array instance per
    // message (it's set once on the optimistic send and never mutated).
    prevProps.contextItems === nextProps.contextItems &&
    prevProps.resolveContextIcon === nextProps.resolveContextIcon &&
    prevProps.renderContextItem === nextProps.renderContextItem &&
    // Host keeps this stable (module const / useCallback), so reference
    // equality holds across streaming chunks.
    prevProps.renderMention === nextProps.renderMention &&
    prevProps.renderEntityCard === nextProps.renderEntityCard &&
    prevProps.NavLinkAnchor === nextProps.NavLinkAnchor
  )
})

MemoizedChatMessageEnhanced.displayName = "MemoizedChatMessageEnhanced"

export { MemoizedChatMessageEnhanced as ChatMessageEnhanced }