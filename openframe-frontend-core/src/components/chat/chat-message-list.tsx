"use client"

import {
  useRef,
  useEffect,
  useLayoutEffect,
  useCallback,
  useImperativeHandle,
  useState,
  forwardRef,
  useMemo,
} from "react"
import { cn } from "../../utils/cn"
import { ChatMessageEnhanced } from "./chat-message-enhanced"
import { ChatMessageListSkeleton } from "./chat-message-skeleton"
import type { ChatMessageListProps } from "./types"

/*
 * Stick-to-bottom architecture (v2 — 2026)
 *
 * Replaces the prior "1.5s ResizeObserver window + 4 racing scrollTop
 * mutation sites" approach that regressed on streaming responses longer
 * than 1.5 seconds. v2 fixes the regression + addresses the
 * device/race/UX issues five parallel reviewers surfaced.
 *
 * Mechanism (matches stackblitz-labs/use-stick-to-bottom, the library
 * Vercel AI SDK Elements ships in 2026):
 *
 *  - **Bottom sentinel + IntersectionObserver** owns the `isAtBottom`
 *    state. `rootMargin: 0 0 NEAR_BOTTOM_PX 0` widens the bottom edge
 *    so "within NEAR_BOTTOM_PX of bottom" still counts as at-bottom.
 *    IO does NOT fire for programmatic scroll origin; it reports
 *    geometry only, so we don't fight ourselves.
 *
 *  - **ResizeObserver on the inner content** (NOT the scroller) runs
 *    for the lifetime of the mount. When content grows AND the user
 *    has elected stickiness, we rescue scroll to bottom inside a
 *    `requestAnimationFrame`. No timeout — the old 1.5s cap was the
 *    regression source.
 *
 *  - **Second ResizeObserver on the scroller itself** rescues the
 *    "approvals bar appeared / pulled-up viewport" case: when the
 *    scroller's CLIENT height shrinks while we're sticky, the
 *    streaming text would otherwise scroll out of view behind the new
 *    bar. We re-snap to bottom.
 *
 *  - **Explicit user-escape signals**: wheel (deltaY < 0), touchmove
 *    (drag down with cancelable event + larger threshold so iOS
 *    momentum doesn't false-positive), keydown (PageUp / ArrowUp /
 *    Home) — only when focus is INSIDE the scroller (the body-focus
 *    fallback in v1 released stickiness from ANY arrow keypress on the
 *    page; reviewer-flagged CRIT). The scroller is `tabIndex={-1}` so
 *    it can receive focus.
 *
 *  - **Release-debounce**: when a user escape signal fires, we
 *    snapshot the timestamp into `releasedAtRef`. The IO callback
 *    refuses to re-engage stickiness within `RELEASE_DEBOUNCE_MS` of
 *    that snapshot. This kills the "wheel-inside-near-bottom-band"
 *    race the Logic reviewer flagged HIGH: without the window, IO
 *    fires AFTER the wheel handler (IO is queued, wheel is sync),
 *    sees the user is still in the slack band, sets stick=true,
 *    next RO tick yanks them back to bottom — flicker.
 *
 *  - **Visibility-change handling**: rAF is paused on backgrounded
 *    tabs, so a pending scroll-write can wedge for minutes. On
 *    `visibilitychange === 'visible'`, we drop any pending rAF and
 *    re-snap if sticky. Closes the Bug-Hunter CRIT.
 *
 *  - **visualViewport.resize**: iOS opens/closes the on-screen
 *    keyboard by shrinking the visual viewport (NOT the scroller's
 *    clientHeight directly). We listen and re-snap on stick. Closes
 *    the UX/Bug-Hunter HIGH about streaming hiding behind keyboard.
 *
 *  - **Jump-to-bottom pill**: when the user releases, a floating pill
 *    appears at the bottom with an unread count (messages arrived
 *    after release). Tap re-engages stickiness + scrolls. Closes the
 *    UX-Quality HIGH about reader-mode users not knowing the chat
 *    answered.
 *
 *  - **`scroll-behavior` + smooth/instant**: we write
 *    `scrollTop = scrollHeight` directly (instant) inside rAF. Per
 *    the research synthesis, smooth-scroll-during-streaming has
 *    well-known iOS Safari quirks (nested-scroller cancellation,
 *    smooth interrupted by next write) and ChatGPT/Claude.ai's
 *    instant pattern via batched writes is what users experience as
 *    "smooth" (the 60Hz rAF coalescing absorbs the per-token shifts).
 *
 *  - **`overflow-anchor: none`** kept on the scroller: Safari has zero
 *    support (WebKit #171099, still open) so we cannot RELY on
 *    anchor-selection cross-browser, but disabling it on Chrome /
 *    Firefox prevents anchor-selection from picking the sticky
 *    approvals bar as the anchor element. We own scrollTop
 *    explicitly.
 *
 *  - **Prepend anchoring (load-more older messages)** stays as a
 *    separate `useLayoutEffect`: when the first message changes
 *    (older page prepended), add `delta = newHeight - oldHeight` to
 *    scrollTop. Structurally orthogonal to stickiness.
 */

