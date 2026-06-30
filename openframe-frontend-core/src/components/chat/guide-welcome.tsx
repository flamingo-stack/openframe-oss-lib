'use client'

import * as React from 'react'
import { cn } from '../../utils/cn'
import { MingoIcon } from '../icons'
import { Skeleton } from '../ui/skeleton'
import { ChatQuickActionRow } from './chat-quick-action-row'

// =============================================================================
// Types
// =============================================================================

/** A guide quick-action chip (e.g. "How to start"). */
export interface GuideQuickAction {
  /** Stable React key. */
  id: string
  /** Chip label. */
  label: string
  /** Prompt text seeded into the composer on click. Defaults to `label`. */
  prompt?: string
}

export interface GuideWelcomeProps {
  /** Greeting heading. Defaults to "Guide Mode Chat". */
  title?: React.ReactNode
  /** Greeting sub-line. No built-in default — when omitted/empty the sub-line
   *  is not rendered, so the empty state shows only the title. Set via the
   *  admin `emptyStateGreeting` (or a host override). */
  subtitle?: React.ReactNode
  /** While the admin greeting is still being fetched, render a one-line
   *  subtitle skeleton instead of flashing empty → text. Ignored once a
   *  `subtitle` is present. */
  subtitleLoading?: boolean
  /** Quick-action chips — caller-provided; there are no built-in defaults, so
   *  the chip row is omitted entirely unless the host supplies actions. ALL
   *  chips render in a wrapping row (no "⋯" overflow collapse) so every action
   *  is directly hoverable — hover/focus previews the action's full `prompt` in
   *  the composer; click sends it. */
  quickActions?: ReadonlyArray<GuideQuickAction>
  /** Fired when a quick-action chip is activated (click). */
  onQuickAction?: (action: GuideQuickAction) => void
  /** Pointer/keyboard focus enters a quick-action chip — e.g. preview the
   *  action's full `prompt` in the composer input. */
  onQuickActionHover?: (action: GuideQuickAction) => void
  /** Pointer/keyboard focus leaves the chip — e.g. restore the composer. */
  onQuickActionHoverEnd?: () => void
  /** Slash-command onboarding list — rendered inside the shared scroll region
   *  below the greeting (so greeting + list scroll together, with edge fades). */
  children?: React.ReactNode
  className?: string
}

// =============================================================================
// Defaults (OpenFrame copy — overridable; the kit stays platform-agnostic)
// =============================================================================

const DEFAULT_TITLE = 'Guide Mode Chat'

// =============================================================================
// Component
// =============================================================================

/**
 * GuideWelcome — Figma node `7532:328214`.
 *
 * Guide-mode chat empty state: a centred greeting and the slash-command
 * onboarding list share one scroll region (with top/bottom fade affordances),
 * and a pinned quick-action chip row sits above the composer. The first few
 * quick actions render as chips; the remainder collapse under a "⋯" menu.
 *
 * Mirrors `MingoWelcome` (the default-mode empty state) — content is
 * configurable with OpenFrame defaults.
 */
