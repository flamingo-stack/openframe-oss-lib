'use client'

import React from 'react'
import { ActionsMenuDropdown } from './actions-menu'
import { ColorSwatch } from './color-swatch'
import { Tag, type TagProps, tagVariants } from './tag'
import { CheckCircleIcon, Chevron02DownIcon } from '../icons-v2-generated'
import { cn } from '../../utils/cn'
import { deriveActiveColor, deriveHoverColor, getReadableTextColor } from '../../utils/ods-color-utils'

/**
 * Canonical ticket status values.
 * This is the single source of truth for ticket statuses across all frontends.
 */
export type TicketStatus = 'ACTIVE' | 'AI_ASSISTANCE' | 'TECH_REQUIRED' | 'ON_HOLD' | 'RESOLVED' | 'ARCHIVED'

type TagVariant = NonNullable<TagProps['variant']>

interface TicketStatusConfig {
  label: string
  variant: TagVariant
  icon?: React.ReactNode
}

const STATUS_CONFIG: Record<TicketStatus, TicketStatusConfig> = {
  ACTIVE: {
    label: 'Active',
    variant: 'success',
  },
  AI_ASSISTANCE: {
    label: 'AI Assistance',
    variant: 'outline',
  },
  TECH_REQUIRED: {
    label: 'Tech Required',
    variant: 'warning',
  },
  ON_HOLD: {
    label: 'On Hold',
    variant: 'error',
  },
  RESOLVED: {
    label: 'Resolved',
    variant: 'outline',
    icon: <CheckCircleIcon size={16} color="var(--ods-attention-green-success)" />,
  },
  ARCHIVED: {
    label: 'Archived',
    variant: 'grey',
  },
}

/**
 * Maps known aliases to canonical TicketStatus values.
 * Handles: backend UPPER_CASE, chat lowercase, and dialog-layer ACTION_REQUIRED alias.
 */
const STATUS_ALIASES: Record<string, TicketStatus> = {
  // Canonical (backend enum)
  ACTIVE: 'ACTIVE',
  AI_ASSISTANCE: 'AI_ASSISTANCE',
  ai_assistance: 'AI_ASSISTANCE',
  TECH_REQUIRED: 'TECH_REQUIRED',
  ON_HOLD: 'ON_HOLD',
  RESOLVED: 'RESOLVED',
  ARCHIVED: 'ARCHIVED',
  // Dialog-layer alias
  ACTION_REQUIRED: 'TECH_REQUIRED',
  // HubSpot canonical (OPEN/CLOSED) — drives color + icon variant. The
  // user-facing label still comes from `pipeline_stage_label` when the
  // caller passes <TicketStatusTag label={…}>, so the badge can read
  // "New" / "Working" / "Waiting on contact" while the canonical status
  // remains OPEN.
  OPEN: 'ACTIVE',
  open: 'ACTIVE',
  CLOSED: 'RESOLVED',
  closed: 'RESOLVED',
  // Chat lowercase variants
  active: 'ACTIVE',
  tech_required: 'TECH_REQUIRED',
  on_hold: 'ON_HOLD',
  resolved: 'RESOLVED',
  archived: 'ARCHIVED',
  action_required: 'TECH_REQUIRED',
}

/**
 * Resolves any status string to a canonical TicketStatus.
 * Returns null for unknown values.
 */
export function resolveTicketStatus(status: string): TicketStatus | null {
  return STATUS_ALIASES[status] ?? null
}

/**
 * Returns the display config (label, variant, icon) for a given ticket status.
 * Accepts any known status format (backend, chat, dialog).
 */
export function getTicketStatusConfig(status: string): TicketStatusConfig {
  const canonical = resolveTicketStatus(status)
  if (!canonical) {
    return { label: status.replace(/_/g, ' '), variant: 'outline' }
  }
  return STATUS_CONFIG[canonical]
}

/**
 * Returns just the label and variant for use with the Tag component.
 * Drop-in replacement for the getTicketStatusTag utility in openframe-frontend.
 */
export function getTicketStatusTag(status: string): { label: string; variant: TagVariant; icon?: React.ReactNode } {
  const config = getTicketStatusConfig(status)
  return { label: config.label, variant: config.variant, icon: config.icon }
}

// ---------------------------------------------------------------------------
// Lifecycle (custom-status) helpers
// ---------------------------------------------------------------------------

/** Backend status-definition kinds. */
export type TicketStatusKind = 'AI_ASSISTANCE' | 'TECH_REQUIRED' | 'RESOLVED' | 'ARCHIVED' | 'CUSTOM'

const KIND_TO_CANONICAL: Record<Exclude<TicketStatusKind, 'CUSTOM'>, TicketStatus> = {
  AI_ASSISTANCE: 'AI_ASSISTANCE',
  TECH_REQUIRED: 'TECH_REQUIRED',
  RESOLVED: 'RESOLVED',
  ARCHIVED: 'ARCHIVED',
}

/** Canonical TicketStatus for a backend kind, or undefined for CUSTOM/unknown. */
export function kindToCanonicalStatus(kind: string | null | undefined): TicketStatus | undefined {
  if (kind == null || kind === 'CUSTOM') return undefined
  return (KIND_TO_CANONICAL as Record<string, TicketStatus | undefined>)[kind]
}

