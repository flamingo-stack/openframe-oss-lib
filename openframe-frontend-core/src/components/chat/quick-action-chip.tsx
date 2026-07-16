'use client'

import * as React from 'react'
import { cn } from '../../utils/cn'
import { Tag } from '../ui/tag'
import { EntityIcon, type EntityIconValue } from '../icon-display'

// =============================================================================
// Types
// =============================================================================

/** Accent tint for quick-action chip icons: a named brand token
 *  (`'pink'`/`'cyan'`) or ANY CSS color value coming from admin config
 *  (agent/persona `icon_props.color`). */
export type QuickActionAccent = 'pink' | 'cyan' | (string & {})

/**
 * FALLBACK-ONLY agent→accent mapping (fae→pink, mingo→cyan) for the built-in
 * agents when nothing is configured. A color configured on the entity itself —
 * the quick action's `iconProps.color`, or the agent/persona identity
 * `icon_props.color` — always wins over this map; callers must resolve the
 * configured value first and only fall back here. Never re-inline the slug
 * comparison elsewhere.
 */
export function getAgentAccent(slug: string | null | undefined): QuickActionAccent | undefined {
  if (slug === 'fae') return 'pink'
  if (slug === 'mingo') return 'cyan'
  return undefined
}

/** Admin-configured identity color (`icon_props.color` on the agent/persona
 *  row) → chip accent. Undefined when the identity doesn't set one. */
