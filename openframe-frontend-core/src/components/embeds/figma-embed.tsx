'use client';

import { ExternalLink, Play, LayoutGrid } from 'lucide-react';
import { useState } from 'react';
import { toFigmaEmbedUrl, toFigmaOriginalUrl, isFigmaSlidesUrl } from '../../utils/embed-url-converters';
import { FigmaIcon } from '../icons-v2-generated';
import { Button, ToggleGroup, ToggleGroupItem } from '../ui';
import { EmbedViewerFrame } from './embed-viewer-frame';

export interface FigmaEmbedProps {
  /** Any Figma URL (design/file/proto/board/slides/deck) or an already-resolved embed URL. */
  url: string;
  /** Heading shown above the embed. Defaults to "Figma Design". */
  title?: string;
  /**
   * iframe height (CSS value). The data-room document viewer omits it (full
   * height, `calc(100vh - 250px)`); inline markdown passes e.g. `"70vh"` so the
   * embed sits naturally inside article content.
   */
  height?: string;
  /** iframe loading strategy. Defaults to `"lazy"`; the data-room viewer passes `"eager"`. */
  loading?: 'eager' | 'lazy';
}

type SlidesView = 'present' | 'browse';

/**
 * Two-state present/browse toggle for Figma Slides. `present` (default) uses
 * Figma's deck viewer (full-bleed slide + `‹ n/N ›` nav bar + keyboard nav);
 * `browse` uses the thumbnail-rail + zoom viewer.
 */
function SlidesViewToggle({ view, onChange }: { view: SlidesView; onChange: (v: SlidesView) => void }) {
  const options: { key: SlidesView; label: string; Icon: typeof Play }[] = [
    { key: 'present', label: 'Present', Icon: Play },
    { key: 'browse', label: 'Browse', Icon: LayoutGrid },
  ];
  return (
    <ToggleGroup
      type="single"
      value={view}
      onValueChange={(v: string) => {
        if (v && v !== view) onChange(v as SlidesView);
      }}
      aria-label="Figma slides view mode"
      className="flex shrink-0 items-center gap-0.5 rounded-lg border border-ods-border bg-ods-card p-0.5"
    >
      {options.map(({ key, label, Icon }) => {
        const active = view === key;
        return (
          <ToggleGroupItem
            key={key}
            value={key}
            aria-label={label}
            className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 transition-colors text-h6 ${
              active
                ? 'bg-ods-accent text-ods-text-on-accent'
                : 'text-ods-text-secondary hover:bg-ods-bg-hover hover:text-ods-text-primary'
            }`}
          >
            <Icon className="h-4 w-4 shrink-0" />
            {label}
          </ToggleGroupItem>
        );
      })}
    </ToggleGroup>
  );
}

/**
 * Single source of truth for every Figma surface — the data-room document viewer
 * and in-article markdown both render this. A header (icon + title + "Open in
 * Figma") over an interactive Figma iframe, built from the canonical
 * `toFigmaEmbedUrl` / `toFigmaOriginalUrl` converters + the shared
 * `<EmbedViewerFrame>` (which owns the header/empty-state/iframe shell).
 * Only height/loading differ per surface.
 *
 * For Slides decks, a present/browse toggle (default = present) lets viewers flip
 * slides with Figma's native nav bar + keyboard, or switch to the thumbnail-rail
 * browse view. The toggle's state lives HERE (the frame's `actions` slot is a
 * plain ReactNode) — flipping it recomputes `embedSrc`, and the frame's
 * `EmbedIframe` remounts on the new src exactly as before the extraction.
 */
export function FigmaEmbed({ url, title, height, loading = 'lazy' }: FigmaEmbedProps) {
  const [view, setView] = useState<SlidesView>('present');
  const isSlides = url ? isFigmaSlidesUrl(url) : false;
  const embedSrc = url ? toFigmaEmbedUrl(url, { slidesView: view }) : null;
  const originalUrl = (() => {
    if (!url) return null;
    try {
      const parsed = new URL(toFigmaOriginalUrl(url));
      const host = parsed.hostname.toLowerCase();
      const okHost = host === 'figma.com' || host.endsWith('.figma.com');
      const okProtocol = parsed.protocol === 'https:' || parsed.protocol === 'http:';
      return okHost && okProtocol ? parsed.toString() : null;
    } catch {
      return null;
    }
  })();
  const heading = title || 'Figma Design';

  return (
    <EmbedViewerFrame
      className="my-6 space-y-3"
      icon={<FigmaIcon className="h-5 w-5 shrink-0" />}
      title={heading}
      titleVariant="h6"
      actions={
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          {isSlides && embedSrc && <SlidesViewToggle view={view} onChange={setView} />}
          {originalUrl && (
            <Button
              variant="outline"
              size="small-legacy"
              href={originalUrl}
              openInNewTab
              leftIcon={<FigmaIcon className="h-4 w-4" />}
              rightIcon={<ExternalLink className="h-4 w-4" />}
              className="w-full sm:w-auto"
            >
              Open in Figma
            </Button>
          )}
        </div>
      }
      src={embedSrc}
      allow="clipboard-write; clipboard-read; fullscreen"
      loading={loading}
      height={height}
      allowFullScreen
      emptyIcon={<FigmaIcon className="mb-4 h-16 w-16 text-ods-text-secondary" />}
      emptyMessage="Figma URL not configured"
    />
  );
}
