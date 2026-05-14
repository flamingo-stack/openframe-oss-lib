"use client";

import React, { useRef, useState } from 'react';

/**
 * YouTube facade (lite-youtube-embed pattern). Renders poster + play
 * button until clicked; on click, a real `<iframe>` is created via
 * `document.createElement` synchronously so the user-activation chain
 * holds and `autoplay=1` plays on Chrome / Safari / Firefox.
 *
 * Uses `youtube-nocookie.com` (GDPR-friendly) and `mqdefault` posters
 * (`maxresdefault` returns a gray 200 placeholder when missing, which
 * defeats `onError` fallback).
 */

interface YouTubeEmbedProps {
  videoId: string;
  title?: string;
  className?: string;
  showTitle?: boolean;
  showMeta?: boolean;
  minimalControls?: boolean;
  /** When true, the poster img gets `fetchpriority="high"` for LCP. Default false (below-the-fold). */
  aboveTheFold?: boolean;
}

export const YouTubeEmbed: React.FC<YouTubeEmbedProps> = ({
  videoId,
  title = 'YouTube Video',
  className = '',
  showTitle = true,
  showMeta = true,
  minimalControls = false,
  aboveTheFold = false,
}) => {
  const [activated, setActivated] = useState(false);
  const iframeSlotRef = useRef<HTMLDivElement | null>(null);

  const embedParams = new URLSearchParams({ autoplay: '1', rel: '0', modestbranding: '1', playsinline: '1' });
  if (minimalControls) {
    embedParams.set('controls', '0');
    embedParams.set('showinfo', '0');
    embedParams.set('fs', '0');
    embedParams.set('iv_load_policy', '3');
    embedParams.set('cc_load_policy', '0');
    embedParams.set('disablekb', '1');
  }
  const embedUrl = `https://www.youtube-nocookie.com/embed/${videoId}?${embedParams.toString()}`;
  const watchUrl = `https://www.youtube.com/watch?v=${videoId}`;
  const posterJpg = `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`;
  const posterWebp = `https://i.ytimg.com/vi_webp/${videoId}/mqdefault.webp`;

  // `iframeSlotRef` is a JSX-empty div React owns but never reconciles
  // children into; the `<button>` overlay is a SIBLING of that slot, not
  // a child. Without that split, React would yank the button on
  // re-render and trip `removeChild ... is not a child of this node`.
  const handleActivate = () => {
    const slot = iframeSlotRef.current;
    if (!slot || activated) return;
    const iframe = document.createElement('iframe');
    iframe.setAttribute('allow', 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share');
    iframe.setAttribute('allowfullscreen', '');
    iframe.setAttribute('title', title);
    iframe.className = 'absolute inset-0 w-full h-full border-0';
    iframe.src = embedUrl;
    slot.appendChild(iframe);
    setActivated(true);
  };

  return (
    <div className={`youtube-embed-container my-6 ${className}`}>
      {title && showTitle && (
        <div className="video-title font-sans text-lg font-medium text-ods-text-primary mb-3">
          {title}
        </div>
      )}

      <div className="video-wrapper relative w-full" style={{ paddingBottom: '56.25%' }}>
        <div className="absolute inset-0 rounded-lg overflow-hidden border border-ods-border bg-ods-card">
          <div ref={iframeSlotRef} className="absolute inset-0" aria-hidden={!activated} />
          {!activated && (
            <button
              type="button"
              aria-label={`Play: ${title}`}
              onClick={handleActivate}
              className="group absolute inset-0 p-0 m-0 border-0 cursor-pointer bg-transparent"
            >
              <picture>
                <source type="image/webp" srcSet={posterWebp} />
                <img
                  src={posterJpg}
                  alt={title}
                  loading="lazy"
                  fetchPriority={aboveTheFold ? 'high' : 'low'}
                  decoding={aboveTheFold ? 'sync' : 'async'}
                  className="absolute inset-0 w-full h-full object-cover"
                />
              </picture>
              <div className="absolute inset-0 flex items-center justify-center bg-ods-bg-inverse bg-opacity-20 transition-opacity duration-200 group-hover:bg-opacity-30">
                <span className="flex items-center justify-center w-16 h-16 rounded-full bg-ods-accent text-ods-text-on-accent shadow-lg transition-transform duration-200 group-hover:scale-110">
                  <svg width={24} height={24} fill="currentColor" viewBox="0 0 24 24" className="ml-1">
                    <polygon points="5,3 19,12 5,21" />
                  </svg>
                </span>
              </div>
            </button>
          )}
        </div>
      </div>

      {showMeta && (
        <div className="video-meta flex items-center justify-between mt-3 text-sm text-ods-text-secondary">
          <div className="video-platform font-sans">YouTube</div>
          <a
            href={watchUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="video-link font-sans text-ods-accent hover:text-ods-accent-hover transition-colors duration-200"
          >
            Watch on YouTube →
          </a>
        </div>
      )}
    </div>
  );
};

const YT_HOSTS = new Set([
  'youtube.com', 'www.youtube.com', 'm.youtube.com',
  'youtu.be',
  'youtube-nocookie.com', 'www.youtube-nocookie.com',
]);

// `youtube.com/(embed|v|shorts)/<id>` — anchored, no `.*`, ReDoS-safe.
const YT_PATH_RE = /^\/(?:embed|v|shorts)\/([^/]+)\/?$/;

/**
 * Extract the YouTube video id from any common URL shape. Uses `URL`
 * parsing + a strict, anchored pathname regex — NOT the previous
 * `.*v=` pattern that CodeQL flagged for polynomial-time backtracking
 * on adversarial input like `youtube.com/watch?` repeated N times.
 */
export const extractYouTubeId = (url: string): string | null => {
  let u: URL;
  try { u = new URL(url); } catch { return null; }
  if (!YT_HOSTS.has(u.hostname.toLowerCase())) return null;
  // `youtu.be/<id>` — id is the first path segment.
  if (u.hostname.toLowerCase().endsWith('youtu.be')) {
    return u.pathname.split('/').filter(Boolean)[0] ?? null;
  }
  // `youtube.com/watch?v=<id>` — query parameter.
  const v = u.searchParams.get('v');
  if (v) return v;
  // `youtube.com/(embed|v|shorts)/<id>` — anchored pathname match.
  const m = u.pathname.match(YT_PATH_RE);
  return m ? m[1] : null;
};

