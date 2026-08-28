'use client';

import type React from 'react';
import { useState, useCallback, useRef, useEffect } from 'react';

/** Loading skeleton for iframe embeds — clean iframe-sized rectangle.
 *  Uses `bg-ods-card` (visible token) rather than `bg-ods-skeleton`
 *  which resolves to transparent in this build (the same gotcha
 *  documented in `chat-message-row.tsx`'s skeleton). No fake inner
 *  placeholder cruft — a real loading iframe shows a blank rectangle.
 *
 *  Exported so a viewer that is still RESOLVING where its frame points
 *  (ClaudeEmbed probing for a self-hosted mirror, before it has a `src`)
 *  can render the IDENTICAL skeleton through `EmbedViewerFrame`, keeping
 *  every embed's loading state 1:1 with the Figma/Sheets/PDF viewers. */
export function EmbedLoadingSkeleton({ height }: { height?: string }) {
  return (
    <div
      className="w-full animate-pulse overflow-hidden rounded-lg border border-ods-border bg-ods-card"
      style={{ height: height || 'calc(100vh - 250px)' }}
    />
  );
}

export interface EmbedIframeProps {
  /** The URL to embed */
  src: string;
  /** Accessible title for the iframe */
  title: string;
  /** Additional class names for the outer container */
  className?: string;
  /** Container height (CSS value). Defaults to `calc(100vh - 250px)` */
  height?: string;
  /** iframe `allow` attribute */
  allow?: string;
  /** iframe `referrerPolicy` attribute */
  referrerPolicy?: React.IframeHTMLAttributes<HTMLIFrameElement>['referrerPolicy'];
  /** iframe `loading` attribute */
  loading?: 'eager' | 'lazy';
  /** iframe `allowFullScreen` attribute */
  allowFullScreen?: boolean;
  /**
   * iframe `sandbox` attribute. Omitted by default — a first-party vendor
   * (Figma, Google Sheets) is trusted with the full frame contract.
   *
   * Pass it for a frame whose contents are AUTHORED BY USERS: without the
   * attribute an embedded document may navigate the top window, and a sandbox
   * that omits `allow-top-navigation` takes that away. On a CROSS-ORIGIN frame
   * `allow-same-origin` grants the frame its own origin, never the host's.
   */
  sandbox?: string;
}

/**
 * Base iframe wrapper with loading skeleton and proper memory cleanup.
 *
 * Prevents memory leaks by:
 * - Using `key={src}` to force full unmount/remount when src changes
 * - Setting iframe src to about:blank on unmount to release the embedded document
 * - Resetting loaded state when src changes
 */
export function EmbedIframe({
  src,
  title,
  className,
  height,
  allow,
  referrerPolicy,
  loading,
  allowFullScreen,
  sandbox,
}: EmbedIframeProps) {
  // Which src finished loading, rather than a bare "loaded" flag reset from an
  // effect on every src change. Same information, but the reset is implicit:
  // a new `src` simply stops matching, so the skeleton is back on the SAME
  // render that changed the src instead of one commit later — which is exactly
  // the frame that used to show the previous embed under the new src.
  const [loadedSrc, setLoadedSrc] = useState<string | null>(null);
  const isLoaded = loadedSrc === src;
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const handleLoad = useCallback(() => setLoadedSrc(src), [src]);

  useEffect(() => {
    const iframe = iframeRef.current;
    return () => {
      if (iframe) {
        try {
          iframe.src = 'about:blank';
        } catch {
          // Cross-origin iframes may throw — safe to ignore
        }
      }
    };
  }, [src]);

  const resolvedHeight = height || 'calc(100vh - 250px)';

  return (
    <>
      {!isLoaded && <EmbedLoadingSkeleton height={resolvedHeight} />}
      <div
        className={`w-full overflow-hidden rounded-lg border border-ods-border ${!isLoaded ? 'h-0 overflow-hidden' : ''} ${className || ''}`}
        style={isLoaded ? { height: resolvedHeight } : undefined}
      >
        <iframe
          key={src}
          ref={iframeRef}
          src={src}
          className="h-full w-full border-0"
          title={title}
          onLoad={handleLoad}
          allow={allow}
          referrerPolicy={referrerPolicy}
          loading={loading}
          allowFullScreen={allow?.includes('fullscreen') ? undefined : allowFullScreen}
          sandbox={sandbox}
        />
      </div>
    </>
  );
}
