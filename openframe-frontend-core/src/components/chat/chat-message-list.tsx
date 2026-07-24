"use client"

import { useRef, useState, useEffect, useLayoutEffect, useImperativeHandle, forwardRef } from "react"
import { useStickToBottom } from "use-stick-to-bottom"
import { cn } from "../../utils/cn"
import { ChatMessageEnhanced } from "./chat-message-enhanced"
import { ChatMessageListSkeleton } from "./chat-message-skeleton"
import { DotsLoaderIcon, Arrow02DownIcon } from "../icons-v2-generated"
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

/** Distance from the bottom (px) still counted as "at the bottom".
 *  Mirrors `use-stick-to-bottom`'s internal `STICK_TO_BOTTOM_OFFSET_PX`
 *  so the jump-to-bottom button and the library agree on the boundary. */
const BOTTOM_THRESHOLD_PX = 70

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
 *  - **Bottom-follow intent** (see `followBottomRef` below). The
 *    library's follow is gated on its own `isAtBottom` flag, which this
 *    list's layout can lose silently; we own the INTENT and re-assert.
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
      overscrollContain = true,
      pinBottom = false,
      showAvatars = true,
      fullWidth = false,
      contentClassName,
      assistantType,
      approvalVariant,
      assistantIcon,
      pendingApprovals,
      hasNextPage,
      isFetchingNextPage,
      onLoadMore,
      renderEntityCard,
      resolveContextIcon,
      renderContextItem,
      renderMention,
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
    // Fresh dialogId for the IntersectionObserver callback (its effect must
    // not depend on `dialogId` or it would re-create on every dialog switch
    // mid-stream; the ref keeps the snapshot's dialog tag current).
    const dialogIdRef = useRef(dialogId)
    dialogIdRef.current = dialogId

    // ---- Bottom-follow intent (list-owned lock) ----------------------
    // The library follows the bottom only while ITS OWN `isAtBottom` flag
    // is true, and this list's layout loses that flag silently in two
    // ways:
    //
    //  1. **The scroller's own box changes.** The library's
    //     ResizeObserver watches `contentRef` (INSIDE the scroller) only.
    //     The streaming loader unmounting and the host's source-chip row
    //     mounting — both siblings BELOW the scroller (see render) —
    //     change the scroller's `clientHeight`, which moves the bottom
    //     without emitting anything the library can observe.
    //  2. **Resize-induced scroll events read as a user gesture.**
    //     Fetch-mode entity cards mount as a skeleton and settle to a
    //     different height; a shrink clamps `scrollTop` down, and the
    //     library's scroll handler can see that as a scroll-UP and
    //     permanently escape the lock (its `resizeDifference` guard is a
    //     `setTimeout(…, 1)` race, so this is intermittent).
    //
    // Either way the thread stops following mid-turn. It bites hardest on
    // card-heavy answers — a slash-command listing (`/getting-started`)
    // renders a dozen fetch-mode cards with cover images that keep
    // resolving for SECONDS after the stream ends, so everything after
    // the lock was lost lands below the fold.
    //
    // Fix: this list owns the INTENT. Sending a message (or opening a
    // dialog) arms it; only a real user scroll-up gesture — or a
    // top-anchored turn, which deliberately parks elsewhere — disarms it.
    // While armed, ANY geometry change re-asserts `scrollToBottom`, and
    // because that call also re-sets the library's `isAtBottom`, a lost
    // lock self-heals instead of being permanent.
    const followBottomRef = useRef(false)

    // Drives the jump-to-bottom affordance. Derived from GEOMETRY, not
    // from the library's `isAtBottom`: that flag is the one this list
    // loses silently (see above), and a stale `true` would hide the
    // button in exactly the situation it exists for. Threshold mirrors
    // the library's own `STICK_TO_BOTTOM_OFFSET_PX`.
    const [atBottom, setAtBottom] = useState(true)

    // Tracks previous render state for explicit "force-stick" decisions
    // (dialog change, first message, new user message). The library
    // covers ongoing streaming; these are about INTENT transitions.
    const prevRenderRef = useRef<{
      dialogId: string | undefined
      messageCount: number
      lastMessageId: string | undefined
    }>({ dialogId: undefined, messageCount: 0, lastMessageId: undefined })

    // Geometry snapshot captured the instant the top sentinel triggers
    // onLoadMore (BEFORE the older page lands), applied once when the taller
    // content commits. Keyed on the LOAD LIFECYCLE, not `messages[0].id`: the
    // history processor groups consecutive assistant turns into one bubble
    // keyed by the group's LAST id, so an older page that is all continuation
    // of the first bubble grows that bubble in place WITHOUT changing its id.
    // An id-based anchor misses that growth and leaves the reader pinned at
    // the top (and the still-visible sentinel never re-fires).
    const loadOlderAnchorRef = useRef<{
      dialogId: string | undefined
      scrollHeight: number
      scrollTop: number
    } | null>(null)

    // ---- Force-stick: dialog change / first-load / new user message --
    useEffect(() => {
      if (!autoScroll) return

      const dialogChanged = dialogId !== prevRenderRef.current.dialogId
      const prevCount = prevRenderRef.current.messageCount
      const prevLastId = prevRenderRef.current.lastMessageId
      const newCount = messages.length
      const currentLastId = messages[messages.length - 1]?.id
      prevRenderRef.current = { dialogId, messageCount: newCount, lastMessageId: currentLastId }

      if (dialogChanged) {
        // Opening a different chat — instant snap to bottom.
        followBottomRef.current = true
        void scrollToBottom({ animation: 'instant', ignoreEscapes: true })
        return
      }
      if (newCount > 0 && prevCount === 0) {
        // First message arrived in an empty chat — instant snap.
        followBottomRef.current = true
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
        //
        // The tail must be located via the previous LAST message id,
        // not `slice(prevCount)`: when load-older PREPENDS a page,
        // count grows but the new messages are at the HEAD —
        // `slice(prevCount)` would return already-rendered tail
        // messages (which contain user bubbles) and force-scroll the
        // reader away from the older page they just loaded. With the
        // id-based slice a pure prepend yields an empty tail → no
        // scroll, and the prepend-anchoring effect below keeps their
        // viewport position.
        const prevLastIdx = prevLastId ? messages.findIndex((m) => m.id === prevLastId) : -1
        const newSlice = prevLastIdx >= 0 ? messages.slice(prevLastIdx + 1) : messages.slice(prevCount)
        const hasNewUser = newSlice.some((m) => m.role === 'user')
        if (hasNewUser) {
          // Arms the follow intent for the WHOLE turn: the answer's
          // async growth (attachment images, streamed tokens, entity
          // cards resolving out of their skeletons long after the
          // stream ends) is re-asserted by the follow effect below.
          // This replaces the old per-`<img>` `load`-handler hack —
          // same defect class, but the ResizeObserver sees every
          // source of growth, not just images present at send time.
          followBottomRef.current = true
          void scrollToBottom({ animation: 'instant', ignoreEscapes: true })
        }
        // Assistant-only new messages → the library's resize-watch
        // already keeps the bottom locked when the user hasn't
        // escaped. No explicit call needed; spring animation runs.
      }
    }, [autoScroll, messages, dialogId, scrollToBottom])

    // ---- Follow the bottom while the intent is armed -----------------
    // Installs once per mount (all deps are stable). See the
    // `followBottomRef` comment above for WHY this exists.
    useEffect(() => {
      if (!autoScroll) return
      const scroller = scrollRef.current
      const content = contentRef.current
      if (!scroller || !content) return

      // Re-assert on ANY geometry change. Deliberately WITHOUT
      // `ignoreEscapes`: the library must stay free to hand control back
      // on a real gesture mid-animation. Re-asserting is precisely what
      // re-sets its `isAtBottom`, so a silently-lost lock recovers on the
      // next resize instead of staying broken for the rest of the turn.
      // Cheap to call repeatedly — the library returns the in-flight
      // promise when an animation with the same behaviour is running.
      const measure = () => {
        const distance = scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight
        setAtBottom(distance <= BOTTOM_THRESHOLD_PX)
      }

      const reassert = () => {
        if (followBottomRef.current) void scrollToBottom({ animation: 'smooth' })
        // Measured on every geometry change, follow armed or not: a
        // sibling growing below the scroller moves the bottom without
        // any scroll event, and the button has to notice.
        measure()
      }

      const ro = new ResizeObserver(reassert)
      ro.observe(content)   // tokens, entity cards, images
      ro.observe(scroller)  // streaming loader / source chips below it

      // --- user-intent disarm ---------------------------------------
      // Only a deliberate move AWAY from the bottom releases the lock.
      // Resize-derived scroll events are NOT gestures, which is exactly
      // the distinction the library's heuristic gets wrong.
      const disarm = () => {
        followBottomRef.current = false
      }
      const onWheel = (e: WheelEvent) => {
        if (e.deltaY < 0) disarm()
      }
      const onKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'ArrowUp' || e.key === 'PageUp' || e.key === 'Home') disarm()
      }
      let touchY: number | null = null
      const onTouchStart = (e: TouchEvent) => {
        touchY = e.touches[0]?.clientY ?? null
      }
      const onTouchMove = (e: TouchEvent) => {
        const y = e.touches[0]?.clientY
        if (y == null || touchY == null) return
        if (y > touchY) disarm() // finger travels DOWN → content moves up
        touchY = y
      }
      // Scrollbar drag emits neither wheel nor touch — a scrollTop
      // DECREASE while the pointer is held down is the same intent.
      //
      // ALL pointer listeners are on `window`, deliberately. The scroller is a
      // native `overflow-y-auto` div (OverlayScrollbars was reverted in #1512),
      // so its native scrollbar IS part of `scroller` and a `pointerdown` on the
      // thumb does reach it — but `window` is a safe superset that also survives
      // any future host component (or a return to a custom-scrollbar library
      // that renders the thumb OUTSIDE the viewport) without stranding
      // `pointerDown` at `false` and reintroducing the yank-back-mid-drag bug.
      //
      // The POINTER listeners use CAPTURE phase, so the guarantee is structural
      // rather than contingent on nothing between us and `window` ever calling
      // `stopPropagation` on the pointer path.
      //
      // `blur` deliberately does NOT use capture. Focus events don't bubble
      // but they DO capture, so a capture listener on `window` fires for
      // EVERY element blur in the document (the focus-delegation idiom) —
      // any focus change during a hold, e.g. the chat input blurring as the
      // user presses down on the scrollbar, would clear `pointerDown` and
      // re-open the very yank-back bug this block prevents. A TRUE window
      // blur targets `window` itself, so an at-target (bubble-phase)
      // listener still receives it: capture buys nothing and costs
      // correctness. Verified in jsdom: descendant blur reaches the capture
      // listener only; window blur reaches both.
      //
      // `pointerDown` must be cleared by every way a drag can END, not just
      // `pointerup`: a button released OUTSIDE the window, or the tab losing
      // focus mid-drag, delivers no `pointerup` at all and would leave the
      // flag stuck true. From then on ANY resize-induced scrollTop clamp — a
      // fetch-mode card settling from skeleton to a shorter height, i.e. the
      // exact case this whole block exists for — reads as a scroll-up gesture
      // and drops the lock. Same for merely HOLDING the button down (text
      // selection) while a card shrinks. Hence `pointercancel` + window
      // `blur`.
      let pointerDown = false
      let lastScrollTop = scroller.scrollTop
      const onPointerDown = () => {
        pointerDown = true
      }
      // A drag that RELEASES at the live end expresses the same intent as
      // clicking jump-to-bottom. The scroll events during that drag can't
      // re-arm (see the gate in `onScroll`), and releasing the button emits
      // no further `scroll`, so the re-arm is evaluated once here, when the
      // gesture is actually over.
      const rearmIfAtBottom = () => {
        if (followBottomRef.current) return
        const distance = scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight
        if (distance <= BOTTOM_THRESHOLD_PX) followBottomRef.current = true
      }
      const endPointer = () => {
        pointerDown = false
        rearmIfAtBottom()
      }
      const onScroll = () => {
        const st = scroller.scrollTop
        if (pointerDown && st < lastScrollTop) disarm()
        lastScrollTop = st
        // Landing at the bottom by hand is the SAME expressed intent as
        // clicking jump-to-bottom, so it re-arms a lock an earlier scroll-up
        // released. Without it the thread sits at-bottom (button hidden,
        // because `atBottom` is true) and then silently drifts away as the
        // answer grows.
        //
        // Gated on the drag being OVER (`!pointerDown`). A mid-drag `scroll`
        // is not a gesture that has ended, and a short scrollbar drag that
        // starts at the live end stays inside the 70px band — so re-arming
        // here would undo the `disarm()` two lines above on the very same
        // event and yank the reader back down mid-drag. Releasing the button
        // at the bottom still re-arms on the next scroll (or, if none
        // follows, on the next deliberate return to the end).
        if (
          !pointerDown &&
          !followBottomRef.current &&
          scroller.scrollHeight - st - scroller.clientHeight <= BOTTOM_THRESHOLD_PX
        ) {
          followBottomRef.current = true
        }
        measure()
      }
      measure()

      const winCapture = { capture: true, passive: true } as const

      scroller.addEventListener('wheel', onWheel, { passive: true })
      scroller.addEventListener('keydown', onKeyDown)
      scroller.addEventListener('touchstart', onTouchStart, { passive: true })
      scroller.addEventListener('touchmove', onTouchMove, { passive: true })
      window.addEventListener('pointerdown', onPointerDown, winCapture)
      scroller.addEventListener('scroll', onScroll, { passive: true })
      window.addEventListener('pointerup', endPointer, winCapture)
      window.addEventListener('pointercancel', endPointer, winCapture)
      // Bubble phase, NOT capture — see the note above.
      window.addEventListener('blur', endPointer, { passive: true })

      return () => {
        ro.disconnect()
        scroller.removeEventListener('wheel', onWheel)
        scroller.removeEventListener('keydown', onKeyDown)
        scroller.removeEventListener('touchstart', onTouchStart)
        scroller.removeEventListener('touchmove', onTouchMove)
        // `capture` must match the add call or the listener is not removed.
        window.removeEventListener('pointerdown', onPointerDown, { capture: true })
        scroller.removeEventListener('scroll', onScroll)
        window.removeEventListener('pointerup', endPointer, { capture: true })
        window.removeEventListener('pointercancel', endPointer, { capture: true })
        // Added WITHOUT capture — the remove must match.
        window.removeEventListener('blur', endPointer)
      }
    }, [autoScroll, scrollRef, contentRef, scrollToBottom])

    // ---- Passive-demo hard pin (pinBottom) ---------------------------
    // Scripted in-page replays (the Fae/Mingo demos) have no human at the
    // keyboard, so the newest streamed content must ALWAYS sit at the
    // bottom. `useStickToBottom`'s smart follow only tracks while the
    // viewer is "at bottom", which is unreliable for an assistant-only
    // stream from a cold, non-bottom mount (the exact bug where the last
    // reply landed below the fold). When `pinBottom` is set we snap the
    // scroller to its full height — the SAME mechanism for BOTH demo
    // surfaces, so Fae and Mingo behave 1:1.
    //
    // CRUCIAL: only re-pin when the content HEIGHT actually changed (a
    // streamed token appended, or the conversation swapped/reset). A parent
    // that recreates props on every render — EmbeddableChat in previewMode
    // rebuilds its scripted state each render, churning the `messages` array
    // identity — would otherwise fire this effect on every re-render and snap
    // the scroller back to the bottom, trapping the visitor and blocking
    // internal scroll (Mingo couldn't scroll while Fae, with stable memoized
    // props, could). Skipping the pin when the height is UNCHANGED means an
    // idle re-render leaves the scroller alone, so once the stream settles the
    // visitor can scroll up in BOTH surfaces; a real growth (streaming) or a
    // shrink (a new conversation) still re-pins to the fresh bottom.
    // `useLayoutEffect` so the write lands before paint (no visible jump).
    // Pair with `autoScroll={false}` so the library's spring doesn't fight.
    const pinPrevHeightRef = useRef(0)
    useLayoutEffect(() => {
      if (!pinBottom) {
        pinPrevHeightRef.current = 0
        return
      }
      const el = scrollRef.current
      if (!el) return
      if (el.scrollHeight === pinPrevHeightRef.current) return
      pinPrevHeightRef.current = el.scrollHeight
      el.scrollTop = el.scrollHeight
    }, [pinBottom, messages, isTyping, pendingApprovals, scrollRef])

    // ---- Prepend anchoring (load-older) ------------------------------
    // The library doesn't preserve user position when content grows ABOVE
    // the viewport. We do: from the pre-load geometry snapshot (taken in the
    // sentinel callback), add the height the list gained and re-pin scrollTop
    // so the message the user was reading stays put. `useLayoutEffect` so the
    // write lands before paint (no visible jump). Covers both a pure prepend
    // (new ids on top) and a boundary-merge (first bubble grows in place) —
    // it measures total height delta, not message identity.
    useLayoutEffect(() => {
      const el = scrollRef.current
      const anchor = loadOlderAnchorRef.current
      if (!el || !anchor) return
      // Dialog switched out from under a pending load — abandon; the
      // force-stick effect owns the new dialog's position.
      if (anchor.dialogId !== dialogId) {
        loadOlderAnchorRef.current = null
        return
      }
      // Hold the anchor across the intermediate renders between firing
      // onLoadMore and the older page committing (the isFetchingNextPage
      // flip, and in some hosts a two-stage store update) — those don't grow
      // the list. Apply on the first render where it actually grew taller,
      // which is the prepend (new ids on top) or a boundary-merge (first
      // bubble grew in place). Same-id boundary-merge is why this can't key
      // on message count.
      const addedHeight = el.scrollHeight - anchor.scrollHeight
      if (addedHeight <= 0) return
      loadOlderAnchorRef.current = null
      el.scrollTop = anchor.scrollTop + addedHeight
    }, [messages, dialogId, scrollRef])

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
      // first cancelled. The list-owned follow intent is released for the
      // same reason: this turn deliberately parks at the message TOP, so
      // its own async growth must NOT drag the reader to the bottom.
      followBottomRef.current = false
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
    //
    // `isFetchingNextPage` is in the deps so the observer is RE-CREATED when a
    // fetch completes: IntersectionObserver fires no new callback while an
    // element stays continuously intersecting, so after an older page lands
    // with the sentinel still in view (small prepend, or rootMargin overlap)
    // nothing would re-trigger until the user scrolled it out and back in.
    // Re-observing re-evaluates the current intersection and fires again if
    // the sentinel is still visible — load continues until it's pushed out.
    useEffect(() => {
      const scrollContainer = scrollRef.current
      const sentinelElement = sentinelRef.current
      if (!scrollContainer || !sentinelElement || !hasNextPage) return

      const observer = new IntersectionObserver(
        (entries) => {
          const entry = entries[0]
          if (!entry) return
          if (entry.isIntersecting && !isFetchingRef.current) {
            // Snapshot pre-load geometry so the prepend-anchoring layout
            // effect can re-pin scrollTop once the taller content commits.
            const el = scrollRef.current
            if (el) {
              loadOlderAnchorRef.current = {
                dialogId: dialogIdRef.current,
                scrollHeight: el.scrollHeight,
                scrollTop: el.scrollTop,
              }
            }
            onLoadMoreRef.current?.()
          }
        },
        { root: scrollContainer, rootMargin: '200px', threshold: 0.1 },
      )
      observer.observe(sentinelElement)
      return () => observer.disconnect()
    }, [hasNextPage, isFetchingNextPage, scrollRef])

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
      <div className="flex-1 min-h-0 flex flex-col">
        {/* Positioning box for the jump-to-bottom button: it wraps ONLY the
            scroller, so `absolute bottom-…` really is the scroller's lower
            edge. The outer flex column also holds the streaming loader and the
            approvals bar, and anchoring against THAT box put the button over
            the loader for the whole of every stream — precisely when it is
            most likely to be visible. */}
        <div className="relative flex-1 min-h-0 flex flex-col">
          <div
            ref={setScrollRef}
            className={cn(
              "flex h-full w-full flex-col overflow-y-auto overflow-x-hidden flex-1",
              // `overscroll-contain` (default ON, opt-out via `overscrollContain={false}`):
              // reaching the top/bottom of the thread must NOT chain the wheel/
              // touch scroll to the page behind the chat — e.g. the company-hub
              // deck (native body scroll + sticky slide panels) would otherwise
              // advance slides while you scroll the chat (fixed in #1501; kept as
              // the prop default here). Passive in-page DEMO chats disable it so
              // the surrounding page keeps scrolling normally when the pointer is
              // over the (non-interactive) thread.
              overscrollContain && "overscroll-contain",
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
                // ONE OWNER for the pending turn. Both send paths mint an empty
                // assistant placeholder (the accumulation target — it MUST stay
                // in state) and flip the phase to 'thinking'. Rendering it here
                // too would put an author label with no body in the transcript
                // WHILE the footer loader below already represents the same
                // pending turn — two owners, and an `aria-live` log that
                // announces a bare "Mingo". The footer loader wins (it is
                // already `role="status" aria-live="polite"`, sits outside the
                // scroller so it can't jitter the thread, and cycles the
                // progress phrase), so the placeholder is not rendered AT ALL
                // until it carries something visible — removed from the live
                // region, not merely hidden. Mirrors `endSseTurn`, which prunes
                // an empty trailing assistant AFTER a turn; this closes the same
                // window BEFORE the first token. Any non-text segment (tool
                // execution, approval card, thinking) counts as visible.
                const isEmptyPendingTurn =
                  index === messages.length - 1 &&
                  isTyping &&
                  message.role === 'assistant' &&
                  !hasNonEmptyContent(message.content) &&
                  (!Array.isArray(message.content) ||
                    message.content.every((s) => s.type === 'text'))
                if (isEmptyPendingTurn) return null
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
                    approvalVariant={approvalVariant}
                    authorType={message.authorType}
                    assistantIcon={message.role !== 'user' ? assistantIcon : undefined}
                    chatRefs={message.chatRefs}
                    contextItems={message.contextItems}
                    resolveContextIcon={resolveContextIcon}
                    renderContextItem={renderContextItem}
                    renderMention={renderMention}
                    renderEntityCard={renderEntityCard}
                    NavLinkAnchor={NavLinkAnchor}
                  />
                )
              })}
            </div>
          </div>

          {/* Jump to bottom. The manual escape hatch from auto-scroll that
              every 2026 chat surface ships (AI Elements calls it
              `ConversationScrollButton`) and the WCAG 2.2.2 counterpart to
              moving content: the reader can always get back to the live
              end without hunting for it. Positioned inside the scroller's
              OWN `relative` wrapper above, so `bottom` really is the
              scroller's lower edge and not the outer column's (which also
              carries the streaming loader). It costs the thread no layout
              height either way — a sibling would shrink the scroller and
              move the very bottom it points at. Hidden while at the bottom
              and in passive demo hosts. */}
          {autoScroll && !atBottom && messages.length > 0 && (
            <button
              type="button"
              onClick={() => {
                // Clicking IS the intent to return to the live end, so it
                // re-arms the follow lock a scroll-up had released.
                followBottomRef.current = true
                void scrollToBottom({ animation: 'smooth' })
              }}
              aria-label="Scroll to latest message"
              className={cn(
                "absolute bottom-[var(--spacing-system-s)] left-1/2 -translate-x-1/2 z-10",
                "flex items-center justify-center size-9 rounded-full",
                "bg-ods-card text-ods-text-primary border border-ods-border shadow-lg",
                "hover:bg-ods-bg-hover transition-colors",
              )}
            >
              <Arrow02DownIcon size={16} />
            </button>
          )}
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
            <CyclingPhrase words={STREAMING_WORDS} className="text-h6" />
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
              approvalVariant={approvalVariant}
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
