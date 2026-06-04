"use client"

import { useRef, useEffect, useLayoutEffect, useImperativeHandle, forwardRef } from "react"
import { useStickToBottom } from "use-stick-to-bottom"
import { cn } from "../../utils/cn"
import { ChatMessageEnhanced } from "./chat-message-enhanced"
import { ChatMessageListSkeleton } from "./chat-message-skeleton"
import { DotsLoaderIcon } from "../icons-v2-generated"
import { CyclingPhrase } from "./cycling-phrase"
import type { ChatMessageListProps } from "./types"
import { SCROLL_ANCHOR } from "./types/message.types"
import type { MessageContent } from "./types/message.types"

// Flamingo-themed cycling words shown next to the streaming indicator
// (Claude-Code-style activity hint). Mix of classic AI verbs, flamingo
// behaviours (strut/wade/preen/flock), and one Mingo neologism.
const STREAMING_WORDS = [
  'Thinking',
  'Vibing',
  'Mingoing',
  'Strutting',
  'Pondering',
  'Wading',
  'Hatching',
  'Preening',
  'Conjuring',
  'Riffing',
] as const

/*
 * Stick-to-bottom: `use-stick-to-bottom` (stackblitz-labs)
 *
 * The 2026 production-grade stick-to-bottom mechanism — same library
 * Vercel AI SDK Elements ships in `<Conversation>` and that powers
 * bolt.new's streaming chat. ResizeObserver on the content + spring-
 * physics scroll + correct user-escape detection (wheel / touch /
 * scrollTop-snapshot) + at-bottom geometry tracking. We removed the
 * hand-rolled v1 mechanism (per-render `lastMessage` useEffect + 1.5s
 * RO anchor + 4 racing scrollTop sites + wheel/touch handlers) which
 * had real-world failure modes around post-commit layout shifts.
 *
 * What we KEEP from v1 (the library doesn't cover these):
 *  - **Prepend anchoring** (load-older). When older messages prepend,
 *    we add `newScrollHeight - prevScrollHeight` to `scrollTop` so the
 *    user stays on the message they were reading. The library's
 *    contract is "follow the bottom"; preserving viewport position
 *    when content grows ABOVE is a separate concern owned by this
 *    component.
 *  - **Dialog-change + first-load + user-message → force-scroll**.
 *    We call `scrollToBottom({ animation: 'instant' })` explicitly
 *    for these transitions so the library skips its spring animation
 *    (an instant snap matches user expectation: "I just opened a new
 *    chat / sent a message; show me the bottom immediately").
 *  - **Load-more sentinel** (top-of-list IntersectionObserver) for
 *    infinite-scroll-UP. Distinct concern from stick-to-bottom.
 *
 * `useStickToBottom`'s returned refs are MUTABLE refs + ref callbacks
 * — pass them directly as `ref={scrollRef}` / `ref={contentRef}`.
 */

/** Whether a `Message.content` (string OR `MessageSegment[]`) carries
 *  visible text. The top-anchor effect uses this to skip the metadata-
 *  only commit (empty assistant bubble) and wait until the body chunk
 *  has landed in the DOM. */
function hasNonEmptyContent(content: MessageContent): boolean {
  if (typeof content === 'string') return content.length > 0
  if (!Array.isArray(content)) return false
  return content.some((s) => s.type === 'text' && s.text.length > 0)
}

/** Async-growth watcher installed by the top-anchor effect for the 2s
 *  settle window. Single owner is `anchorWatcherRef`; the helper below
 *  is the only place that knows how to tear one down. */
interface AnchorWatcher {
  id: string
  ro: ResizeObserver
  timer: ReturnType<typeof setTimeout>
}

/** Idempotent tear-down for an `AnchorWatcher`. Used by both the
 *  inline supersede path (new top-anchor turn arrives mid-window) and
 *  the component-unmount cleanup. Caller owns the surrounding ref
 *  null-out — the helper itself doesn't touch the ref. */