/**
 * Whether a status of this kind renders with its canonical (system) styling
 * rather than the backend-provided color: AI_ASSISTANCE/RESOLVED/ARCHIVED do;
 * TECH_REQUIRED and custom statuses use their color.
 */
export function usesCanonicalStatusStyle(kind: string | null | undefined): boolean {
  return kind != null && kind !== 'CUSTOM' && kind !== 'TECH_REQUIRED'
}

export interface TicketStatusInput {
  /** Legacy enum status (may be empty/null under the lifecycle feature). */
  status?: string | null
  /** Backend status kind (AI_ASSISTANCE, TECH_REQUIRED, RESOLVED, ARCHIVED, CUSTOM). */
  statusKind?: string | null
  /** Custom status display name. */
  statusName?: string | null
  /** Custom status hex color. */
  statusColor?: string | null
}

/**
 * Maps a ticket's status fields to TicketStatusTag props, the unified design
 * shared across OpenFrame surfaces: AI_ASSISTANCE/RESOLVED/ARCHIVED render with
 * their canonical variant/icon; TECH_REQUIRED and custom statuses render from the
 * backend color, labelled by the custom status name.
 */
export function resolveStatusTagProps(input: TicketStatusInput): { status: string; label?: string; color?: string } {
  const canonical = usesCanonicalStatusStyle(input.statusKind) ? kindToCanonicalStatus(input.statusKind) : undefined
  return {
    status: canonical ?? input.status ?? '',
    label: input.statusName ?? undefined,
    color: canonical ? undefined : (input.statusColor ?? undefined),
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/** A selectable status option for the inline status-change dropdown. */
export interface TicketStatusTagOption {
  id: string
  name: string
  color: string
}

export interface TicketStatusTagProps {
  /** Ticket status in any known format (ACTIVE, active, ACTION_REQUIRED, etc.) */
  status: string
  /** Override the default label */
  label?: string
  /**
   * Hex color override. Replaces the variant's fill; text
   * color is computed for contrast. The status's preset icon is preserved.
   */
  color?: string
  /** Override the status's default Tag variant (e.g. force 'outline' or 'primary'). */
  variant?: TagVariant
  /** Additional className for the Tag */
  className?: string
  /** Show the status-specific icon (e.g. checkmark for resolved) */
  showIcon?: boolean
  /**
   * Make the tag an inline status changer. When provided (with `onSelect`), the
   * tag renders with a chevron and opens a dropdown of these options on click.
   */
  options?: TicketStatusTagOption[]
  /** Called with the chosen option id. Required for the inline dropdown. */
  onSelect?: (id: string) => void
  /** Disables the dropdown while a change is in flight. */
  isPending?: boolean
}

/**
 * Unified ticket status tag component.
 * Renders a styled Tag with the correct color variant and optional icon
 * for any ticket status value from any layer (backend, dialog, chat).
 */
export function TicketStatusTag({
  status,
  label,
  color,
  variant,
  className,
  showIcon = true,
  options,
  onSelect,
  isPending = false,
}: TicketStatusTagProps) {
  const config = getTicketStatusConfig(status)
  // Custom color: drive bg via CSS vars so the derived hover/active fills can win
  // on :hover/:active (an inline backgroundColor would block class-based hover).
  const customStyle = color
    ? ({
        '--tag-bg': color,
        '--tag-bg-hover': deriveHoverColor(color),
        '--tag-bg-active': deriveActiveColor(color),
        color: getReadableTextColor(color),
      } as React.CSSProperties)
    : undefined
  const customColorClasses = color
    ? 'bg-[var(--tag-bg)] hover:bg-[var(--tag-bg-hover)] active:bg-[var(--tag-bg-active)]'
    : undefined

  const tag = (
    <Tag
      label={label ?? config.label}
      variant={variant ?? config.variant}
      icon={showIcon ? config.icon : undefined}
      className={cn('shrink-0 w-fit', customColorClasses, className)}
      style={customStyle}
    />
  )

  if (!options || options.length === 0 || !onSelect) {
    return tag
  }

  return (
    <ActionsMenuDropdown
      align="start"
      groups={[
        {
          items: options.map(option => ({
            id: option.id,
            label: option.name,
            icon: <ColorSwatch color={option.color} />,
            onClick: () => onSelect(option.id),
            disabled: isPending,
          })),
        },
      ]}
      customTrigger={
        <button
          type="button"
          disabled={isPending}
          aria-label="Change status"
          style={customStyle}
          className={cn(
            // Reuse the tag's variant styling, but split into a label section and a
            // separated chevron section (the common dropdown-button seam).
            tagVariants({ variant: variant ?? config.variant }),
            'w-fit shrink-0 items-stretch justify-start gap-0 overflow-hidden p-0',
            'disabled:opacity-60 disabled:cursor-not-allowed',
            // Custom color: bg/hover/active from the CSS vars set above.
            customColorClasses,
            className,
          )}
        >
          <span className="flex items-center gap-[var(--spacing-system-xxs)] px-[var(--spacing-system-xsf)]">
            {showIcon && config.icon && (
              <span className="flex items-center justify-center size-5 shrink-0">{config.icon}</span>
            )}
            <span className="truncate">{label ?? config.label}</span>
          </span>
          <span className="flex items-center justify-center self-stretch border-l border-ods-border px-[var(--spacing-system-xsf)]">
            <Chevron02DownIcon className="size-4 shrink-0" />
          </span>
        </button>
      }
    />
  )
}
