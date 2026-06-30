'use client'

import * as React from 'react'
import { AgentMark, type AgentName } from './agent-mark'
import { resolveIcon } from './chat/utils/icon-library'

/** Unified icon value used across the app (announcement bar, chat quick actions,
 *  AI-agent identity). Exactly one of `name`/`url` is typically set. */
export interface EntityIconValue {
  /** Library glyph name resolved via {@link resolveIcon} (icons-v2 + curated aliases). */
  name?: string | null
  /** Uploaded image URL — wins over `name`. */
  url?: string | null
  /** Props spread onto the resolved glyph (e.g. `{ color }`). */
  props?: Record<string, unknown> | null
}

const BRAND_MARK_NAMES = new Set<string>(['fae', 'mingo'])

/**
 * THE single icon-display path for the whole app. Resolution order:
 *   1. `url` → uploaded image
 *   2. `name` ∈ {fae,mingo} → packaged `AgentMark`
 *   3. `name` → library glyph via `resolveIcon` (+ `props`)
 *
 * Replaces the old per-surface logic (the announcement bar's `renderSvgIcon`
 * map and the chat's ad-hoc `resolveIcon` calls) so every surface renders an
 * icon identically.
 */
export function EntityIcon({
  icon,
  size = 20,
  className,
}: {
  icon?: EntityIconValue | null
  size?: number
  className?: string
}): React.ReactElement {
  if (icon?.url) {
    // eslint-disable-next-line @next/next/no-img-element
    return (
      <img
        src={icon.url}
        alt=""
        width={size}
        height={size}
        className={className}
        style={{ objectFit: 'contain' }}
      />
    )
  }
  if (icon?.name && BRAND_MARK_NAMES.has(icon.name)) {
    return (
      <span style={{ display: 'inline-flex', width: size, height: size }} className={className}>
        <AgentMark agent={icon.name as AgentName} className="w-full h-full" />
      </span>
    )
  }
  const Glyph = resolveIcon(icon?.name ?? undefined)
  return <Glyph size={size} className={className} {...(icon?.props ?? {})} />
}
