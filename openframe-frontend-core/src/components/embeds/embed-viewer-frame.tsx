'use client';

import type React from 'react';
import { cn } from '../../utils/cn';
import { EmbedIframe } from './embed-iframe';

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
  /** Iframe source; falsy renders the inline empty state under the header. */
  src: string | null | undefined;
  /** Large icon for the inline empty state (the viewers pass `w-16 h-16`). */
  emptyIcon?: React.ReactNode;
  emptyMessage?: string;
  height?: string;
  allow?: string;
  allowFullScreen?: boolean;
  loading?: 'eager' | 'lazy';
  /** iframe `sandbox` — see `EmbedIframe`. Set it for user-authored contents. */
  sandbox?: string;
  /** Wrapper classes; defaults to the sheets/pdf `space-y-4`. */
  className?: string;
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
}: EmbedViewerFrameProps) {
  return (
    <div className={cn('space-y-4', className)}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-2">
          {icon}
          {titleVariant === 'h3' ? (
            <h2 className="truncate text-ods-text-primary text-h3">{title}</h2>
          ) : (
            <span className="truncate font-semibold text-ods-text-primary text-h6">{title}</span>
          )}
        </div>
        {actions}
      </div>
      {src ? (
        <EmbedIframe
          src={src}
          title={title}
          height={height}
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
  );
}
