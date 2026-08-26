'use client'

import React, { useCallback, useEffect, useRef, useState } from 'react'
import { Maximize2, Minimize2 } from 'lucide-react'
import { cn } from '../../utils/cn'
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
  /** Iframe source; falsy renders the inline empty state under the header. */
  src: string | null | undefined
  /** Large icon for the inline empty state (the viewers pass `w-16 h-16`). */
  emptyIcon?: React.ReactNode
  emptyMessage?: string
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
  emptyIcon,
  emptyMessage = 'Content not available',
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

  // Track the DOCUMENT's fullscreen element rather than local intent —
  // Esc, F11, and programmatic exits all land here, so the icon can
  // never desync from reality.
  useEffect(() => {
    if (!fullscreenControl) return
    const onChange = () => setIsFullscreen(document.fullscreenElement === frameRef.current)
    document.addEventListener('fullscreenchange', onChange)
    return () => document.removeEventListener('fullscreenchange', onChange)
  }, [fullscreenControl])

  const toggleFullscreen = useCallback(() => {
    const el = frameRef.current
    if (!el) return
    // Denials arrive BOTH ways: `requestFullscreen` throws synchronously
    // on some engines and returns a REJECTED promise on others (e.g. the
    // Fullscreen permissions policy when this component is itself inside
    // an embedder's iframe without `allow="fullscreen"`). Swallow both —
    // the button is a convenience; an unhandled rejection is not.
    try {
      if (document.fullscreenElement === el) {
        document.exitFullscreen().catch(() => {})
      } else {
        el.requestFullscreen().catch(() => {})
      }
    } catch {
      // Fullscreen API unavailable (old WebKit) — fail silently.
    }
  }, [])

  return (
    <div
      ref={frameRef}
      className={cn(
        'space-y-4',
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
          height={isFullscreen ? 'calc(100vh - 96px)' : height}
          allow={allow}
          allowFullScreen={allowFullScreen}
          loading={loading}
          sandbox={sandbox}
        />
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
