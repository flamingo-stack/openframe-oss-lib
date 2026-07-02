'use client'

import * as React from 'react'
import { cn } from '../../utils/cn'
import { Tag } from '../ui/tag'
import { EntityIcon, type EntityIconValue } from '../icon-display'

// =============================================================================
// Types
// =============================================================================

/** Agent accent tint for quick-action chip icons. */
export type QuickActionAccent = 'pink' | 'cyan'

/**
 * THE single agent→accent mapping (fae→pink, mingo→cyan). Every surface that
 * tints a chip icon by agent derives it from here — never re-inline the
 * slug comparison.
 */
export function getAgentAccent(slug: string | null | undefined): QuickActionAccent | undefined {
  if (slug === 'fae') return 'pink'
  if (slug === 'mingo') return 'cyan'
  return undefined
}

/**
 * Declarative icon for a quick-action chip, resolved 100% by `<EntityIcon>`
 * (url → fae/mingo `AgentMark` → icons-v2 glyph → file fallback):
 * - "agent format" — `{ name: 'fae' }` / `{ name: 'mingo' }` renders the
 *   packaged agent mark (fills the chip's icon box; `accent` is ignored — the
 *   marks carry their own colors).
 * - "config format" — `{ name, url, props, accent }` renders the
 *   admin-configured icon; `accent` tints registry glyphs via a
 *   `text-ods-flamingo-*` class on `currentColor`.
 *
 * If `props.color` is set it wins over `accent` — the accent is a class tint
 * on `currentColor`, the prop is an explicit fill (EntityIcon spreads `props`
 * onto the glyph last).
 */
export interface QuickActionIconSpec extends EntityIconValue {
  accent?: QuickActionAccent
  /** Glyph size in px. Defaults to 16 (the chip design's config-icon size);
   *  agent marks size via the icon box instead. */
  size?: number
}

const ACCENT_CLASS: Record<QuickActionAccent, string> = {
  pink: 'text-ods-flamingo-pink',
  cyan: 'text-ods-flamingo-cyan',
}

/** Resolve a chip `icon` prop to a renderable node. Specs go through
 *  `<EntityIcon>`; ReactNodes pass through untouched. */
export function renderQuickActionIcon(
  icon: React.ReactNode | QuickActionIconSpec | undefined,
): React.ReactNode {
  // A spec is a plain data object, never a React element — so any non-element
  // object is a spec; strings/elements/fragments stay ReactNode.
  if (typeof icon !== 'object' || icon === null || React.isValidElement(icon)) return icon
  const spec = icon as QuickActionIconSpec
  if (!spec.name && !spec.url) return undefined
  return (
    <EntityIcon
      icon={{ name: spec.name, url: spec.url, props: spec.props }}
      size={spec.size ?? 16}
      className={spec.accent ? ACCENT_CLASS[spec.accent] : undefined}
    />
  )
}

export interface QuickActionChipButtonProps {
  label: React.ReactNode
  /** Icon: a declarative {@link QuickActionIconSpec} (preferred — unified
   *  EntityIcon resolution) or a pre-rendered ReactNode. */
  icon?: React.ReactNode | QuickActionIconSpec
  /** `'primary'` = accent (yellow) chip, `'outline'` = bordered chip (default). */
  variant?: 'primary' | 'outline'
  onSelect?: () => void
  /** Pointer/keyboard focus enters the chip — e.g. preview the full prompt. */
  onHoverStart?: () => void
  /** Pointer/keyboard focus leaves the chip — e.g. restore the composer. */
  onHoverEnd?: () => void
  /** `false` renders a plain non-focusable `<Tag>` (decorative use: marquee
   *  strips, table cells). Default `true`. */
  interactive?: boolean
  className?: string
}

// =============================================================================
// Component
// =============================================================================

/**
 * The unified quick-action chip — Figma chip anatomy (card bg, border, mono
 * uppercase label) via the `Tag` outline/primary variants, with icon
 * resolution owned by `<EntityIcon>` in two formats (config icon w/ agent
 * accent, or fae/mingo agent mark). Used by every chat empty state
 * (guide / mingo / ai-agent), the marketing marquee strips, and the ROI
 * table task cells.
 */
export function QuickActionChipButton({
  label,
  icon,
  variant = 'outline',
  onSelect,
  onHoverStart,
  onHoverEnd,
  interactive = true,
  className,
}: QuickActionChipButtonProps) {
  const resolvedIcon = renderQuickActionIcon(icon)
  if (!interactive) {
    return <Tag variant={variant} icon={resolvedIcon} label={label} className={className} />
  }
  return (
    <button
      type="button"
      onClick={onSelect}
      onMouseEnter={onHoverStart}
      onMouseLeave={onHoverEnd}
      onFocus={onHoverStart}
      onBlur={onHoverEnd}
      className={cn(
        'shrink-0 rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-ods-accent',
        className,
      )}
    >
      <Tag variant={variant} icon={resolvedIcon} label={label} />
    </button>
  )
}
