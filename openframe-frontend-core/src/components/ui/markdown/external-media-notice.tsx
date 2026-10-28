'use client';

import type React from 'react';
import { createContext } from 'react';
import type { AppOrigins } from '../../../utils/app-origins';
import { ClapperboardPlayIcon } from '../../icons-v2-generated/audio-and-visual/clapperboard-play-icon';
import { ImageOffIcon } from '../../icons-v2-generated/audio-and-visual/image-off-icon';

/**
 * The origins the markdown around a component may load media from, for the renderers that load media outside the
 * rehype pipeline (a mermaid diagram fetches its image shapes itself, while it renders). The engine provides the
 * snapshot its sanitizer decided against, or `null` under `allowRemoteMedia`. Unset without an engine above it:
 * the reader then decides against the app's origins now.
 */
export const MarkdownMediaOriginsContext = createContext<AppOrigins | null | undefined>(undefined);

/** The host a media URL is loaded from, or `null` for anything that is not http(s). */
export function externalMediaHost(url: string): string | null {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? parsed.host : null;
  } catch {
    return null;
  }
}

export interface ExternalMediaNoticeProps {
  /**
   * The absolute http(s) URL the media would have loaded from. A diagram may name none plainly (its source can spell
   * a URL with escapes): the notice then says it loads from other sites, without naming one.
   */
  url: string | null;
  kind: 'image' | 'video' | 'diagram';
  /** What the media is (an image's alt text, a video's title). */
  label?: string | null;
}

const COPY = {
  image: { noun: 'Image', reason: 'Images from other sites are blocked for your privacy.', Icon: ImageOffIcon },
  video: { noun: 'Video', reason: 'Videos from other sites are blocked for your privacy.', Icon: ClapperboardPlayIcon },
  diagram: {
    noun: 'Diagram',
    reason: 'This diagram loads images from other sites, which are blocked for your privacy.',
    Icon: ImageOffIcon,
  },
} as const;

/**
 * What stands where media from outside the app would have been, on content the app does not trust (chat replies,
 * tickets, knowledge-base articles). Loading a URL tells its host that the reader opened the message, along with
 * anything the URL carries, so a prompt-injected reply could send data out the moment it renders. The media is not
 * loaded at all, as GitHub Copilot Chat does with images from untrusted domains: no "load anyway", whose label would
 * be written by the same content. The notice keeps the media's place and says what it was and where it came from, so
 * the reader is not left with a gap.
 *
 * Spans only: a markdown image sits inside a `<p>`. `whitespace-normal`: a mermaid diagram sits inside a `<pre>`.
 */
export function ExternalMediaNotice({ url, kind, label }: ExternalMediaNoticeProps): React.ReactElement | null {
  const host = url ? externalMediaHost(url) : null;
  // Media needs a host to name; a diagram can do without (it says "other sites").
  if (!host && kind !== 'diagram') return null;

  const { noun, reason, Icon } = COPY[kind];
  const title = label?.trim() || noun;
  return (
    <span
      className="my-[var(--spacing-system-xsf)] inline-flex max-w-full items-start gap-[var(--spacing-system-xsf)] whitespace-normal rounded-lg border border-ods-border bg-ods-card p-[var(--spacing-system-sf)] align-middle"
      data-external-media={kind}
    >
      <Icon size={20} className="shrink-0 text-ods-text-secondary" aria-hidden />
      <span className="flex min-w-0 flex-col">
        <span className="truncate text-ods-text-primary text-h6">{title}</span>
        <span className="text-ods-text-secondary text-h6" title={url ?? undefined}>
          {host ? (
            <>
              From <span className="break-words">{host}</span>.{' '}
            </>
          ) : null}
          {reason}
        </span>
      </span>
    </span>
  );
}