/** Within `NEAR_BOTTOM_PX` of the absolute bottom counts as "at bottom"
 *  for auto-sticking. 70px matches use-stick-to-bottom's default —
 *  enough slack to absorb mid-stream height shifts without flicking
 *  state on every delta. */
const NEAR_BOTTOM_PX = 70

/** Minimum touch drag in px before we treat it as an explicit user
 *  release. 24px on iOS filters out finger-drift during a hold without
 *  intent to escape (10px in v1 was reviewer-flagged as too sensitive). */
const TOUCH_DRAG_THRESHOLD_PX = 24

/** After an explicit user release (wheel-up / touch-drag / keyboard),
 *  the IO sentinel refuses to re-engage stickiness for this many
 *  milliseconds. Kills the "wheel inside the 70px slack band → flicker"
 *  race: IO fires async AFTER wheel, would otherwise see "still in
 *  band, re-engage", and the next RO tick yanks the user to bottom. */
const RELEASE_DEBOUNCE_MS = 250

/** Top-sentinel (infinite-scroll-UP / load-more older) — IO `rootMargin`
 *  in px from the top, plus a low `threshold` so partial visibility
 *  triggers the load. */
const TOP_SENTINEL_ROOT_MARGIN_PX = 200
const TOP_SENTINEL_THRESHOLD = 0.1

/** Inline style for elements that must NOT participate in browser
 *  scroll-anchor selection (sentinels + the scroller). Memoised at
 *  module scope so each render reuses the same identity (avoids
 *  React's new-object reconciler shim). */
