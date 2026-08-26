'use client'

import { ExternalLink } from 'lucide-react'
import { Button } from '../ui/button/button'
import { ClaudeIcon } from '../icons/claude-icon'
import { EmbedViewerFrame } from './embed-viewer-frame'
import { useClaudeMirrorSrc } from '../../hooks/use-claude-mirror-src'
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
 * FRAME SOURCE — fully under the hood, in priority order:
 *   1. The host's SELF-HOSTED MIRROR: the url's artifact id derives the
 *      storage-view proxy path (`toClaudeMirrorPath`), probed with a
 *      1-byte ranged fetch. When the host has ingested a copy, the frame
 *      shows it — claude.ai frame-locks CODE artifacts entirely, so this
 *      is the only way those ever render inline.
 *   2. claude.ai's own `/embed` route for a PUBLISHED artifact
 *      (`toClaudeEmbedUrl`).
 *   3. Neither → the shared frame's empty state.
 * The consumer passes only the claude URL; "Open in Claude" always
 * targets it, so commenting stays on claude.ai.
 *
 * What defeats the claude.ai leg: a Claude CODE url (no Embed settings
 * exist for it, and its `/embed` path answers `frame-ancestors 'self'`),
 * a Claude Design url (no embed route), an artifact whose author has not
 * allow-listed this host, or an http host (mixed content).
 */
export function ClaudeEmbed({ url, kind = 'artifact', title, height, loading = 'lazy' }: ClaudeEmbedProps) {
  // Mirror detection lives in `useClaudeMirrorSrc` (derive from
  // EndpointsRuntime + 1-byte ranged probe) — this component stays
  // presentational: mirror when the hook found one, claude.ai otherwise.
  const mirrorSrc = useClaudeMirrorSrc(url)
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
      //   - claude.ai `/embed` (no mirror): Anthropic's own embed snippet
      //     uses it, and on a CROSS-ORIGIN frame it grants the frame
      //     claude.ai's origin — never ours. The artifact runtime needs
      //     it (storage, postMessage handshake).
      //   - the derived MIRROR is served from the HOST's OWN origin —
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
