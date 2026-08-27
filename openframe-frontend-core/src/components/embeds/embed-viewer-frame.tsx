'use client'

import React, { useEffect, useRef, useState } from 'react'
import { Loader2, Maximize2, Minimize2 } from 'lucide-react'
import { cn } from '../../utils/cn'
import { FullscreenSwitchController } from '../../utils/fullscreen-switch'
import { Button } from '../ui/button/button'
import { EmbedIframe } from './embed-iframe'

/**
 * EmbedViewerFrame — the ONE viewer shell shared by every embed viewer
 * (Google Sheets / PDF / Figma): header row (icon + title + caller-supplied
 * actions) over an `EmbedIframe`, with an inline empty state when there is no
 * `src`.
 *
 * Extraction rules (output parity with the three pre-existing viewers is the
 * merge gate — every knob below exists because the shells were NOT byte-
 * identical):
 *   - `titleVariant`: sheets/pdf render `h2.text-h3`; figma renders
 *     `span.text-h6 font-semibold`.
 *   - `actions` is rendered AS-IS in the header row — each viewer owns its
 *     action container (pdf wraps two buttons, figma wraps a stateful
 *     ToggleGroup + button). State lives in the CALLER (figma's present/
 *     browse toggle keeps its `useState` in `FigmaEmbed`), so the slot is a
 *     plain ReactNode and re-renders flow through normally.
 *   - `className` overrides the wrapper (figma uses `my-6 space-y-3`).
 *   - Empty body (`src` falsy) keeps the header visible (figma's behavior).
 *     Viewers that historically rendered a standalone empty state WITHOUT a
 *     header (sheets/pdf with no URL at all) early-return before mounting
 *     the frame.
 */
export interface EmbedViewerFrameProps {
  /** Header icon, already sized by the caller (the viewers pass `w-5 h-5`). */
  icon: React.ReactNode
  title: string
  /** `h3` = `h2.text-h3` (sheets/pdf, default); `h6` = `span.text-h6 font-semibold` (figma). */
  titleVariant?: 'h3' | 'h6'
  /** Rendered verbatim in the header row — the caller owns its own container/state. */
  actions?: React.ReactNode
  /** Iframe source; falsy renders the inline empty state (or the loading
   *  state when `isLoading`) under the header. */
  src: string | null | undefined
  /** While true AND there is no `src` yet, the body shows a loading skeleton
   *  instead of the empty state — for a viewer that is still resolving where
   *  its frame points (e.g. ClaudeEmbed probing for a self-hosted mirror),
   *  so a cold first view reads as "loading", not "nothing here". */
  isLoading?: boolean
  /** Large icon for the inline empty state (the viewers pass `w-16 h-16`). */
  emptyIcon?: React.ReactNode
  emptyMessage?: string
  /** Copy under the spinner in the loading state. */
  loadingMessage?: string
  height?: string
  allow?: string
  allowFullScreen?: boolean
  loading?: 'eager' | 'lazy'
  /** iframe `sandbox` — see `EmbedIframe`. Set it for user-authored contents. */
  sandbox?: string
  /** Wrapper classes; defaults to the sheets/pdf `space-y-4`. */
  className?: string
  /** Opt-in fullscreen toggle in the header row (rendered after `actions`,
   *  only when there is a `src`). Fullscreens the WHOLE frame — header
   *  included — so the exit control stays reachable (Esc works too).
   *  Exists because some embedded contents ship their own fullscreen
   *  button (the Figma player) and some cannot (a self-hosted Claude
   *  artifact mirror) — the shell provides the affordance uniformly. */
  fullscreenControl?: boolean
}

