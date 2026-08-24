'use client'

import { ExternalLink } from 'lucide-react'
import { ClaudeIcon } from '../icons/claude-icon'
import { toClaudeEmbedUrl } from '../../utils/embed-url-converters'

export type ClaudeEmbedKind = 'artifact' | 'design'

export interface ClaudeEmbedProps {
  /** Any claude.ai / claude.site url. */
  url: string
  /** Which surface the link points at — only the copy differs. */
  kind?: ClaudeEmbedKind
  /** Heading on the action row. Defaults to the kind's name. */
  title?: string
  /** iframe height (CSS value), matching `FigmaEmbed`'s prop. */
  height?: string
}

const KIND_LABEL: Record<ClaudeEmbedKind, string> = {
  artifact: 'Claude artifact',
  design: 'Claude Design',
}

/**
 * A Claude artifact, embedded the way Figma is — a markdown block, reached
 * through the `{{claude-artifact:URL}}` / `{{claude-design:URL}}` shortcodes,
 * so it renders identically wherever markdown renders: a spec body, a comment,
 * a links rail.
 *
 * A PUBLISHED artifact frames through its `/embed` route (see
 * `toClaudeEmbedUrl`). Everything else cannot be framed at all, so the action
 * row underneath is ALWAYS rendered: what the link is, why the frame above may
 * be blank, and one click to open it.
 *
 * Four things defeat the frame:
 *  · a Claude CODE url (`claude.ai/code/artifact/…`) — no Embed settings exist
 *    for it, and its `/embed` path answers `frame-ancestors 'self'`;
 *  · a Claude Design url, which has no embed route at all;
 *  · an artifact whose author has not added this host under Allowed domains;
 *  · an http host (mixed content) — it will not paint on `http://localhost`.
 */
export function ClaudeEmbed({ url, kind = 'artifact', title, height = '480px' }: ClaudeEmbedProps) {
  const label = title ?? KIND_LABEL[kind]
  const embedUrl = toClaudeEmbedUrl(url)
  return (
    <div className="overflow-hidden rounded-lg border border-ods-border bg-ods-card">
      {embedUrl ? (
        <iframe
          src={embedUrl}
          title={label}
          loading="lazy"
          // `allow-same-origin` alongside `allow-scripts` is what Anthropic's own
          // embed snippet uses — an artifact needs both to run.
          sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
          style={{ height }}
          className="block w-full border-0 bg-ods-bg-surface"
        />
      ) : null}
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className={`flex items-center gap-[var(--spacing-system-mf)] p-[var(--spacing-system-mf)] no-underline transition-colors hover:bg-ods-bg-surface ${
          embedUrl ? 'border-t border-ods-border' : ''
        }`}
      >
        {/* Claude's OWN mark, at its own brand colour — this is Anthropic's
            property and it is not ours to restyle. We used a generic asterisk
            in our accent colour, which dressed their content as ours. */}
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-ods-bg-surface">
          <ClaudeIcon className="h-6 w-6" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-h4 text-ods-text-primary">{label}</p>
          <p className="truncate text-h6 text-ods-text-secondary">
            {embedUrl
              ? 'claude.ai · blank above? Publish → Embed settings → add this site to Allowed domains'
              : kind === 'artifact'
                ? 'claude.ai · only a published chat artifact can be framed · a Claude Code link opens in a new tab'
                : 'claude.ai · opens in a new tab · claude.ai serves this surface with framing disabled'}
          </p>
        </div>
        <ExternalLink className="h-4 w-4 shrink-0 text-ods-text-secondary" />
      </a>
    </div>
  )
}