function disposeAnchorWatcher(w: AnchorWatcher | null): void {
  if (!w) return
  w.ro.disconnect()
  clearTimeout(w.timer)
}

const ChatMessageList = forwardRef<HTMLDivElement, ChatMessageListProps>(
  (
    {
      className,
      messages,
      dialogId,
      isLoading = false,
      isTyping = false,
      autoScroll = true,
      showAvatars = true,
      fullWidth = false,
      contentClassName,
      assistantType,
      assistantIcon,
      pendingApprovals,
      hasNextPage,
      isFetchingNextPage,
      onLoadMore,
      renderEntityCard,
      NavLinkAnchor,
      ...props
    },
    ref,
  ) => {
    // ---- Library: useStickToBottom -----------------------------------
    // `resize: 'smooth'` — during streaming, content grows token-by-
    // token; library uses spring physics to follow the bottom for a
    // ChatGPT/Claude.ai-like feel (vs jarring instant snaps).
    // `initial: false` — DON'T auto-scroll on mount; our dialog-change
    // effect below owns first-paint positioning so re-opening a chat
    // with prior history lands at the bottom without a smooth-scroll
    // animation playing over the cold-paint.
    const { scrollRef, contentRef, scrollToBottom, stopScroll } = useStickToBottom({
      resize: 'smooth',
      initial: false,
    })

    // ---- Prepend / load-more state (NOT owned by the library) --------
    const sentinelRef = useRef<HTMLDivElement>(null)
    const onLoadMoreRef = useRef(onLoadMore)
    onLoadMoreRef.current = onLoadMore
    const isFetchingRef = useRef(isFetchingNextPage)
    isFetchingRef.current = isFetchingNextPage

    // Tracks previous render state for explicit "force-stick" decisions
    // (dialog change, first message, new user message). The library
    // covers ongoing streaming; these are about INTENT transitions.
    const prevRenderRef = useRef<{
      dialogId: string | undefined
      messageCount: number
      lastMessageId: string | undefined
    }>({ dialogId: undefined, messageCount: 0, lastMessageId: undefined })

    // Snapshot of the first message id + scrollHeight observed BEFORE
    // a load-older prepend, so we can preserve the user's viewport
    // position when older messages stream in above their current
    // reading position.
    const prependRef = useRef<{
      firstMessageId: string | undefined
      firstMessageContent: unknown
      scrollHeight: number
    }>({ firstMessageId: undefined, firstMessageContent: undefined, scrollHeight: 0 })

    // ---- Force-stick: dialog change / first-load / new user message --
    useEffect(() => {
      if (!autoScroll) return

      const dialogChanged = dialogId !== prevRenderRef.current.dialogId
      const prevCount = prevRenderRef.current.messageCount
      const newCount = messages.length
      const currentLastId = messages[messages.length - 1]?.id
      prevRenderRef.current = { dialogId, messageCount: newCount, lastMessageId: currentLastId }

      if (dialogChanged) {
        // Opening a different chat — instant snap to bottom.
        void scrollToBottom({ animation: 'instant', ignoreEscapes: true })
        return
      }
      if (newCount > 0 && prevCount === 0) {
        // First message arrived in an empty chat — instant snap.
        void scrollToBottom({ animation: 'instant', ignoreEscapes: true })
        return
      }
      if (newCount > prevCount) {
        // Scan the new tail for any user-role message. Handles the
        // coalesced-render case where optimistic-user + server-
        // assistant land in the same diff (last is assistant, but a
        // user message DID arrive). When the user just sent a
        // message, they expect their bubble pinned to the bottom,
        // regardless of where they were scrolled.
        const newSlice = messages.slice(prevCount)
        const hasNewUser = newSlice.some((m) => m.role === 'user')
        if (hasNewUser) {
          void scrollToBottom({ animation: 'instant', ignoreEscapes: true })

          // Image-attachment growth follow-up: if the new user message
          // carries inline `<img>` elements (chat-attachment markdown
          // emits `![alt](/api/storage/view/...)` which the markdown
          // renderer turns into `<img>` / Next.js `<Image>`), those
          // images load AFTER the initial paint. Each image-load grows
          // the bubble height, but `useStickToBottom`'s `resize:
          // 'smooth'` spring sometimes loses anchor under rapid
          // resize events from Next.js Image's progressive
          // dimensioning (observed: scroll lands 50-100px short of
          // bottom — exactly one image-load short).
          //
          // Fix: after the initial scrollToBottom snaps, scan the
          // content area for `<img>` elements that haven't loaded
          // yet, and attach one-time `load` handlers that re-trigger
          // `scrollToBottom`. Idempotent — runs for any image,
          // affects only the new-user-message diff (effect dep is
          // `messages`).
          //
          // `requestAnimationFrame` so the DOM has the new bubble
          // before we query. Without rAF the new-message `<img>`s
          // haven't been committed yet — querySelectorAll returns
          // an empty set.
          requestAnimationFrame(() => {
            const el = contentRef.current
            if (!el) return
            const imgs = el.querySelectorAll('img')
            imgs.forEach((img) => {
              if (img.complete) return
              const onLoad = () => {
                img.removeEventListener('load', onLoad)
                img.removeEventListener('error', onLoad)
                // `ignoreEscapes: true` because the user may have
                // accidentally moved scroll during the image-load
                // window; we want their fresh send to be visible.
                void scrollToBottom({ animation: 'instant', ignoreEscapes: true })
              }
              img.addEventListener('load', onLoad, { once: true })
              img.addEventListener('error', onLoad, { once: true })
            })
          })
        }
        // Assistant-only new messages → the library's resize-watch
        // already keeps the bottom locked when the user hasn't
        // escaped. No explicit call needed; spring animation runs.
      }
    }, [autoScroll, messages, dialogId, scrollToBottom, contentRef])

    // ---- Prepend anchoring (load-older) ------------------------------
    // The library doesn't preserve user position when content prepends
    // ABOVE the viewport. We do it ourselves: snapshot scrollHeight
    // BEFORE the new render, then add the delta after to keep the
    // user on the same message they were reading. `useLayoutEffect`
    // so the scrollTop write lands before paint (no visible jump).
    useLayoutEffect(() => {
      const el = scrollRef.current
      if (!el) {
        prependRef.current = { firstMessageId: undefined, firstMessageContent: undefined, scrollHeight: 0 }
        return
      }

      const currentFirstId = messages[0]?.id
      const currentFirstContent = messages[0]?.content
      const prevFirstId = prependRef.current.firstMessageId
      const prevHeight = prependRef.current.scrollHeight

      if (currentFirstId !== prevFirstId) {
        // First-id changed → older messages prepended (verified by
        // confirming the previous-first is still in the array at
        // idx > 0; otherwise this is some other mutation).
        if (prevFirstId && prevHeight > 0) {
          const prevIdx = messages.findIndex((m) => m.id === prevFirstId)
          if (prevIdx > 0) {
            const addedHeight = el.scrollHeight - prevHeight
            if (addedHeight > 0) el.scrollTop += addedHeight
          }
        }
        prependRef.current = {
          firstMessageId: currentFirstId,
          firstMessageContent: currentFirstContent,
          scrollHeight: el.scrollHeight,
        }
        return
      }
      // Always keep `scrollHeight` snapshot fresh so the next prepend
      // computes the right delta. The id/content updates only when
      // those actually change to avoid churn.
      prependRef.current.scrollHeight = el.scrollHeight
      if (currentFirstContent !== prependRef.current.firstMessageContent) {
        prependRef.current.firstMessageContent = currentFirstContent
      }
    }, [messages, scrollRef])

    // ---- Per-message scrollAnchor (server-driven) --------------------
    // Server emits `scrollAnchor: 'top'` on the metadata leading frame
    // for display-action answers; default tail behaviour is preserved
    // for every other path that omits the field.
    //
    // Per-id memoized ref callbacks preserve callback identity across
    // the token-streaming re-renders that React.memo lets through —
    // a fresh closure each render would detach/reattach the ref on
    // every commit and could race the useLayoutEffect's element lookup.
    const messageElsRef = useRef<Map<string, HTMLElement>>(new Map())
    const refCallbacksRef = useRef<Map<string, (el: HTMLElement | null) => void>>(new Map())

    const getRegisterMessageEl = (id: string): (el: HTMLElement | null) => void => {
      let cb = refCallbacksRef.current.get(id)
      if (cb) return cb
      cb = (el) => {
        if (el) {
          messageElsRef.current.set(id, el)
        } else {
          messageElsRef.current.delete(id)
          refCallbacksRef.current.delete(id)
        }
      }
      refCallbacksRef.current.set(id, cb)
      return cb
    }

    // Lazy-init: seed ONLY messages whose content is populated. Persisted
    // reload has full bodies → all ids seeded → no scroll-replay on cold
    // paint. A fresh turn's empty assistant placeholder (appended by
    // useChat before streaming) is intentionally excluded so the top-
    // anchor effect can fire when its body lands.
    const scrolledIdsRef = useRef<Set<string> | null>(null)
    if (scrolledIdsRef.current === null) {
      scrolledIdsRef.current = new Set(
        messages.filter((m) => hasNonEmptyContent(m.content)).map((m) => m.id),
      )
    }

    // Active async-growth watcher. Stored in a ref (NOT in the effect's
    // cleanup) so subsequent `messages` mutations during the 2s settle
    // window don't tear it down. Cleared only when a new top-anchor turn
    // supersedes it, or on component unmount.
    const anchorWatcherRef = useRef<AnchorWatcher | null>(null)

    useLayoutEffect(() => {
      if (!autoScroll) return
      const last = messages[messages.length - 1]
      if (!last || last.role !== 'assistant' || last.scrollAnchor !== SCROLL_ANCHOR.TOP) return
      // Metadata frame arrives BEFORE body. Wait for content so we don't
      // snap an empty bubble and burn the one-shot.
      if (!hasNonEmptyContent(last.content)) return
      const seen = scrolledIdsRef.current!
      if (seen.has(last.id)) return
      const node = messageElsRef.current.get(last.id)
      const container = scrollRef.current
      if (!node || !node.isConnected || !container) return
      seen.add(last.id)
      // `stopScroll` MUST precede scrollIntoView — the imperative scrollTop
      // write is what the library's geometry tracker uses to flip
      // `escapedFromLock`, so any in-flight scrollToBottom spring is
      // first cancelled.
      stopScroll()
      // Instant (not smooth): the markdown body contains async <img>
      // children whose loads race a 300ms smooth animation and leave
      // the viewport mid-article. Instant snap dodges the race; the
      // ResizeObserver below re-anchors any post-snap growth.
      node.scrollIntoView({ block: 'start' })

      // Tear down any prior watcher (rapid back-to-back display turns).
      disposeAnchorWatcher(anchorWatcherRef.current)
      // Re-anchor on async growth for ~2s. Bail if the user scrolls
      // meaningfully past the baseline so we don't fight their reading
      // position. NOTE: the watcher lives in a ref, not in the effect's
      // cleanup, so subsequent `messages` mutations during streaming
      // don't kill it.
      const baselineScrollTop = container.scrollTop
      const ro = new ResizeObserver(() => {
        if (!node.isConnected) {
          ro.disconnect()
          return
        }
        if (container.scrollTop > baselineScrollTop + 200) {
          ro.disconnect()
          return
        }
        node.scrollIntoView({ block: 'start' })
      })
      ro.observe(node)
      const timer = setTimeout(() => {
        ro.disconnect()
        // Guard against nulling a successor watcher mid-flight.
        if (anchorWatcherRef.current?.id === last.id) {
          anchorWatcherRef.current = null
        }
      }, 2000)
      anchorWatcherRef.current = { id: last.id, ro, timer }
    }, [messages, autoScroll, stopScroll, scrollRef])

    // Component-unmount cleanup for the active watcher.
    useEffect(() => () => {
      disposeAnchorWatcher(anchorWatcherRef.current)
      anchorWatcherRef.current = null
    }, [])

    // ---- Load-more (infinite-scroll UP) ------------------------------
    // Distinct from stick-to-bottom; uses its own IntersectionObserver
    // on the top sentinel.
    useEffect(() => {
      const scrollContainer = scrollRef.current
      const sentinelElement = sentinelRef.current
      if (!scrollContainer || !sentinelElement || !hasNextPage) return

      const observer = new IntersectionObserver(
        (entries) => {
          const entry = entries[0]
          if (!entry) return
          if (entry.isIntersecting && !isFetchingRef.current) {
            onLoadMoreRef.current?.()
          }
        },
        { root: scrollContainer, rootMargin: '200px', threshold: 0.1 },
      )
      observer.observe(sentinelElement)
      return () => observer.disconnect()
    }, [hasNextPage, scrollRef])

    // Expose the scroll container ref to parents that need it (rare,
    // but the existing public contract). Library's `scrollRef` is a
    // MutableRefObject<HTMLElement> so we cast to the public type.
    useImperativeHandle(ref, () => scrollRef.current as HTMLDivElement, [scrollRef])

    if (isLoading) {
      return (
        <ChatMessageListSkeleton
          className={className}
          showAvatars={showAvatars}
          fullWidth={fullWidth}
          contentClassName={contentClassName}
          messageCount={6}
        />
      )
    }

    // Adapt the library's refs to React's `Ref<HTMLDivElement>` JSX
    // slot. The library types its refs against `HTMLElement` (broader
    // than `HTMLDivElement`); MutableRefObject is INVARIANT in its
    // type parameter, so a direct assignment fails type-check. The
    // callback form is contravariant in its arg, so a tiny adapter
    // that invokes the library's RefCallback portion type-checks
    // cleanly AND preserves the library's internal observer setup.
    // (The intersection type `MutableRefObject<T> & RefCallback<T>`
    // means calling `scrollRef(el)` writes `el` into `scrollRef.current`
    // AND triggers the library's mount-bookkeeping.)
    // Note the explicit `: void` return type. The library's RefCallback
    // signature returns `void | (() => void)` (React 19's optional ref-
    // cleanup contract). The hub's React types reject that union in a
    // JSX `Ref<T>` slot. Force `void` here — the library doesn't use
    // the cleanup return path in any meaningful way for the public hook.
    const setScrollRef = (el: HTMLDivElement | null): void => {
      scrollRef(el)
    }
    const setContentRef = (el: HTMLDivElement | null): void => {
      contentRef(el)
    }

    // Footer-pinned streaming loader. Rendered OUTSIDE the scroller (a
    // sibling of the scroll div, like the sticky approvals below) so it
    // stays put while messages stream and grow — no jitter from the
    // last-message height changing under it.
    //
    // Hidden when the agent is actually PAUSED waiting on the user: the
    // last message's last segment is a pending approval (inline), or
    // there are escalated pending approvals shown in the sticky bar.
    const lastMessage = messages[messages.length - 1]
    const lastSegments = Array.isArray(lastMessage?.content) ? lastMessage.content : null
    const lastSegment = lastSegments?.[lastSegments.length - 1]
    const isPausedOnApproval =
      !!lastSegment &&
      (lastSegment.type === 'approval_request' || lastSegment.type === 'approval_batch') &&
      (lastSegment.status === undefined || lastSegment.status === 'pending')
    const showStreamingLoader =
      isTyping &&
      !isPausedOnApproval &&
      !(pendingApprovals && pendingApprovals.length > 0)

    return (
      <div className="relative flex-1 min-h-0 flex flex-col">
        <div
          ref={setScrollRef}
          className={cn(
            "flex h-full w-full flex-col overflow-y-auto overflow-x-hidden flex-1",
            "scrollbar-thin scrollbar-track-transparent scrollbar-thumb-ods-border/30 hover:scrollbar-thumb-ods-text-secondary/30",
            className,
          )}
          {...props}
        >
          <div
            ref={setContentRef}
            className={cn(
              // `fullWidth=true` drops the centered-narrow column for
              // side-panel hosts (e.g. multi-platform-hub Mingo). Same
              // semantics as ChatHeader / ChatInput / ChatFooter.
              fullWidth
                ? "flex w-full flex-col pb-[var(--spacing-system-xs)] min-w-0"
                : "mx-auto flex w-full max-w-ods-content-narrow flex-col pb-[var(--spacing-system-xs)] min-w-0",
              contentClassName ?? "px-[var(--spacing-system-m)]",
            )}
            style={{ minHeight: '100%' }}
          >
            {hasNextPage && (
              <div ref={sentinelRef} className="h-px" />
            )}
            <div className="flex-1" />
            {messages.map((message, index) => {
              // Hidden messages (synthetic continuation prompts the host
              // injects after an approval card) are part of the API
              // conversation history but never render. Skipping here
              // keeps the visible thread coherent — see
              // `Message.hidden` doc-comment in message.types.ts.
              if (message.hidden) return null
              return (
                <ChatMessageEnhanced
                  key={message.id}
                  ref={getRegisterMessageEl(message.id)}
                  role={message.role}
                  name={message.name}
                  content={message.content}
                  timestamp={message.timestamp}
                  isTyping={index === messages.length - 1 && isTyping && message.role === 'assistant'}
                  avatar={showAvatars ? message.avatar : null}
                  showAvatar={showAvatars}
                  assistantType={message.assistantType || assistantType}
                  authorType={message.authorType}
                  assistantIcon={message.role !== 'user' ? assistantIcon : undefined}
                  chatRefs={message.chatRefs}
                  renderEntityCard={renderEntityCard}
                  NavLinkAnchor={NavLinkAnchor}
                />
              )
            })}
          </div>
        </div>

        {/* Footer-pinned streaming loader — outside the scroller so it
            doesn't jitter as the streaming message grows. Color is set
            via inline style (CSS var) rather than a Tailwind class so it
            is JIT-independent when this lib is consumed via yalc. */}
        {showStreamingLoader && (
          <div
            className={cn(
              fullWidth
                ? "w-full flex items-center gap-[var(--spacing-system-xxs)] py-[var(--spacing-system-xs)]"
                : "mx-auto w-full max-w-ods-content-narrow flex items-center gap-[var(--spacing-system-xxs)] py-[var(--spacing-system-xs)]",
              contentClassName ?? "px-[var(--spacing-system-m)]",
            )}
            style={{ color: 'var(--color-text-muted)' }}
            role="status"
            aria-live="polite"
          >
            <DotsLoaderIcon className="w-6 h-6" />
            <CyclingPhrase words={STREAMING_WORDS} className="text-sm" />
          </div>
        )}

        {/* Sticky Pending Approvals — outside the scroller; same
            structure as the v1 baseline. The library's RO watches
            `contentRef` (INSIDE the scroller), so height changes to
            this sibling don't trigger the library directly. If a
            future UX requires snapping to bottom when approvals
            appear, that hookup goes here. */}
        {pendingApprovals && pendingApprovals.length > 0 && (
          <div className={cn(
            "border-t border-ods-border bg-ods-bg/95 backdrop-blur-sm",
            fullWidth ? "w-full" : "mx-auto w-full max-w-ods-content-narrow",
            contentClassName ?? "px-[var(--spacing-system-m)]",
          )}>
            <ChatMessageEnhanced
              role="assistant"
              name={assistantType === 'mingo' ? 'Mingo' : 'Fae'}
              content={pendingApprovals}
              timestamp={new Date()}
              showAvatar={showAvatars}
              assistantType={assistantType}
              assistantIcon={assistantIcon}
              NavLinkAnchor={NavLinkAnchor}
              className="py-3"
            />
          </div>
        )}
      </div>
    )
  },
)

ChatMessageList.displayName = "ChatMessageList"

export { ChatMessageList }
