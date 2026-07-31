'use client'

/**
 * <CrossfadePanels> — THE keep-mounted tab-panel stack: every panel stays in
 * the DOM, stacked in the SAME grid cell, and switching is an opacity
 * crossfade. Use it under any tab control (TabNavigation, TabSelector, …)
 * whenever panels are content surfaces where height stability and a soft
 * switch matter (strips, media rails, dashboards-in-view).
 *
 * Invariants encoded HERE exactly once (so no consumer re-derives them):
 * - HEIGHT LOCK: grid items in one cell size the row to max(panel heights) —
 *   switching never shifts the page (no CLS), and surrounding layout treats
 *   the stack as one constant-height block.
 * - FADE-THEN-HIDE: `visibility` transitions alongside `opacity`; per the CSS
 *   transitions spec's special visibility interpolation the outgoing panel
 *   stays paintable until the fade completes, THEN becomes `hidden` — no
 *   pop-out, and the settled hidden panel is fully removed from paint.
 * - DEAD WHILE HIDDEN: `inert` + `aria-hidden` + `pointer-events-none` on
 *   inactive panels — no tab-stops, no screen-reader content, no hover/click
 *   leaks from the invisible layer (WCAG aria-hidden-focus).
 * - MOTION RESPECT: `prefers-reduced-motion` collapses the fade to an
 *   instant swap.
 * - The ACTIVE panel takes `z-[1]` so the incoming layer composites on top
 *   during the crossfade regardless of DOM order.
 *
 * This deliberately complements (not replaces) <TabContent>, which MOUNTS one
 * panel at a time — right for heavy admin surfaces that should unmount when
 * hidden. CrossfadePanels is for surfaces whose panels are cheap enough to
 * keep alive and whose switch must be seamless.
 *
 * NOTE for marquee/animated panel content: hidden panels stay mounted and
 * their animations keep running unless the content self-pauses. CardsStrip
 * panels are fine (its rAF gates on near-viewport + visibility), but a
 * consumer embedding heavier always-on content should pause it via its own
 * visibility signal.
 */

import React from 'react'
import { cn } from '../../utils/cn'

export interface CrossfadePanel {
  id: string
  content: React.ReactNode
}

export interface CrossfadePanelsProps {
  /** Which panel is shown. Unknown id → all panels hidden (renders the
   *  stack's reserved height, nothing visible). */
  activeId: string | undefined
  panels: ReadonlyArray<CrossfadePanel>
  /** Crossfade duration in ms. Default 300. */
  durationMs?: number
  className?: string
  /** Extra classes for every panel wrapper (e.g. `min-w-0` is built in). */
  panelClassName?: string
}

export function CrossfadePanels({
  activeId,
  panels,
  durationMs = 300,
  className,
  panelClassName,
}: CrossfadePanelsProps) {
  if (panels.length === 0) return null
  return (
    <div className={cn('grid w-full', className)}>
      {panels.map(p => {
        const active = p.id === activeId
        return (
          <div
            key={p.id}
            className={cn(
              'col-start-1 row-start-1 min-w-0 transition-[opacity,visibility] ease-out motion-reduce:transition-none',
              active ? 'visible opacity-100 z-[1]' : 'invisible opacity-0 pointer-events-none',
              panelClassName,
            )}
            style={{ transitionDuration: `${durationMs}ms` }}
            aria-hidden={!active || undefined}
            inert={!active || undefined}
          >
            {p.content}
          </div>
        )
      })}
    </div>
  )
}
