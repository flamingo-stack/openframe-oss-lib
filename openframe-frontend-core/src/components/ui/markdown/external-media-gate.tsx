'use client';

import type React from 'react';
import { createContext, useEffect, useRef, useState } from 'react';
import type { AppOrigins } from '../../../utils/app-origins';
import { ClapperboardPlayIcon } from '../../icons-v2-generated/audio-and-visual/clapperboard-play-icon';
import { ImageOffIcon } from '../../icons-v2-generated/audio-and-visual/image-off-icon';
import { Button } from '../button';

/**
 * The origins the markdown around a component may load media from, for the renderers that load media outside the
 * rehype pipeline (a mermaid diagram fetches its image shapes itself, while it renders). The engine provides the
 * snapshot its sanitizer decided against, or `null` under `allowRemoteMedia`. Unset without an engine above it:
 * the reader then decides against the app's origins now.
 */
export const MarkdownMediaOriginsContext = createContext<AppOrigins | null | undefined>(undefined);

/**
 * Media the reader asked to load in this page's lifetime, by kind and URL. A stand-in that re-mounts (a streamed
 * reply is parsed once more as a whole when it completes) keeps the reader's answer instead of asking again.
 */
const approvedMedia = new Set<string>();

/** The host a media URL is loaded from, or `null` for anything that is not http(s). */
export function externalMediaHost(url: string): string | null {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? parsed.host : null;
  } catch {
    return null;
  }
}

export interface ExternalMediaGateProps {
  /**
   * The absolute http(s) URL the media would load from. A diagram may name none plainly (its source can spell a URL
   * with escapes): the stand-in then says it loads from other sites, without naming one.
   */
  url: string | null;
  /** What the reader's answer is remembered by; defaults to the kind and the URL. */
  approvalKey?: string;
  kind: 'image' | 'video' | 'diagram';
  /** What the media is (an image's alt text, a video's title). */
  label?: string | null;
  /** The media itself, mounted only once the reader asks for it. */
  children: React.ReactNode;
}

const COPY = {
  image: { noun: 'Image', action: 'Load image', Icon: ImageOffIcon },
  video: { noun: 'Video', action: 'Load video', Icon: ClapperboardPlayIcon },
  diagram: { noun: 'Diagram', action: 'Load diagram', Icon: ImageOffIcon },
} as const;

/**
 * Click-to-load stand-in for media from outside the app, on content the app does not trust (chat replies, tickets,
 * knowledge-base articles). Loading a URL tells its host that the reader opened the message, along with anything
 * the URL carries, so a prompt-injected reply could otherwise send data out the moment it renders. The pattern is the
 * email client's: the media keeps its place, names where it comes from, and loads when the reader asks.
 *
 * Spans only: a markdown image sits inside a `<p>`. `whitespace-normal`: a mermaid diagram sits inside a `<pre>`.
 */
export function ExternalMediaGate({
  url,
  approvalKey,
  kind,
  label,
  children,
}: ExternalMediaGateProps): React.ReactElement | null {
  const key = approvalKey ?? `${kind} ${url}`;
  // `clicked`: loaded by the reader just now, so focus follows the media. `approved`: loaded earlier, left alone.
  const [loaded, setLoaded] = useState<'approved' | 'clicked' | null>(() =>
    approvedMedia.has(key) ? 'approved' : null,
  );
  const inlineRef = useRef<HTMLSpanElement>(null);
  const blockRef = useRef<HTMLDivElement>(null);
  // The button the reader pressed is gone once the media mounts; without this, keyboard and screen-reader focus would
  // fall back to the page and the reader would lose their place in the message.
  useEffect(() => {
    if (loaded === 'clicked') (inlineRef.current ?? blockRef.current)?.focus();
  }, [loaded]);
  const host = url ? externalMediaHost(url) : null;
  // Media needs a host to name; a diagram can do without (it says "other sites").
  if (!host && kind !== 'diagram') return null;
  const from = host ? ` from ${host}` : '';

  const { noun, action, Icon } = COPY[kind];
  const title = label?.trim() || noun;
  if (loaded) {
    const groupProps = { role: 'group', 'aria-label': `${noun}${from}`, tabIndex: -1, className: 'outline-none' };
    // An image sits inside a `<p>`, a video or a diagram does not.
    return kind === 'image' ? (
      <span ref={inlineRef} {...groupProps}>
        {children}
      </span>
    ) : (
      <div ref={blockRef} {...groupProps}>
        {children}
      </div>
    );
  }
  return (
    <span
      className="my-[var(--spacing-system-xsf)] inline-flex max-w-full flex-wrap items-center gap-[var(--spacing-system-sf)] whitespace-normal rounded-lg border border-ods-border bg-ods-card p-[var(--spacing-system-sf)] align-middle"
      data-external-media={kind}
    >
      {/* The text keeps at least 12rem; where that and the button do not fit (a chat column), the button wraps
          below instead of squeezing the explanation into a word per line. */}
      <span className="flex min-w-0 flex-1 basis-48 items-start gap-[var(--spacing-system-xsf)]">
        <Icon size={20} className="shrink-0 text-ods-text-secondary" aria-hidden />
        <span className="flex min-w-0 flex-col">
          <span className="truncate text-ods-text-primary text-h6">{title}</span>
          <span className="text-ods-text-secondary text-h6" title={url ?? undefined}>
            {host ? (
              <>
                From <span className="break-words">{host}</span>. Not loaded automatically, for your privacy.
              </>
            ) : (
              'Can load images from other sites. Not loaded automatically, for your privacy.'
            )}
          </span>
        </span>
      </span>
      <Button
        type="button"
        variant="outline"
        size="small"
        className="shrink-0"
        aria-label={`${action}${from}`}
        onClick={event => {
          // A markdown image can sit inside a link (`[![alt](src)](href)`): the click loads it, it does not follow
          // the link.
          event.preventDefault();
          event.stopPropagation();
          approvedMedia.add(key);
          setLoaded('clicked');
        }}
      >
        {action}
      </Button>
    </span>
  );
}
