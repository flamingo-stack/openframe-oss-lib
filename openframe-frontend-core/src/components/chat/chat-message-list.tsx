"use client"

import { useRef, useState, useEffect, useLayoutEffect, useImperativeHandle, forwardRef } from "react"
import { useStickToBottom } from "use-stick-to-bottom"
import { cn } from "../../utils/cn"
import { ChatMessageEnhanced } from "./chat-message-enhanced"
import { ChatMessageListLoader } from "./chat-message-loader"
import { useDelayedFlag } from "./hooks/use-delayed-flag"
import { PulseDots } from "../ui/pulse-dots"
import type { ChatMessageListProps } from "./types"

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
      contentClassName,
      assistantType,
      assistantIcon,
      pendingApprovals,
      hasNextPage,
      isFetchingNextPage,
      onLoadMore,
      renderEntityCard,
      ...props
    },
    ref,
  ) => {
    // ---- Library: useStickToBottom -----------------------------------
    // `resize: 'smooth'` — during streaming, content grows token-by-
    // token; library uses spring physics to follow the bottom for a
    // ChatGPT/Claude.ai-like feel (vs jarring instant snaps).
    // `initial: 'instant'` — snap to bottom on first mount BEFORE
    // browser paint. Without this, a page reload that lands on a long
    // history would briefly paint the top of the list (oldest msgs)
    // before any post-paint effect could run `scrollTop = bottom`. The
    // library writes scrollTop in the commit phase, so the first paint
    // is already at the bottom.
    const { scrollRef, contentRef, scrollToBottom } = useStickToBottom({
      resize: 'smooth',
      initial: 'instant',
    })

    // ---- Prepend / load-more state (NOT owned by the library) --------
    // `scrollEl` and `sentinelEl` are STATE, not refs, so the load-more
    // effect re-runs when either element mounts/unmounts. This is the
    // critical fix for the reload pagination bug: when the loader is
    // showing, the scroll container is unmounted (`scrollRef.current ==
    // null`); when the loader disappears later, neither `hasNextPage`
    // nor `messages.length` changes — but `scrollEl` flips from null to
    // the new element, which re-runs the effect.
    const [scrollEl, setScrollEl] = useState<HTMLDivElement | null>(null)
    const [sentinelEl, setSentinelEl] = useState<HTMLDivElement | null>(null)
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
    // `useLayoutEffect` so the scrollTop write lands BEFORE browser
    // paint — otherwise a dialog switch with prior history flashes the
    // top of the list (oldest msgs) for one frame before snapping down.
    //
    // Critical: gate on `scrollEl` (state, not ref). When `useDelayedFlag`
    // is showing the loader, the scroll container is UNMOUNTED. If we
    // ran the snap-logic during the loader phase, `scrollToBottom` would
    // no-op AND `prevRenderRef` would record the new dialog/count — so
    // when the loader finally hides and the container remounts, we'd
    // think "no dialog change" and never snap. By depending on
    // `scrollEl`, this effect re-runs the moment the container mounts
    // and catches up on any transition that happened during the loader.
    useLayoutEffect(() => {
      if (!autoScroll || !scrollEl) return

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
        }
        // Assistant-only new messages → the library's resize-watch
        // already keeps the bottom locked when the user hasn't
        // escaped. No explicit call needed; spring animation runs.
      }
    }, [autoScroll, messages, dialogId, scrollToBottom, scrollEl])

    // ---- Prepend anchoring (load-older) ------------------------------
    // The library doesn't preserve user position when content prepends
    // ABOVE the viewport. We do it ourselves: snapshot scrollHeight
    // BEFORE the new render, then add the delta after to keep the
    // user on the same message they were reading. `useLayoutEffect`
    // so the scrollTop write lands before paint (no visible jump).
    useLayoutEffect(() => {
      const el = scrollEl
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
    }, [messages, scrollEl])

    // ---- Load-more (infinite-scroll UP) ------------------------------
    // Distinct from stick-to-bottom. Two mechanisms in parallel:
    //  1. IntersectionObserver on the top sentinel — cheap, fires when
    //     the sentinel actually enters the viewport (± rootMargin).
    //  2. Scroll-listener fallback (200px from top) — covers the race
    //     where IO mounts before the sentinel/scroll container has its
    //     final geometry on page reload, and the case where the user
    //     reaches the top on a chat that initially had `hasNextPage`
    //     undefined (cache cold). Both call `onLoadMoreRef.current` and
    //     guard with `isFetchingRef` so a double-fire is a single fetch.
    // Deps include `messages.length` so the effect re-binds once content
    // actually renders (fixes the case where the first commit has
    // hasNextPage=true but sentinel ref isn't yet attached).
    useEffect(() => {
      const scrollContainer = scrollEl
      const sentinelElement = sentinelEl
      if (!scrollContainer || !hasNextPage) return

      const tryLoad = () => {
        if (isFetchingRef.current) return
        onLoadMoreRef.current?.()
      }

      let observer: IntersectionObserver | undefined
      if (sentinelElement) {
        observer = new IntersectionObserver(
          (entries) => {
            const entry = entries[0]
            if (entry?.isIntersecting) tryLoad()
          },
          { root: scrollContainer, rootMargin: '200px', threshold: 0.1 },
        )
        observer.observe(sentinelElement)
      }

      const onScroll = () => {
        if (scrollContainer.scrollTop <= 200) tryLoad()
      }
      scrollContainer.addEventListener('scroll', onScroll, { passive: true })

      return () => {
        observer?.disconnect()
        scrollContainer.removeEventListener('scroll', onScroll)
      }
    }, [hasNextPage, scrollEl, sentinelEl, messages.length])

    // Expose the scroll container ref to parents that need it (rare,
    // but the existing public contract). Library's `scrollRef` is a
    // MutableRefObject<HTMLElement> so we cast to the public type.
    useImperativeHandle(ref, () => scrollRef.current as HTMLDivElement, [scrollRef])

    // Gate the loader: only show after 200ms (fast loads never flicker),
    // and once shown, hold for at least 400ms (no sub-frame flash if data
    // arrives a moment later).
    const showLoader = useDelayedFlag(isLoading, { delay: 200, minDuration: 400 })

    if (showLoader) {
      return (
        <ChatMessageListLoader
          className={className}
          assistantIcon={assistantIcon}
          assistantType={assistantType}
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
      setScrollEl(el)
    }
    const setContentRef = (el: HTMLDivElement | null): void => {
      contentRef(el)
    }

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
              "mx-auto flex w-full max-w-3xl flex-col pb-2 min-w-0",
              contentClassName || "px-4",
            )}
            style={{ minHeight: '100%' }}
          >
            {/* Infinite scroll sentinel + loader for older pages */}
            {hasNextPage && (
              <div ref={setSentinelEl} className="h-px" />
            )}
            {isFetchingNextPage && (
              <div
                className="flex justify-center py-3 animate-in fade-in duration-200"
                role="status"
                aria-live="polite"
                aria-busy="true"
              >
                <PulseDots size="sm" />
              </div>
            )}
            <div className="flex-1" />
            {messages.map((message, index) => (
              <ChatMessageEnhanced
                key={message.id}
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
              />
            ))}
          </div>
        </div>

        {/* Sticky Pending Approvals — outside the scroller; same
            structure as the v1 baseline. The library's RO watches
            `contentRef` (INSIDE the scroller), so height changes to
            this sibling don't trigger the library directly. If a
            future UX requires snapping to bottom when approvals
            appear, that hookup goes here. */}
        {pendingApprovals && pendingApprovals.length > 0 && (
          <div className={cn(
            "border-t border-ods-border bg-ods-bg/95 backdrop-blur-sm",
            "mx-auto w-full max-w-3xl",
            contentClassName || "px-4",
          )}>
            <ChatMessageEnhanced
              role="assistant"
              name={assistantType === 'mingo' ? 'Mingo' : 'Fae'}
              content={pendingApprovals}
              timestamp={new Date()}
              showAvatar={showAvatars}
              assistantType={assistantType}
              assistantIcon={assistantIcon}
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