export function GuideWelcome({
  title = DEFAULT_TITLE,
  subtitle,
  subtitleLoading = false,
  quickActions = [],
  onQuickAction,
  onQuickActionHover,
  onQuickActionHoverEnd,
  children,
  className,
}: GuideWelcomeProps) {
  // Scroll-fade affordances: a 48px gradient at the top/bottom edge of the
  // scroll region, shown only while content is actually hidden in that
  // direction. (Same behaviour as MingoWelcome.)
  const scrollRef = React.useRef<HTMLDivElement>(null)
  const [scrollFade, setScrollFade] = React.useState({ top: false, bottom: false })
  const updateScrollFade = React.useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    const top = el.scrollTop > 1
    const bottom = el.scrollTop + el.clientHeight < el.scrollHeight - 1
    setScrollFade((prev) =>
      prev.top === top && prev.bottom === bottom ? prev : { top, bottom },
    )
  }, [])
  React.useEffect(() => {
    updateScrollFade()
    const el = scrollRef.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(updateScrollFade)
    ro.observe(el)
    return () => ro.disconnect()
  }, [updateScrollFade])

  // Map to the shared `ChatQuickActionRow` chip shape. In `wrap` mode every chip
  // renders (no overflow), and `onHoverStart`/`onHoverEnd` drive the composer
  // prompt preview.
  const chipItems = React.useMemo(
    () =>
      quickActions.map((action) => ({
        id: action.id,
        label: action.label,
        onSelect: () => onQuickAction?.(action),
        onHoverStart: () => onQuickActionHover?.(action),
        onHoverEnd: () => onQuickActionHoverEnd?.(),
      })),
    [quickActions, onQuickAction, onQuickActionHover, onQuickActionHoverEnd],
  )

  return (
    <div
      className={cn(
        'flex flex-1 min-h-0 flex-col gap-[var(--spacing-system-m)]',
        className,
      )}
    >
      {/* Greeting + slash-command list share one scroll region; `relative` so
          the edge fades can overlay it. */}
      <div className="relative flex flex-1 min-h-0 flex-col">
        <div
          ref={scrollRef}
          onScroll={updateScrollFade}
          className="flex flex-1 min-h-0 flex-col gap-[var(--spacing-system-m)] overflow-y-auto"
        >
          {/* Greeting grows to fill (`flex-1`) so the slash-command list stays
              anchored below it — but its content is anchored at the TOP of the
              grown block (no `justify-center`). Vertical-centering the content
              would re-position the icon/title every time the children's height
              changed (e.g. the chip-catalog skeleton → real cards swap: the
              skeleton renders a fixed 6 rows but the resolved list is whatever
              the admin configured — 14 on the hub today). Whichever direction
              the delta runs, a centered greeting jumps by half the delta on
              load. Top-anchoring keeps the icon and title at the same
              scroll-viewport-top position regardless of the list height
              beneath them. */}
          <div className="flex flex-1 flex-col items-center gap-[var(--spacing-system-l)] px-[var(--spacing-system-l)] py-[var(--spacing-system-xxl)] text-center">
            <MingoIcon
              className="h-12 w-12"
              color="white"
              eyesColor="var(--ods-flamingo-cyan-base)"
              cornerColor="var(--ods-flamingo-cyan-base)"
            />
            <div className="flex w-full flex-col gap-1">
              <p className="text-h4 text-ods-text-primary">{title}</p>
              {/* Sub-line: while the greeting is still being fetched show a
                  one-line skeleton; once settled, render the greeting (admin
                  copy / host override) or nothing — no built-in default, so by
                  default the empty state shows the title alone. */}
              {subtitle ? (
                <p className="text-h6 text-ods-text-secondary">{subtitle}</p>
              ) : subtitleLoading ? (
                <div className="flex w-full justify-center">
                  <Skeleton className="h-4 w-3/4 max-w-80 rounded-sm" />
                </div>
              ) : null}
            </div>
          </div>

          {children}
        </div>

        {/* Top scroll-fade — visible only when content is hidden above. */}
        <div
          aria-hidden
          className={cn(
            'pointer-events-none absolute inset-x-0 top-0 h-12 transition-opacity duration-150',
            scrollFade.top ? 'opacity-100' : 'opacity-0',
          )}
          style={{
            background:
              'linear-gradient(0deg, transparent 0%, var(--color-bg) 100%)',
          }}
        />
        {/* Bottom scroll-fade — visible only when content is hidden below. */}
        <div
          aria-hidden
          className={cn(
            'pointer-events-none absolute inset-x-0 bottom-0 h-12 transition-opacity duration-150',
            scrollFade.bottom ? 'opacity-100' : 'opacity-0',
          )}
          style={{
            background:
              'linear-gradient(180deg, transparent 0%, var(--color-bg) 100%)',
          }}
        />
      </div>

      {/* Pinned quick-action chips above the composer — the shared
          `ChatQuickActionRow` in `wrap` mode: ALL chips render (no "⋯" overflow
          collapse) so every action is directly hoverable; hover/focus previews
          the action's full prompt in the composer, click sends it. */}
      {quickActions.length > 0 && <ChatQuickActionRow wrap chips={chipItems} />}
    </div>
  )
}
