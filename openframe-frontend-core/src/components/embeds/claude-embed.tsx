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
export function ClaudeEmbed({ url, kind = 'artifact', title, height = '70vh' }: ClaudeEmbedProps) {
  const embedUrl = toClaudeEmbedUrl(url)
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
      loading="lazy"
      height={height}
      emptyIcon={<ClaudeIcon className="w-16 h-16 mb-4" />}
      emptyMessage="Open this one in Claude · it has no embeddable view"
    />
  )
}
