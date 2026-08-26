'use client'

import { ExternalLink } from 'lucide-react'
import { Button } from '../ui/button/button'
import { ClaudeIcon } from '../icons/claude-icon'
import { EmbedViewerFrame } from './embed-viewer-frame'
import { toClaudeEmbedUrl } from '../../utils/embed-url-converters'

export type ClaudeEmbedKind = 'artifact' | 'design'

export interface ClaudeEmbedProps {
  /** Any claude.ai / claude.site url. */
  url: string
  /** Which surface the link points at — only the heading differs. */
  kind?: ClaudeEmbedKind
  /** The author's name for this link, when they gave one. */
  title?: string
  /** iframe height (CSS value), matching `FigmaEmbed`'s prop. */
  height?: string
  /** iframe loading strategy. Defaults to `lazy`, as `FigmaEmbed` does. */
  loading?: 'eager' | 'lazy'
  /** Self-hosted mirror of the artifact to FRAME instead of claude.ai.
   *  claude.ai frame-locks Claude CODE artifact urls entirely and serves
   *  public artifacts only to author-allow-listed hosts — when the host
   *  app keeps its own serving copy (e.g. the hub's design-briefs store),
   *  it passes that path here. The frame shows the mirror; the "Open in
   *  Claude" action still targets `url`, so commenting stays on
   *  claude.ai. Wins over `toClaudeEmbedUrl(url)` when set. */
  srcOverride?: string | null
}

const KIND_HEADING: Record<ClaudeEmbedKind, string> = {
  artifact: 'Claude Artifact',
  design: 'Claude Design',
}

/**
 * A Claude artifact, in the SAME chrome as every other embed viewer
 * (`EmbedViewerFrame` — what `FigmaEmbed` renders): icon, heading, an
 * "Open in Claude" action, and the frame below. Reached through the
 * `{{claude-artifact:URL}}` / `{{claude-design:URL}}` shortcodes, so it looks
 * identical wherever markdown renders — a spec body, a comment, a links rail.
 *
 * A PUBLISHED artifact frames through its `/embed` route (`toClaudeEmbedUrl`).
 * Everything else has no embeddable route at all, and then `src` is null and
 * the shared frame shows its own empty state — the action stays either way, so
 * the artifact is always one click away.
 *
 * What defeats the frame: a Claude CODE url (no Embed settings exist for it,
 * and its `/embed` path answers `frame-ancestors 'self'`), a Claude Design url
 * (no embed route), an artifact whose author has not allow-listed this host,
 * or an http host (mixed content — it will not paint on `http://localhost`).
 */
export function ClaudeEmbed({ url, kind = 'artifact', title, height, loading = 'lazy', srcOverride }: ClaudeEmbedProps) {
  // A mirror is by contract a SAME-ORIGIN absolute path ('/…', never
  // '//…' or a full url) — anything else is discarded, because whatever
  // this component frames wears Claude-branded chrome, and every other
  // frame source here is allow-listed (`toClaudeEmbedUrl` pins
  // claude.ai/claude.site). Shape-checked again here even though the
  // shortcode parser applies the same rule: the prop is public API and
  // callers can pass it directly.
  const mirrorSrc = srcOverride && /^\/(?!\/)/.test(srcOverride) ? srcOverride : null
  const embedUrl = mirrorSrc ?? toClaudeEmbedUrl(url)
  return (
    <EmbedViewerFrame
      className="my-6 space-y-3"
      icon={<ClaudeIcon className="w-5 h-5 shrink-0" />}
      title={title?.trim() || KIND_HEADING[kind]}
      titleVariant="h6"
      actions={
        <Button
          variant="outline"
          size="small-legacy"
          href={url}
          openInNewTab
          leftIcon={<ClaudeIcon className="w-4 h-4" />}
          rightIcon={<ExternalLink className="w-4 h-4" />}
          className="w-full sm:w-auto"
        >
          Open in Claude
        </Button>
      }
      src={embedUrl}
      // The framed artifact has no internal fullscreen button of its own
      // (unlike Figma's player) — the shell provides the toggle for both
      // the claude.ai `/embed` route and a mirror.
      fullscreenControl
      loading={loading}
      height={height}
      // Same frame contract Figma gets — an artifact is a real app: it copies
      // to the clipboard and can go fullscreen.
      allow="clipboard-write; clipboard-read; fullscreen"
      // …but UNLIKE Figma, an artifact is USER-AUTHORED HTML and JS, so it is
      // sandboxed. Omitting `allow-top-navigation` is the point: an artifact
      // cannot navigate the page it is embedded in. The `allow-same-origin`
      // token is CONDITIONAL on where the frame points:
      //   - claude.ai `/embed` (no srcOverride): Anthropic's own embed
      //     snippet uses it, and on a CROSS-ORIGIN frame it grants the
      //     frame claude.ai's origin — never ours. The artifact runtime
      //     needs it (storage, postMessage handshake).
      //   - a `srcOverride` mirror is served from the HOST's OWN origin —
      //     `allow-same-origin` + `allow-scripts` there would be a no-op
      //     sandbox handing the artifact first-party cookies and
      //     `window.parent`. A static mirror renders fine from an opaque
      //     origin, so the token is dropped.
      sandbox={
        mirrorSrc
          ? 'allow-scripts allow-popups allow-forms'
          : 'allow-scripts allow-same-origin allow-popups allow-forms'
      }
      allowFullScreen
      emptyIcon={<ClaudeIcon className="w-16 h-16 mb-4" />}
      emptyMessage="Open this one in Claude · it has no embeddable view"
    />
  )
}
