'use client'

import * as React from 'react'
import { cn } from '../../utils/cn'
import { MingoIcon } from '../icons'
import { Tag } from '../ui/tag'
import { ActionsMenuDropdown } from '../ui/actions-menu'
import { Ellipsis01Icon } from '../icons-v2-generated'

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
  /** Greeting sub-line. Defaults to the OpenFrame temporary-session copy. */
  subtitle?: React.ReactNode
  /** Quick-action chips — caller-provided; there are no built-in defaults, so
   *  the chip row is omitted entirely unless the host supplies actions. The
   *  first `maxVisibleQuickActions` render inline; the rest collapse under a
   *  trailing "⋯" overflow menu. */
  quickActions?: ReadonlyArray<GuideQuickAction>
  /** How many chips to show inline before overflowing to the menu (default 3). */
  maxVisibleQuickActions?: number
  /** Fired when a quick-action chip (inline or menu) is activated. */
  onQuickAction?: (action: GuideQuickAction) => void
  /** Slash-command onboarding list — rendered inside the shared scroll region
   *  below the greeting (so greeting + list scroll together, with edge fades). */
  children?: React.ReactNode
  className?: string
}

// =============================================================================
// Defaults (OpenFrame copy — overridable; the kit stays platform-agnostic)
// =============================================================================

const DEFAULT_TITLE = 'Guide Mode Chat'

const DEFAULT_SUBTITLE =
  'This chat is temporary and will not be saved. Ask about OpenFrame docs, ' +
  'known issues, or manage your support tickets right here.'

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
  subtitle = DEFAULT_SUBTITLE,
  quickActions = [],
  maxVisibleQuickActions = 3,
  onQuickAction,
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

  const visibleActions = quickActions.slice(0, maxVisibleQuickActions)
  const overflowActions = quickActions.slice(maxVisibleQuickActions)

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
          {/* Greeting grows to fill (`flex-1`) so it centres vertically while
              the list stays anchored below it. */}
          <div className="flex flex-1 flex-col items-center justify-center gap-[var(--spacing-system-l)] px-[var(--spacing-system-l)] py-[var(--spacing-system-xxl)] text-center">
            <MingoIcon
              className="h-12 w-12"
              color="white"
              eyesColor="var(--ods-flamingo-cyan-base)"
              cornerColor="var(--ods-flamingo-cyan-base)"
            />
            <div className="flex w-full flex-col gap-1">
              <p className="text-h4 text-ods-text-primary">{title}</p>
              <p className="text-h6 text-ods-text-secondary">{subtitle}</p>
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

      {/* Pinned quick-action chips — always visible above the composer. */}
      {quickActions.length > 0 && (
        <div className="flex shrink-0 flex-wrap items-center gap-1">
          {visibleActions.map((action) => (
            <button
              key={action.id}
              type="button"
              onClick={() => onQuickAction?.(action)}
              className="rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-ods-accent"
            >
              <Tag variant="outline" label={action.label} />
            </button>
          ))}
          {overflowActions.length > 0 && (
            <ActionsMenuDropdown
              triggerAriaLabel="More quick actions"
              onCloseAutoFocus={(e) => e.preventDefault()}
              groups={[{
                items: overflowActions.map((action) => ({
                  id: action.id,
                  label: action.label,
                  onClick: () => onQuickAction?.(action),
                })),
              }]}
              customTrigger={
                <button
                  type="button"
                  aria-label="More quick actions"
                  className="rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-ods-accent"
                >
                  <Tag variant="outline" label={<Ellipsis01Icon size={16} />} />
                </button>
              }
            />
          )}
        </div>
      )}
    </div>
  )
}