const NO_OVERFLOW_ANCHOR_STYLE: React.CSSProperties = { overflowAnchor: 'none' }

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
    const scrollRef = useRef<HTMLDivElement>(null)
    /** Inner content; RO observes THIS, not the scroller. Scroller is
     *  layout-bound and rarely changes height; content grows mid-stream. */
    const contentRef = useRef<HTMLDivElement>(null)
    /** 1-px div at the very bottom of the content. The bottom-sentinel
     *  IntersectionObserver watches this to derive `isAtBottom`. */
    const bottomSentinelRef = useRef<HTMLDivElement>(null)
    /** Existing top-sentinel for infinite-scroll-UP. NOT part of
     *  stickiness — separate concern. */
    const topSentinelRef = useRef<HTMLDivElement>(null)

    // ------------------------------------------------------------------
    // Latest-prop refs — mirror parent props into refs inside an effect
    // so observer callbacks (closures captured at observer-creation
    // time) always read fresh values WITHOUT re-creating the observer
    // every render. The prior "assign-during-render" pattern was
    // structurally fine but violated React's "no side effects in
    // render" guideline; this layout-effect version is idiomatic.
    // ------------------------------------------------------------------
    const onLoadMoreRef = useRef(onLoadMore)
    const isFetchingRef = useRef(isFetchingNextPage)
    useEffect(() => {
      onLoadMoreRef.current = onLoadMore
    }, [onLoadMore])
    useEffect(() => {
      isFetchingRef.current = isFetchingNextPage
    }, [isFetchingNextPage])

    // ------------------------------------------------------------------
    // Stick-to-bottom state.
    //
    // Two parallel sources of truth:
    //   - `stickRef`   — synchronous access in observer / event handlers
    //                    (refs don't trigger re-renders).
    //   - `released`   — React state; drives the jump-to-bottom pill UI.
    //
    // They MUST stay in sync. Every write goes through `engageStick()`
    // or `releaseStick()` (each updates both atomically) so they never
    // diverge. Both callbacks are deps-free + stable identity, so the
    // observer / event-listener effects subscribing to them NEVER
    // re-create on prop changes.
    // ------------------------------------------------------------------
    const stickRef = useRef(true)
    const [released, setReleased] = useState(false)
    /** Timestamp (ms) of last explicit user release. IO callback refuses
     *  to re-engage within RELEASE_DEBOUNCE_MS so the wheel-inside-band
     *  race can't flicker us back. */
    const releasedAtRef = useRef(0)
    /** Snapshot of `messages.length` at the moment the user released.
     *  Drives the pill's unread-count badge so users know how many new
     *  messages arrived while they were scrolled away. */
    const releasedAtCountRef = useRef(0)
    const [unreadCount, setUnreadCount] = useState(0)
    /** Coalesces multiple ResizeObserver / segment-append calls into one
     *  DOM write per frame. */
    const rafIdRef = useRef<number | null>(null)
    /** Guards against ResizeObserver-loop ping-pong: when scrollToBottom
     *  writes scrollTop, browsers may fire a follow-up RO callback if
     *  the write changed layout. Without this flag, every late image
     *  load could re-fire the RO chain. */
    const isWritingRef = useRef(false)
    /** Set true when a RO callback bailed because `isWritingRef` was
     *  true (a scroll write was in flight). After `isWritingRef`
     *  clears, the rAF-clear handler retries the scroll once — closes
     *  the rare "image-B loads during the rAF→rAF gap" gap where the
     *  growth signal would otherwise be dropped. */
    const missedScrollRef = useRef(false)
    /** Touch start Y for drag-down detection. */
    const touchStartYRef = useRef(0)

    /** Mutator for the stick state. Keeps `stickRef` (sync access) and
     *  `released` (React state) in lockstep.
     *
     *  Two callbacks, both deps-free + stable identity, so the observer
     *  / event-listener effects that subscribe to them NEVER re-create:
     *
     *  - `engageStick()`   — set stick=true; reset released flag + unread.
     *  - `releaseStick()`  — set stick=false; capture release timestamp
     *                        + count baseline via refs (NOT reading
     *                        `messages.length` from closure — we use a
     *                        latest-prop ref instead so the callback
     *                        stays deps-free).
     *
     *  The prior v2 design had `setStickyState` depend on
     *  `messages.length` to capture the count baseline at release time.
     *  That caused the callback to recreate on every message arrival,
     *  which churned the IO observer / wheel-touch-keydown listeners
     *  every message. v3 reads count from `messagesLengthRef` (mirrored
     *  in a useEffect) — no closure capture, no deps. */
    const messagesLengthRef = useRef(messages.length)
    useEffect(() => {
      messagesLengthRef.current = messages.length
    }, [messages.length])

    const engageStick = useCallback(() => {
      stickRef.current = true
      setReleased(false)
      setUnreadCount(0)
    }, [])

    /** Release stickiness in response to an explicit user gesture
     *  (wheel-up / touch-drag / keyboard-up). Snapshots the release
     *  timestamp + the messages-length baseline (for unread counting)
     *  and resets the visible unread count. The non-user-gesture
     *  "release path" (initial mount) is owned by the default-state
     *  initializers — `stickRef = useRef(true)`, `released =
     *  useState(false)` — so this callback is single-purpose. */
    const releaseStick = useCallback(() => {
      stickRef.current = false
      setReleased(true)
      releasedAtRef.current =
        typeof performance !== 'undefined' ? performance.now() : Date.now()
      // Reset baseline AND unread count. Without resetting unread,
      // a re-release while the pill was visible (user wheel-ups
      // while already released) would leave a stale "N new messages"
      // count with a freshly-zeroed baseline — the displayed number
      // becomes meaningless until the next message arrives.
      releasedAtCountRef.current = messagesLengthRef.current
      setUnreadCount(0)
    }, [])

    // ------------------------------------------------------------------
    // scrollToBottom — rAF-batched, idempotent.
    //
    // Writes `scrollTop = scrollHeight` inside one rAF per frame.
    // Multiple callers in the same frame collapse to one DOM write.
    //
    // `isWritingRef` flips true around the write so a ResizeObserver
    // callback that fires inside the same tick (rare but legal — image
    // load resolving layout) can skip its own write and avoid
    // pong-back oscillation.
    // ------------------------------------------------------------------
    const scrollToBottom = useCallback(() => {
      if (rafIdRef.current !== null) return
      rafIdRef.current = requestAnimationFrame(() => {
        rafIdRef.current = null
        const el = scrollRef.current
        if (!el) return
        isWritingRef.current = true
        el.scrollTop = el.scrollHeight
        // Yield once before clearing the flag so a RO callback fired
        // by the scrollTop-induced layout sees the flag and bails.
        // After the clear: if any RO callback bailed during this
        // write window, retry the scroll ONCE so the dropped growth
        // signal isn't lost forever. The retry recursion bottoms out
        // because the inner rAF won't fire while a new outer rAF is
        // pending (the dedup check at the top of this fn).
        requestAnimationFrame(() => {
          isWritingRef.current = false
          // Retry the dropped scroll AT MOST ONCE per write cycle, AND
          // only if the user is still stuck. The stick gate is the fix
          // for the wheel-up-during-write race: user wheel-ups between
          // the RO bail (T=0) and this clear-rAF (T≈16ms), `stickRef`
          // flips false, and we MUST NOT yank them back to bottom even
          // though `missedScrollRef` is true. The flag is cleared
          // unconditionally so a future stick re-engage doesn't see a
          // stale missed signal from a long-past write cycle.
          const shouldRetry = missedScrollRef.current && stickRef.current
          missedScrollRef.current = false
          if (shouldRetry) scrollToBottom()
        })
      })
    }, [])

    /** Combined "force stick + scroll" — used by dialog change, first
     *  load, and user-sent-message paths. The earlier code repeated
     *  this trio 3× inline; the helper makes intent obvious. */
    const forceStickAndScroll = useCallback(() => {
      engageStick()
      scrollToBottom()
    }, [engageStick, scrollToBottom])

    // ------------------------------------------------------------------
    // IntersectionObserver on the bottom sentinel — single source of
    // truth for at-bottom geometry. Re-engages stickiness when the
    // user scrolls back into the near-bottom band — UNLESS we're
    // inside the RELEASE_DEBOUNCE_MS window, in which case we ignore
    // (kills the wheel-inside-band race).
    // ------------------------------------------------------------------
    useEffect(() => {
      if (!autoScroll) return
      const scrollEl = scrollRef.current
      const sentinelEl = bottomSentinelRef.current
      if (!scrollEl || !sentinelEl) return

      const io = new IntersectionObserver(
        (entries) => {
          const entry = entries[0]
          if (!entry) return
          if (!entry.isIntersecting) return
          // Geometry says "near bottom". Refuse to re-engage if the
          // user just explicitly released — they meant it, even if
          // they were still in the slack band when they did so.
          const now =
            typeof performance !== 'undefined' ? performance.now() : Date.now()
          if (now - releasedAtRef.current < RELEASE_DEBOUNCE_MS) return
          if (!stickRef.current) engageStick()
        },
        {
          root: scrollEl,
          rootMargin: `0px 0px ${NEAR_BOTTOM_PX}px 0px`,
          threshold: 0,
        },
      )
      io.observe(sentinelEl)
      return () => io.disconnect()
    }, [autoScroll, engageStick])

    // ------------------------------------------------------------------
    // ResizeObserver on the inner content — fires whenever content
    // grows (streaming text, markdown mount, ObjectCard mount,
    // ThinkingDisplay expand). Runs for the lifetime of the mount —
    // NO timeout. This is the regression fix.
    // ------------------------------------------------------------------
    useEffect(() => {
      if (!autoScroll) return
      const contentEl = contentRef.current
      if (!contentEl) return

      const ro = new ResizeObserver(() => {
        if (!stickRef.current) return
        // ping-pong guard — see scrollToBottom's `isWritingRef`. On
        // bail, record the missed signal so the rAF-clear handler
        // retries once when the write window ends.
        if (isWritingRef.current) {
          missedScrollRef.current = true
          return
        }
        scrollToBottom()
      })
      // `box: 'border-box'` selects the metric REPORTED to the
      // callback (it does NOT change when the callback fires — that
      // happens on any size change). We don't read the entry's size
      // here so this is purely future-proofing for callers that do.
      ro.observe(contentEl, { box: 'border-box' })
      return () => ro.disconnect()
    }, [autoScroll, scrollToBottom])

    // ------------------------------------------------------------------
    // ResizeObserver on the SCROLLER (not the content). Fires when the
    // scroller's clientHeight changes — e.g., the sticky pending-
    // approvals bar appears below the scroller and shrinks its
    // available height; iOS keyboard open / close; window resize.
    // Without this, streaming text could end up hidden behind the new
    // bar / keyboard because the scroll position is unchanged but the
    // viewport shrunk.
    // ------------------------------------------------------------------
    useEffect(() => {
      if (!autoScroll) return
      const scrollEl = scrollRef.current
      if (!scrollEl) return

      const ro = new ResizeObserver(() => {
        if (!stickRef.current) return
        if (isWritingRef.current) {
          missedScrollRef.current = true
          return
        }
        scrollToBottom()
      })
      ro.observe(scrollEl, { box: 'border-box' })
      return () => ro.disconnect()
    }, [autoScroll, scrollToBottom])

    // ------------------------------------------------------------------
    // visualViewport.resize — iOS keyboard open/close, mobile
    // address-bar collapse. The scroller's `clientHeight` doesn't
    // always change immediately, but the visible region does. Re-snap
    // to bottom when sticky.
    // ------------------------------------------------------------------
    useEffect(() => {
      if (!autoScroll) return
      if (typeof window === 'undefined' || !window.visualViewport) return
      const vv = window.visualViewport

      const onVvResize = () => {
        if (!stickRef.current) return
        // Symmetric with content-RO / scroller-RO bail pattern: if a
        // scroll write is already in flight, defer this signal via
        // `missedScrollRef` so the rAF-clear retry picks it up.
        // Without this, a keyboard-open event that lands during a
        // write window would be silently dropped.
        if (isWritingRef.current) {
          missedScrollRef.current = true
          return
        }
        scrollToBottom()
      }
      vv.addEventListener('resize', onVvResize)
      return () => vv.removeEventListener('resize', onVvResize)
    }, [autoScroll, scrollToBottom])

    // ------------------------------------------------------------------
    // visibilitychange — browsers pause rAF on backgrounded tabs. A
    // scrollToBottom queued before backgrounding will sit in
    // rafIdRef until the tab is foregrounded again. On return-to-
    // visible, drop any stale rAF + re-snap if sticky so the user
    // doesn't see a frozen pre-background scroll position.
    // ------------------------------------------------------------------
    useEffect(() => {
      if (!autoScroll) return
      if (typeof document === 'undefined') return

      const onVisibilityChange = () => {
        if (document.visibilityState !== 'visible') return
        if (rafIdRef.current !== null) {
          cancelAnimationFrame(rafIdRef.current)
          rafIdRef.current = null
        }
        if (stickRef.current) scrollToBottom()
      }
      document.addEventListener('visibilitychange', onVisibilityChange)
      return () => document.removeEventListener('visibilitychange', onVisibilityChange)
    }, [autoScroll, scrollToBottom])

    // ------------------------------------------------------------------
    // Explicit user-escape signals. v1 had two issues the reviewers
    // flagged:
    //   1. `window` keydown listener with `document.body` fallback —
    //      released stick on ANY arrow key from anywhere on the page.
    //      v2: scope keydown to the scroller (`tabIndex={-1}` makes it
    //      focusable), no body fallback.
    //   2. Touch threshold 10px — too sensitive on iOS, momentum
    //      drift could false-positive. v2: 24px + cancelable check
    //      filters momentum-phase events.
    // ------------------------------------------------------------------
    useEffect(() => {
      if (!autoScroll) return
      const el = scrollRef.current
      if (!el) return

      const release = () => releaseStick()

      const onWheel = (e: WheelEvent) => {
        if (e.deltaY < 0) release()
      }
      const onTouchStart = (e: TouchEvent) => {
        const t = e.touches[0]
        if (t) touchStartYRef.current = t.clientY
      }
      const onTouchMove = (e: TouchEvent) => {
        // `cancelable: false` filters iOS momentum-phase events: iOS
        // dispatches non-cancelable touchmove during fling-decel AFTER
        // touchend. Android Chrome doesn't have this distinction
        // (uses synthetic scroll events instead), so the check is a
        // pure iOS guard — harmless cross-browser.
        if (!e.cancelable) return
        const t = e.touches[0]
        if (!t) return
        if (t.clientY > touchStartYRef.current + TOUCH_DRAG_THRESHOLD_PX) release()
      }
      const onKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'ArrowUp' || e.key === 'PageUp' || e.key === 'Home') release()
      }

      el.addEventListener('wheel', onWheel, { passive: true })
      el.addEventListener('touchstart', onTouchStart, { passive: true })
      el.addEventListener('touchmove', onTouchMove, { passive: true })
      // Scoped to the scroller (NOT window) — focus must be inside
      // the scroller (`tabIndex={-1}` makes it programmatically
      // focusable) OR a descendant for keydown to fire here.
      // Prevents arrow keys typed elsewhere on the page (chat input,
      // sidebar, modal) from releasing stickiness.
      el.addEventListener('keydown', onKeyDown)

      return () => {
        el.removeEventListener('wheel', onWheel)
        el.removeEventListener('touchstart', onTouchStart)
        el.removeEventListener('touchmove', onTouchMove)
        el.removeEventListener('keydown', onKeyDown)
      }
    }, [autoScroll, releaseStick])

    // ------------------------------------------------------------------
    // Dialog change / first-load / user-sent-message detection.
    //
    // - Dialog change → reset to sticky, scroll.
    // - 0 → N first messages → reset to sticky, scroll.
    // - ANY new user-role message in the diff (not just last — handles
    //   optimistic + server response landing in the same render) →
    //   force-stick, scroll.
    // - New assistant messages while released → bump unread count for
    //   the pill badge.
    // ------------------------------------------------------------------
    const prevRenderRef = useRef<{
      dialogId: string | undefined
      messageCount: number
      lastMessageId: string | undefined
    }>({ dialogId: undefined, messageCount: 0, lastMessageId: undefined })

    useEffect(() => {
      if (!autoScroll) return
      const el = scrollRef.current
      if (!el) return

      const dialogChanged = dialogId !== prevRenderRef.current.dialogId
      const prevCount = prevRenderRef.current.messageCount
      const newCount = messages.length
      const currentLastId = messages[messages.length - 1]?.id
      prevRenderRef.current = { dialogId, messageCount: newCount, lastMessageId: currentLastId }

      if (dialogChanged) {
        forceStickAndScroll()
        return
      }
      if (newCount > 0 && prevCount === 0) {
        forceStickAndScroll()
        return
      }
      if (newCount > prevCount) {
        // Scan the new tail for any user message — handles the
        // coalesced-render case where optimistic-user + server-
        // assistant land in the same diff (the last message is the
        // assistant, but a user message DID just arrive).
        const newSlice = messages.slice(prevCount)
        const hasNewUser = newSlice.some((m) => m.role === 'user')
        if (hasNewUser) {
          forceStickAndScroll()
          return
        }
        // Assistant-only new messages while released → update pill
        // unread count.
        if (!stickRef.current) {
          setUnreadCount(newCount - releasedAtCountRef.current)
        }
      }
    }, [autoScroll, messages, dialogId, forceStickAndScroll])

    // ------------------------------------------------------------------
    // Prepend anchoring (load-older). Pinning the user's viewport to
    // the same message after older messages prepend. useLayoutEffect
    // so the scrollTop write lands before paint.
    //
    // The snapshot writes are GATED — only when something actually
    // changes — so we don't churn the ref on every render.
    // ------------------------------------------------------------------
    const prependRef = useRef<{
      firstMessageId: string | undefined
      firstMessageContent: unknown
      scrollHeight: number
    }>({ firstMessageId: undefined, firstMessageContent: undefined, scrollHeight: 0 })

    useLayoutEffect(() => {
      const el = scrollRef.current
      if (!el) {
        prependRef.current = { firstMessageId: undefined, firstMessageContent: undefined, scrollHeight: 0 }
        return
      }

      const currentFirstId = messages[0]?.id
      const currentFirstContent = messages[0]?.content
      const prevFirstId = prependRef.current.firstMessageId
      const prevFirstContent = prependRef.current.firstMessageContent
      const prevHeight = prependRef.current.scrollHeight

      const idChanged = currentFirstId !== prevFirstId
      const contentChanged = currentFirstContent !== prevFirstContent

      if (idChanged) {
        // First-id changed → older messages prepended (verified by
        // checking the previous-first is still somewhere in the list
        // at idx > 0). Add the height delta to scrollTop so the user
        // stays on the message they were reading.
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
      // Streaming-edit of a leading message — adjust IF user isn't
      // currently stuck (sticky path owns position when active).
      if (contentChanged && !stickRef.current) {
        if (prevFirstId && prevHeight > 0) {
          const addedHeight = el.scrollHeight - prevHeight
          if (addedHeight > 0) el.scrollTop += addedHeight
        }
      }

      // ALWAYS keep `scrollHeight` snapshot fresh — even on renders
      // where nothing notable changed about the first message. Without
      // this, mid-list streaming (a NEW message appended at the bottom
      // grows scrollHeight) leaves the snapshot stale; a later
      // load-older would over-compute `addedHeight = newHeight -
      // staleHeight` and over-scroll. Updating scrollHeight is cheap
      // (one DOM read) and correctness-critical.
      //
      // The id/content snapshot is gated to ID/content changes above
      // (inside the idChanged branch) so we don't churn those refs on
      // every render.
      prependRef.current.scrollHeight = el.scrollHeight
      if (contentChanged) {
        prependRef.current.firstMessageContent = currentFirstContent
      }
    }, [messages])

    // ------------------------------------------------------------------
    // rAF cleanup. Cancel any pending scroll write on unmount so we
    // don't write to a detached ref.
    // ------------------------------------------------------------------
    useEffect(() => {
      return () => {
        if (rafIdRef.current !== null) {
          cancelAnimationFrame(rafIdRef.current)
          rafIdRef.current = null
        }
      }
    }, [])

    // ------------------------------------------------------------------
    // Infinite-scroll (load older). Top sentinel; orthogonal to
    // stickiness. Single dep on `hasNextPage` — the prior `isLoading`
    // dep was stale (never read inside the effect body, caused
    // unnecessary observer re-subscription).
    // ------------------------------------------------------------------
    useEffect(() => {
      const scrollContainer = scrollRef.current
      const sentinelElement = topSentinelRef.current
      if (!scrollContainer || !sentinelElement || !hasNextPage) return

      const observer = new IntersectionObserver(
        (entries) => {
          const entry = entries[0]
          if (!entry) return
          if (entry.isIntersecting && !isFetchingRef.current) {
            onLoadMoreRef.current?.()
          }
        },
        {
          root: scrollContainer,
          rootMargin: `${TOP_SENTINEL_ROOT_MARGIN_PX}px`,
          threshold: TOP_SENTINEL_THRESHOLD,
        },
      )
      observer.observe(sentinelElement)
      return () => observer.disconnect()
    }, [hasNextPage])

    // useImperativeHandle: stable identity via empty deps. React
    // assigns DOM refs BEFORE `useImperativeHandle`'s commit-phase
    // callback in the same commit (per the docs), so by the time the
    // parent reads `ref.current`, `scrollRef.current` is non-null.
    // The `as HTMLDivElement` cast bridges TS's `HTMLDivElement | null`
    // with the public `forwardRef<HTMLDivElement, …>` generic — type-
    // honest in practice because consumers don't read the handle
    // synchronously during a parent render (chat surfaces only read
    // it from imperative handlers / effects, all of which run after
    // the first commit). The empty deps array means the factory only
    // re-runs on parent rerender + `null`-cast; React still updates
    // `ref.current` on each commit so this is correct.
    useImperativeHandle(ref, () => scrollRef.current as HTMLDivElement, [])

    const onJumpToBottom = useCallback(() => {
      forceStickAndScroll()
    }, [forceStickAndScroll])

    const pillLabel = useMemo(() => {
      if (unreadCount <= 0) return 'Jump to latest'
      if (unreadCount === 1) return '1 new message'
      return `${unreadCount} new messages`
    }, [unreadCount])

    if (isLoading) {
      return (
        <ChatMessageListSkeleton
          className={className}
          showAvatars={showAvatars}
          assistantType={assistantType}
          contentClassName={contentClassName}
          messageCount={6}
        />
      )
    }

    return (
      // Outer column is flex-col but NOT relative — the pill below
      // anchors to the scroller-wrapper's relative box, NOT the outer,
      // so it floats above the scroller's bottom edge and is never
      // obscured by the sticky pending-approvals area (which is a
      // sibling of the scroller-wrapper inside this outer column).
      <div className="flex-1 min-h-0 flex flex-col">
        {/* Scroller wrapper — `relative` here so the absolutely-
            positioned jump-to-bottom pill is bounded by the scroller's
            box, not the outer column's. */}
        <div className="relative flex-1 min-h-0 flex flex-col">
          <div
            ref={scrollRef}
            className={cn(
              "flex h-full w-full flex-col overflow-y-auto overflow-x-hidden flex-1",
              "scrollbar-thin scrollbar-track-transparent scrollbar-thumb-ods-border/30 hover:scrollbar-thumb-ods-text-secondary/30",
              // `tabIndex={-1}` makes the scroller programmatically
              // focusable so the scoped keydown listener receives
              // ArrowUp / PageUp / Home. We render a `focus-visible`
              // ring (NOT plain `:focus`) so keyboard-Tab navigation
              // surfaces the focused scroller without painting a ring
              // on mouse-click focus (which would feel like a visual
              // bug). `ring-inset` keeps the ring inside the scroller
              // edge so it doesn't overlap surrounding chrome.
              "outline-none focus-visible:ring-2 focus-visible:ring-ods-border focus-visible:ring-inset",
              className,
            )}
            style={NO_OVERFLOW_ANCHOR_STYLE}
            tabIndex={-1}
            {...props}
          >
            <div
              ref={contentRef}
              className={cn(
                "mx-auto flex w-full max-w-3xl flex-col pb-2 min-w-0",
                contentClassName || "px-4",
              )}
              style={{ minHeight: '100%' }}
            >
              {hasNextPage && (
                <div ref={topSentinelRef} className="h-px" style={NO_OVERFLOW_ANCHOR_STYLE} />
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
              {/* Bottom sentinel for IntersectionObserver. AFTER every
                  message so its visibility tracks the true bottom of
                  the content. */}
              <div
                ref={bottomSentinelRef}
                aria-hidden="true"
                className="h-px w-full shrink-0"
                style={NO_OVERFLOW_ANCHOR_STYLE}
              />
            </div>
          </div>

          {/* Jump-to-bottom pill — appears when the user has released
              stickiness. Tap re-engages + scrolls. Unread badge counts
              messages that arrived while released.
              - Positioned relative to the SCROLLER-WRAPPER (its
                enclosing `relative`), NOT the outer column, so the
                pill always floats above the scroller's bottom edge
                and is never obscured by the sticky pending-approvals
                bar (which is a sibling of the scroller-wrapper).
              - Tap target: 44px height (Apple HIG / Material 48dp).
              - Fade-in: tailwindcss-animate utility — short 150ms
                slide-up + opacity so the pill doesn't pop suddenly
                into view mid-scroll. */}
          {autoScroll && released && messages.length > 0 && (
            <div
              className={cn(
                "pointer-events-none absolute left-0 right-0 flex justify-center",
                "animate-in fade-in slide-in-from-bottom-1 duration-150",
              )}
              // Respect iOS safe-area-inset-bottom so the pill doesn't
              // sit on top of the home-indicator bar. `max(0.75rem,
              // env(...))` falls back to 12px on non-iOS where the
              // env-var is 0.
              style={{ bottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
            >
              <button
                type="button"
                onClick={onJumpToBottom}
                className={cn(
                  "pointer-events-auto",
                  "inline-flex items-center justify-center gap-1.5",
                  "min-h-[44px] px-4 rounded-full",
                  "bg-ods-card border border-ods-border text-ods-text-primary",
                  "text-sm font-dm-sans font-medium shadow-md",
                  "hover:bg-ods-bg-secondary transition-colors",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ods-border",
                )}
              >
                <span aria-hidden="true" className="text-base leading-none">↓</span>
                <span>{pillLabel}</span>
              </button>
            </div>
          )}
        </div>

        {/* Sticky pending-approvals area — sibling of the scroller-
            wrapper, BELOW it in the outer column. Height changes here
            shrink the scroller's clientHeight, which the scroller-RO
            catches and re-snaps to bottom when sticky. The pill above
            stays anchored to the scroller-wrapper, never overlapping
            this bar. */}
        {pendingApprovals && pendingApprovals.length > 0 && (
          <div
            className={cn(
              "border-t border-ods-border bg-ods-bg/95 backdrop-blur-sm",
              "mx-auto w-full max-w-3xl",
              contentClassName || "px-4",
            )}
          >
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