export function EmbedViewerFrame({
  icon,
  title,
  titleVariant = 'h3',
  actions,
  src,
  isLoading,
  emptyIcon,
  emptyMessage = 'Content not available',
  loadingMessage = 'Loading…',
  height,
  allow,
  allowFullScreen,
  loading,
  sandbox,
  className,
  fullscreenControl,
}: EmbedViewerFrameProps) {
  const frameRef = useRef<HTMLDivElement>(null)
  const [isFullscreen, setIsFullscreen] = useState(false)

  // ONE fullscreen implementation across the library and its hosts:
  // `FullscreenSwitchController` (shared with the hub's deck) owns the
  // Fullscreen API calls, webkit fallbacks, rejection safety, and the
  // change-event-driven state — Esc, F11, buttons and browser chrome all
  // converge on its listener, so the icon can never desync. Here it runs
  // element-level (`target` = this frame; no mask classes — the frame
  // styles off its own state).
  const controllerRef = useRef<FullscreenSwitchController | null>(null)
  useEffect(() => {
    if (!fullscreenControl) return
    const controller = new FullscreenSwitchController({
      target: () => frameRef.current,
      onFullscreenChange: setIsFullscreen,
    })
    controllerRef.current = controller
    controller.attach()
    return () => {
      controllerRef.current = null
      controller.detach()
    }
  }, [fullscreenControl])
  const toggleFullscreen = () => controllerRef.current?.toggle()

  return (
    <div
      ref={frameRef}
      className={cn(
        'space-y-[var(--spacing-system-mf)]',
        className,
        // Fullscreen paints its own ground (the fullscreened element
        // otherwise sits on the UA's black backdrop) and scrolls itself.
        isFullscreen && 'overflow-auto bg-ods-bg p-[var(--spacing-system-mf)]',
      )}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2 min-w-0">
          {icon}
          {titleVariant === 'h3' ? (
            <h2 className="text-h3 text-ods-text-primary truncate">{title}</h2>
          ) : (
            <span className="text-h6 font-semibold text-ods-text-primary truncate">{title}</span>
          )}
        </div>
        {/* Same responsive action-row idiom as the PDF viewer's button pair
            and every viewer's own action: full-width stacked on mobile,
            inline row from `sm:` up, SAME Button idiom (outline /
            small-legacy / w-4 icon / w-full sm:w-auto). Without the
            fullscreen toggle, `actions` renders EXACTLY as before — the
            wrapper exists only when the toggle joins it, so pre-existing
            viewers (figma/pdf/sheets) are byte-identical. */}
        {fullscreenControl && src ? (
          <div className="flex flex-col gap-[var(--spacing-system-xsf)] sm:flex-row sm:items-center">
            {actions}
            <Button
              variant="outline"
              size="small-legacy"
              onClick={toggleFullscreen}
              aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
              leftIcon={isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
              className="w-full sm:w-auto"
            >
              {isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
            </Button>
          </div>
        ) : (
          actions
        )}
      </div>
      {src ? (
        <EmbedIframe
          src={src}
          title={title}
          // 96px = the fullscreen wrapper's own chrome above the iframe:
          // header row (~40px incl. its gap) + the wrapper's mf padding
          // (16px × 2) + the mf space-y gap (16px), rounded up so the
          // frame never forces a scrollbar. Recheck if that chrome changes.
          height={isFullscreen ? 'calc(100vh - 96px)' : height}
          allow={allow}
          allowFullScreen={allowFullScreen}
          loading={loading}
          sandbox={sandbox}
        />
      ) : isLoading ? (
        // SAME box as the empty/iframe state (height + border), so a viewer
        // resolving its frame doesn't collapse then jump — it reads as
        // "loading" and settles into the iframe in place.
        <div
          className="flex flex-col items-center justify-center gap-3 rounded-lg border border-ods-border px-4 py-16 text-center"
          style={height ? { height } : undefined}
        >
          {/* The library's canonical section spinner — `Loader2` +
              `animate-spin` is the only spinner idiom in the codebase (17
              lib call sites, 67 in the hub), and `h-8 w-8 … text-ods-accent`
              is its most-used full-size variant. */}
          <Loader2 className="h-8 w-8 animate-spin text-ods-accent" />
          <p className="text-ods-text-secondary">{loadingMessage}</p>
        </div>
      ) : (
        // The SAME box the iframe would have filled: same height, same rounded
        // border. A viewer whose content is missing must not collapse the page
        // around it — two embeds side by side (a figma frame and a claude link
        // that has no embeddable view) have to read as two equal blocks.
        // Without a `height` the caller never asked for a fixed box, so the
        // intrinsic `py-16` stands.
        <div
          className="flex flex-col items-center justify-center rounded-lg border border-ods-border px-4 py-16 text-center"
          style={height ? { height } : undefined}
        >
          {emptyIcon}
          <p className="text-ods-text-secondary">{emptyMessage}</p>
        </div>
      )}
    </div>
  )
}
