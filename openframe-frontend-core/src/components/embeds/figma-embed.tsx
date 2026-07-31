'use client'

import { useState } from 'react'
import { Button, ToggleGroup, ToggleGroupItem } from '../ui'
import { FigmaIcon } from '../icons-v2-generated'
import { ExternalLink, Play, LayoutGrid } from 'lucide-react'
import { toFigmaEmbedUrl, toFigmaOriginalUrl, isFigmaSlidesUrl } from '../../utils/embed-url-converters'
import { EmbedIframe } from './embed-iframe'

export interface FigmaEmbedProps {
  /** Any Figma URL (design/file/proto/board/slides/deck) or an already-resolved embed URL. */
  url: string
  /** Heading shown above the embed. Defaults to "Figma Design". */
  title?: string
  /**
   * iframe height (CSS value). The data-room document viewer omits it (full
   * height, `calc(100vh - 250px)`); inline markdown passes e.g. `"70vh"` so the
   * embed sits naturally inside article content.
   */
  height?: string
  /** iframe loading strategy. Defaults to `"lazy"`; the data-room viewer passes `"eager"`. */
  loading?: 'eager' | 'lazy'
}

type SlidesView = 'present' | 'browse'

/**
 * Two-state present/browse toggle for Figma Slides. `present` (default) uses
 * Figma's deck viewer (full-bleed slide + `‹ n/N ›` nav bar + keyboard nav);
 * `browse` uses the thumbnail-rail + zoom viewer.
 */
function SlidesViewToggle({
  view,
  onChange,
}: {
  view: SlidesView
  onChange: (v: SlidesView) => void
}) {
  const options: { key: SlidesView; label: string; Icon: typeof Play }[] = [
    { key: 'present', label: 'Present', Icon: Play },
    { key: 'browse', label: 'Browse', Icon: LayoutGrid },
  ]
  return (
    <ToggleGroup
      type="single"
      value={view}
      onValueChange={(v: string) => {
        if (v && v !== view) onChange(v as SlidesView)
      }}
      aria-label="Figma slides view mode"
      className="flex shrink-0 items-center gap-0.5 rounded-lg border border-ods-border bg-ods-card p-0.5"
    >
      {options.map(({ key, label, Icon }) => {
        const active = view === key
        return (
          <ToggleGroupItem
            key={key}
            value={key}
            aria-label={label}
            className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-h6 transition-colors ${
              active
                ? 'bg-ods-accent text-ods-text-on-accent'
                : 'text-ods-text-secondary hover:text-ods-text-primary hover:bg-ods-bg-hover'
            }`}
          >
            <Icon className="h-4 w-4 shrink-0" />
            {label}
          </ToggleGroupItem>
        )
      })}
    </ToggleGroup>
  )
}

/**
 * Single source of truth for every Figma surface — the data-room document viewer
 * and in-article markdown both render this. A header (icon + title + "Open in
 * Figma") over an interactive Figma iframe, built from the canonical
 * `toFigmaEmbedUrl` / `toFigmaOriginalUrl` converters + the shared `<EmbedIframe>`.
 * Only height/loading differ per surface.
 *
 * For Slides decks, a present/browse toggle (default = present) lets viewers flip
 * slides with Figma's native nav bar + keyboard, or switch to the thumbnail-rail
 * browse view.
 */
export function FigmaEmbed({ url, title, height, loading = 'lazy' }: FigmaEmbedProps) {
  const [view, setView] = useState<SlidesView>('present')
  const isSlides = url ? isFigmaSlidesUrl(url) : false
  const embedSrc = url ? toFigmaEmbedUrl(url, { slidesView: view }) : null
  const originalUrl = (() => {
    if (!url) return null
    try {
      const parsed = new URL(toFigmaOriginalUrl(url))
      const host = parsed.hostname.toLowerCase()
      const okHost = host === 'figma.com' || host.endsWith('.figma.com')
      const okProtocol = parsed.protocol === 'https:' || parsed.protocol === 'http:'
      return okHost && okProtocol ? parsed.toString() : null
    } catch {
      return null
    }
  })()
  const heading = title || 'Figma Design'

  return (
    <div className="my-6 space-y-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <FigmaIcon className="w-5 h-5 shrink-0" />
          <span className="text-h6 font-semibold text-ods-text-primary truncate">
            {heading}
          </span>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          {isSlides && embedSrc && <SlidesViewToggle view={view} onChange={setView} />}
          {originalUrl && (
            <Button
              variant="outline"
              size="small-legacy"
              href={originalUrl}
              openInNewTab
              leftIcon={<FigmaIcon className="w-4 h-4" />}
              rightIcon={<ExternalLink className="w-4 h-4" />}
              className="w-full sm:w-auto"
            >
              Open in Figma
            </Button>
          )}
        </div>
      </div>
      {embedSrc ? (
        <EmbedIframe
          src={embedSrc}
          title={heading}
          allow="clipboard-write; clipboard-read; fullscreen"
          loading={loading}
          height={height}
          allowFullScreen
        />
      ) : (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <FigmaIcon className="w-16 h-16 text-ods-text-secondary mb-4" />
          <p className="text-ods-text-secondary">Figma URL not configured</p>
        </div>
      )}
    </div>
  )
}