export function accentFromIdentityIcon(
  icon: { props?: Record<string, unknown> | null } | null | undefined,
): QuickActionAccent | undefined {
  const color = icon?.props?.color
  return typeof color === 'string' && color.length > 0 ? color : undefined
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

const ACCENT_CLASS: Record<string, string> = {
  pink: 'text-ods-flamingo-pink',
  cyan: 'text-ods-flamingo-cyan',
}

/** Resolve a chip `icon` prop to a renderable node. Specs go through
 *  `<EntityIcon>`; ReactNodes pass through untouched. */
export function renderQuickActionIcon(
  icon: React.ReactNode | QuickActionIconSpec | undefined,
): React.ReactNode {
  // A spec is a plain data object, never a React element — so any non-element,
  // non-array object is a spec; strings, elements, fragments, and ReactNode
  // ARRAYS stay ReactNode.
  if (typeof icon !== 'object' || icon === null || Array.isArray(icon) || React.isValidElement(icon)) {
    return icon
  }
  const spec = icon as QuickActionIconSpec
  if (!spec.name && !spec.url) return undefined
  // Named brand tokens tint via a text class on `currentColor`; any other
  // accent value is an admin-configured CSS color, delivered as the glyph's
  // DEFAULT `color` prop — an explicit per-action `props.color` (spread after)
  // still wins.
  const accentClass = spec.accent ? ACCENT_CLASS[spec.accent] : undefined
  const props =
    spec.accent && !accentClass ? { color: spec.accent, ...(spec.props ?? {}) } : spec.props
  return (
    <EntityIcon
      icon={{ name: spec.name, url: spec.url, props }}
      size={spec.size ?? 16}
      className={accentClass}
    />
  )
}

/**
 * Compact category/status affix rendered INSIDE the chip at the label's
 * leading edge (Atlassian-lozenge / M3 leading-slot pattern — category as
 * text, never color alone). `className` drives the text color (e.g.
 * `text-ods-warning`); the tinted background derives from `currentColor`,
 * so one utility styles both.
 */
export interface QuickActionChipLozenge {
  label: React.ReactNode
  className?: string
}

/** Resolve a chip label + optional lozenge to the Tag label node. */
function composeChipLabel(
  label: React.ReactNode,
  lozenge: QuickActionChipLozenge | undefined,
): React.ReactNode {
  if (!lozenge) return label
  return (
    <>
      <span
        className={cn(
          // -translate-y-[1px]: align-middle centers on x-height, but the chip
          // labels are uppercase (no descenders), so the lozenge reads ~1px low
          // against the caps' optical center (measured 9.1px above / 6.9px
          // below in the 32px Tag). Keep QuickActionChipSkeleton's lozenge bar
          // offset in lockstep.
          'mr-2 inline-flex items-center rounded px-[5px] py-[3px] align-middle -translate-y-[1px] text-h6 font-bold uppercase',
          lozenge.className,
        )}
        style={{ background: 'color-mix(in srgb, currentColor 14%, transparent)' }}
      >
        {lozenge.label}
      </span>
      {label}
    </>
  )
}

export interface QuickActionChipButtonProps {
  label: React.ReactNode
  /** Icon: a declarative {@link QuickActionIconSpec} (preferred — unified
   *  EntityIcon resolution) or a pre-rendered ReactNode. */
  icon?: React.ReactNode | QuickActionIconSpec
  /** Optional {@link QuickActionChipLozenge} at the label's leading edge
   *  (e.g. an IT/SEC classification affix). */
  lozenge?: QuickActionChipLozenge
  /** `'primary'` = accent (yellow) chip, `'outline'` = bordered chip (default). */
  variant?: 'primary' | 'outline'
  /** Active single-select state (Figma "Feature Item" active): renders the
   *  Tag's `selected` variant (pink border + pink-secondary fill), overriding
   *  `variant`. Used by chip groups acting as tabs (OpenFrame categories). */
  selected?: boolean
  /** Accent for the `selected` skin: `'cyan'` uses the cyan twin, anything else
   *  (default) uses pink. Lets an agent's chip group match its own theme accent
   *  (fae pink / mingo cyan) instead of the fixed pink. */
  selectedAccent?: QuickActionAccent
  /** Chip scale, forwarded to `Tag` — `'large'` is the Figma "Feature Item"
   *  48px chip (h3 bold label, 24px icon box). Default `'default'` (32px). */
  size?: 'default' | 'large'
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
// Skeleton
// =============================================================================

export interface QuickActionChipSkeletonProps {
  /** Label placeholder width in `ch` of the chip's own font — vary per item
   *  for a realistic spread. Default 16. */
  labelCh?: number
  /** Reserve the leading-icon slot (default true — most chips carry one). */
  icon?: boolean
  /** Reserve the leading lozenge affix slot. */
  lozenge?: boolean
  /** Chip scale — MUST match the loaded chips' `size` or the swap jumps. */
  size?: 'default' | 'large'
  className?: string
}

/** Pulse bar inside the chip skeleton — the standard `ui/skeleton` treatment
 *  (`animate-pulse bg-ods-border`), as a SPAN so it stays valid phrasing
 *  content inside the Tag's label span. */
function ChipSkelBar({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return <span aria-hidden className={cn('animate-pulse rounded-md bg-ods-border', className)} style={style} />
}

/**
 * Loading placeholder for {@link QuickActionChipButton} — renders the REAL
 * `Tag` (same height, padding, border, radius, icon box) with standard
 * skeleton pulse bars (identical animation + token as `ui/skeleton`) in the
 * icon/lozenge/label slots, so a skeleton chip is 1:1 with a loaded chip by
 * construction. Use anywhere quick actions stream in (chat empty states,
 * marketing walls, deck panels).
 */
export function QuickActionChipSkeleton({ labelCh = 16, icon = true, lozenge = false, size = 'default', className }: QuickActionChipSkeletonProps) {
  return (
    <Tag
      variant="outline"
      size={size}
      className={className}
      icon={icon ? <ChipSkelBar className={size === 'large' ? 'block size-5' : 'block size-4'} /> : undefined}
      label={
        <>
          {lozenge && <ChipSkelBar className="mr-2 inline-block h-[16px] w-[26px] translate-y-[2px]" />}
          <ChipSkelBar className="inline-block h-[0.9em] translate-y-[0.08em]" style={{ width: `${labelCh}ch` }} />
        </>
      }
    />
  )
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
  lozenge,
  variant = 'outline',
  selected = false,
  selectedAccent,
  size = 'default',
  onSelect,
  onHoverStart,
  onHoverEnd,
  interactive = true,
  className,
}: QuickActionChipButtonProps) {
  const resolvedIcon = renderQuickActionIcon(icon)
  const resolvedLabel = composeChipLabel(label, lozenge)
  const tagVariant = selected ? (selectedAccent === 'cyan' ? 'selectedCyan' : 'selected') : variant
  if (!interactive) {
    return <Tag variant={tagVariant} size={size} icon={resolvedIcon} label={resolvedLabel} className={className} />
  }
  return (
    <button
      type="button"
      onClick={onSelect}
      onMouseEnter={onHoverStart}
      onMouseLeave={onHoverEnd}
      onFocus={onHoverStart}
      onBlur={onHoverEnd}
      aria-pressed={selected || undefined}
      className={cn(
        'shrink-0 rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-ods-accent',
        className,
      )}
    >
      <Tag variant={tagVariant} size={size} icon={resolvedIcon} label={resolvedLabel} />
    </button>
  )
}
