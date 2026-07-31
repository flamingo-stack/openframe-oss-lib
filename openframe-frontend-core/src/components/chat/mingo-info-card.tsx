'use client'

import * as React from 'react'
import { cn } from '../../utils/cn'
import { tagVariants, type TagProps } from '../ui/tag'
import { ActionsMenuDropdown, type ActionsMenuGroup } from '../ui/actions-menu'
import { Ellipsis01Icon } from '../icons-v2-generated'
import { getFirstLastInitials } from '../../utils/format'

// =============================================================================
// Types
// =============================================================================

/** A coloured status pill rendered to the right of the title/description. */
export interface MingoInfoCardStatus {
  /** Pill text — rendered uppercase via the `success`/`warning`/… Tag palette. */
  label: React.ReactNode
  /** Tag colour. Defaults to `success` (green) to match the Figma sample. */
  variant?: TagProps['variant']
}

export interface MingoInfoCardProps {
  /** Card title — DM Sans Medium 18px (`text-h4`), white. Truncates on overflow. */
  title: React.ReactNode
  /** Optional secondary line below the title — 14px (`text-h6`), grey. Truncates. */
  description?: React.ReactNode
  /**
   * Leading 40px avatar image (`img="image"` variant in Figma). Takes
   * precedence over `icon` when both are supplied. Falls back to initials
   * derived from `imageAlt` if the image fails to load.
   */
  imageSrc?: string
  /** Alt text / initials fallback for `imageSrc`. */
  imageAlt?: string
  /**
   * Leading 24px glyph rendered inside a 40px box (`img="icon"` variant).
   * Ignored when `imageSrc` is set. Pass an `icons-v2-generated` icon — it
   * inherits `currentColor` from the box's `text-ods-text-primary`.
   */
  icon?: React.ReactNode
  /** Optional status pill (e.g. `{ label: 'Online' }`). */
  status?: MingoInfoCardStatus
  /**
   * Overflow-menu groups. When non-empty, a trailing "⋯" button opens an
   * `ActionsMenuDropdown`. Omit to hide the button entirely.
   */
  menuGroups?: ReadonlyArray<ActionsMenuGroup>
  /** Aria-label for the "⋯" trigger. Defaults to `"More actions"`. */
  menuAriaLabel?: string
  /**
   * Renders the main content region as an `<a>` (for navigation) instead of a
   * `<button>`. Takes precedence over `onClick`. The "⋯" button stays a sibling
   * of the anchor — not nested inside it — so the markup stays valid.
   */
  anchorProps?: MingoInfoCardAnchorProps
  /**
   * Click handler for the main content region. When set (and `anchorProps` is
   * not), the title/description region becomes a `<button>` with hover/focus
   * affordances. The "⋯" button keeps its own independent click target.
   */
  onClick?: () => void
  /** Appended to the root element. */
  className?: string
}

/** Anchor-prop bundle for the content region — mirrors the `*AnchorProps`
 *  shape the chat entity-cards pass (`{ href, target?, rel?, onClick? }`). */
export interface MingoInfoCardAnchorProps {
  href: string
  target?: '_blank'
  rel?: string
  onClick?: (e: React.MouseEvent<HTMLAnchorElement>) => void
}

// =============================================================================
// Span-only markup
//
// This card renders inline inside chat message paragraphs (the `[card://]`
// marker is replaced in-place, landing the card inside a `<p>`). To stay
// valid there, EVERY element is phrasing content — `<span>` / `<a>` / `<img>`
// / `<button>` only, never `<div>`. Layout comes from `display` utilities, so
// the visual is identical to a block card.
// =============================================================================

