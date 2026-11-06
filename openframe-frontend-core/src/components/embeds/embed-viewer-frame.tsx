'use client';

import { Maximize2, Minimize2 } from 'lucide-react';
import type React from 'react';
import { useEffect, useRef, useState } from 'react';
import { cn } from '../../utils/cn';
import { FullscreenSwitchController } from '../../utils/fullscreen-switch';
import { InteractiveSkeleton, TextLineSkeleton } from '../loading/unified-skeleton';
import { Button } from '../ui/button/button';
import { useLoadingScope } from '../ui/loading-scope';
import { EmbedIframe, EmbedLoadingSkeleton } from './embed-iframe';

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
  icon: React.ReactNode;
  title: string;
  /** `h3` = `h2.text-h3` (sheets/pdf, default); `h6` = `span.text-h6 font-semibold` (figma). */
  titleVariant?: 'h3' | 'h6';
  /** Rendered verbatim in the header row — the caller owns its own container/state. */
  actions?: React.ReactNode;
  /** Iframe source; falsy renders the inline empty state (or the loading
   *  state when `loading` or `resolving`) under the header. */
  src: string | null | undefined;
  /** The document is being read (the standard `loading` prop; a loading scope does the same): the whole frame is its
   *  loading form, a skeleton title, its buttons' loading forms and the frame's loading box. */
  loading?: boolean;
  /** The document is known (its title shows) but the viewer is still finding where its frame points (ClaudeEmbed
   *  probing for a self-hosted mirror): only the body is its loading box. */
  resolving?: boolean;
  /** Large icon for the inline empty state (the viewers pass `w-16 h-16`). */
  emptyIcon?: React.ReactNode;
  emptyMessage?: string;
  height?: string;
  allow?: string;
  allowFullScreen?: boolean;
  /** iframe loading strategy (eager or lazy). */
  iframeLoading?: 'eager' | 'lazy';
  /** iframe `sandbox` — see `EmbedIframe`. Set it for user-authored contents. */
  sandbox?: string;
  /** Wrapper classes; defaults to the sheets/pdf `space-y-4`. */
  className?: string;
  /** Opt-in fullscreen toggle in the header row (rendered after `actions`,
   *  only when there is a `src`). Fullscreens the WHOLE frame — header
   *  included — so the exit control stays reachable (Esc works too).
   *  Exists because some embedded contents ship their own fullscreen
   *  button (the Figma player) and some cannot (a self-hosted Claude
   *  artifact mirror) — the shell provides the affordance uniformly. */
  fullscreenControl?: boolean;
  /** How many buttons `actions` draws (PDF: Preview and Download): the header's loading form draws as many. Default 1. */
  loadingActionCount?: number;
}

/** The buttons the header's loading form draws when the viewer states none: one action. */
const EMBED_ACTIONS_SKELETON_COUNT = 1;

export function EmbedViewerFrame({
  icon,
  title,
  titleVariant = 'h3',
  actions,
  src,
  loading: loadingGiven = false,
  resolving = false,
  emptyIcon,
  emptyMessage = 'Content not available',
  height,
  allow,
  allowFullScreen,
  iframeLoading,
  sandbox,
  className,
  fullscreenControl,
  loadingActionCount = EMBED_ACTIONS_SKELETON_COUNT,
}: EmbedViewerFrameProps) {
  // ONE switch for the whole frame (header included): a page's loading scope, or the standard `loading` prop. The body
  // alone also waits while the viewer resolves where its frame points.
  const loadingForm = useLoadingScope() || loadingGiven;
  const isLoading = loadingForm || resolving;
  const frameRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // ONE fullscreen implementation across the library and its hosts:
  // `FullscreenSwitchController` (shared with the hub's deck) owns the
  // Fullscreen API calls, webkit fallbacks, rejection safety, and the
  // change-event-driven state — Esc, F11, buttons and browser chrome all
  // converge on its listener, so the icon can never desync. Here it runs
  // element-level (`target` = this frame; no mask classes — the frame
  // styles off its own state).
  const controllerRef = useRef<FullscreenSwitchController | null>(null);
  useEffect(() => {
    if (!fullscreenControl) return undefined;
    const controller = new FullscreenSwitchController({
      target: () => frameRef.current,
      onFullscreenChange: setIsFullscreen,
    });
    controllerRef.current = controller;
    controller.attach();
    return () => {
      controllerRef.current = null;
      controller.detach();
    };
  }, [fullscreenControl]);
  const toggleFullscreen = () => controllerRef.current?.toggle();

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
      <div className="flex flex-col gap-3 content-sm:flex-row content-sm:items-center content-sm:justify-between">
        <div className="flex min-w-0 items-center gap-2">
          {icon}
          {loadingForm ? (
            // The document is being read: its name is not known yet. (A viewer still resolving its frame, with a
            // known title, keeps it.)
            <TextLineSkeleton type={titleVariant} className="w-48 max-w-full" />
          ) : titleVariant === 'h3' ? (
            <h2 className="truncate text-ods-text-primary text-h3">{title}</h2>
          ) : (
            <span className="truncate font-semibold text-ods-text-primary text-h6">{title}</span>
          )}
        </div>
        {/* Same responsive action-row idiom as the PDF viewer's button pair
            and every viewer's own action: full-width stacked on mobile,
            inline row from `sm:` up, SAME Button idiom (outline /
            small-legacy / w-4 icon / w-full content-sm:w-auto). Without the
            fullscreen toggle, `actions` renders EXACTLY as before — the
            wrapper exists only when the toggle joins it, so pre-existing
            viewers (figma/pdf/sheets) are byte-identical. */}
        {loadingForm ? (
          // The actions point at the document being read: each its button's loading form, in the actions' row.
          <div className="flex w-full items-center gap-2 content-sm:w-auto">
            {Array.from({ length: loadingActionCount }, (_, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: loading buttons never reorder
              <InteractiveSkeleton.Button
                key={i}
                data-loading-item
                size="small-legacy"
                className="flex-1 content-sm:flex-initial"
              />
            ))}
          </div>
        ) : fullscreenControl && src ? (
          <div className="flex flex-col gap-[var(--spacing-system-xsf)] content-sm:flex-row content-sm:items-center">
            {actions}
            <Button
              variant="outline"
              size="small-legacy"
              onClick={toggleFullscreen}
              aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
              leftIcon={isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
              className="w-full content-sm:w-auto"
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
          iframeLoading={iframeLoading}
          sandbox={sandbox}
        />
      ) : isLoading ? (
        // The EXACT skeleton every embed shows while its iframe loads
        // (`EmbedIframe`'s `EmbedLoadingSkeleton`) — so a viewer still
        // RESOLVING where its frame points (ClaudeEmbed probing for a mirror,
        // before it has a `src`) reads 1:1 with the Figma/Sheets/PDF loading
        // state, then settles into the iframe in place.
        <EmbedLoadingSkeleton height={height} />
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
  );
}