/** 40px leading media — avatar image (with initials fallback) or boxed glyph. */
function CardMedia({
  imageSrc,
  imageAlt,
  icon,
}: Pick<MingoInfoCardProps, 'imageSrc' | 'imageAlt' | 'icon'>) {
  if (imageSrc) {
    return (
      <span className="relative block size-10 shrink-0">
        {/* Initials fallback sits BEHIND the image. The image is the framed
            element itself — `rounded-sm` + `border` live on the `<img>` so the
            picture and its 1px frame share one radius (no corner gap from
            clipping a separate absolutely-positioned child). On a 404 the
            image's `onError` hides it and the initials show through. */}
        <span className="absolute inset-0 flex items-center justify-center rounded-sm border border-ods-border bg-ods-bg text-h6 text-ods-text-primary">
          {getFirstLastInitials(imageAlt) || '?'}
        </span>
        <img
          src={imageSrc}
          alt={imageAlt || ''}
          className="relative block size-10 rounded-sm border border-ods-border object-cover"
          onError={(e) => {
            e.currentTarget.style.display = 'none'
          }}
        />
      </span>
    )
  }
  if (icon) {
    return (
      <span className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-md border border-ods-border bg-ods-bg text-ods-text-secondary">
        <span className="flex size-6 items-center justify-center">{icon}</span>
      </span>
    )
  }
  return null
}

export function MingoInfoCard({
  title,
  description,
  imageSrc,
  imageAlt,
  icon,
  status,
  menuGroups,
  menuAriaLabel = 'More actions',
  anchorProps,
  onClick,
  className,
}: MingoInfoCardProps) {
  const hasMedia = !!imageSrc || !!icon
  const hasMenu = !!menuGroups && menuGroups.length > 0
  const isAnchor = !!anchorProps
  const isInteractive = isAnchor || !!onClick

  // The content region: leading media, text column, status pill. Owns the
  // `border-r` divider that sits before the "⋯" button.
  const content = (
    <>
      {hasMedia && (
        <CardMedia imageSrc={imageSrc} imageAlt={imageAlt} icon={icon} />
      )}
      <span className="flex min-w-0 flex-1 flex-col justify-center">
        <span className="truncate text-h4 text-ods-text-primary">
          {title}
        </span>
        {description ? (
          <span className="truncate text-h6 text-ods-text-secondary">
            {description}
          </span>
        ) : null}
      </span>
      {status ? (
        // Reuse the shared Tag palette (single source of truth for colours)
        // without rendering Tag's `<div>` — span-only for `<p>` validity.
        <span className={cn(tagVariants({ variant: status.variant ?? 'success' }), 'shrink-0')}>
          <span className="truncate uppercase tracking-[-0.28px]">{status.label}</span>
        </span>
      ) : null}
    </>
  )

  const contentClass = cn(
    'flex min-w-0 flex-1 items-center gap-[var(--spacing-system-s)] overflow-hidden p-[var(--spacing-system-s)] text-left',
    hasMenu && 'border-r border-ods-border',
    isInteractive &&
      'transition-colors hover:bg-ods-bg-hover active:bg-ods-bg-active focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ods-accent cursor-pointer',
  )

  return (
    <span
      className={cn(
        'flex w-full items-center overflow-hidden rounded-md border border-ods-border bg-ods-card',
        className,
      )}
    >
      {isAnchor ? (
        <a {...anchorProps} className={cn(contentClass, 'no-underline')}>
          {content}
        </a>
      ) : onClick ? (
        <button type="button" onClick={onClick} className={contentClass}>
          {content}
        </button>
      ) : (
        <span className={contentClass}>{content}</span>
      )}

      {hasMenu && (
        <ActionsMenuDropdown
          groups={menuGroups as ActionsMenuGroup[]}
          triggerAriaLabel={menuAriaLabel}
          onCloseAutoFocus={(e) => e.preventDefault()}
          customTrigger={
            <button
              type="button"
              aria-label={menuAriaLabel}
              // Press feedback mirrors `Button` (transparent variant):
              // `hover:bg-ods-bg-hover` → `active:bg-ods-bg-active`.
              className="flex w-[56px] md:w-[68px] shrink-0 items-center justify-center self-stretch text-ods-text-secondary transition-colors hover:bg-ods-bg-hover hover:text-ods-text-primary active:bg-ods-bg-active active:text-ods-text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ods-accent"
            >
              <Ellipsis01Icon size={24} />
            </button>
          }
        />
      )}
    </span>
  )
}
