'use client'

import React from 'react'
import { Tag, type TagProps } from './tag'
import { CheckCircleIcon } from '../icons-v2-generated'
import { cn } from '../../utils/cn'

/**
 * Canonical ticket status values.
 * This is the single source of truth for ticket statuses across all frontends.
 */
export type TicketStatus = 'ACTIVE' | 'TECH_REQUIRED' | 'ON_HOLD' | 'RESOLVED' | 'ARCHIVED'

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
    icon: <CheckCircleIcon size={16} className="text-ods-attention-green-success" />,
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
  TECH_REQUIRED: 'TECH_REQUIRED',
  ON_HOLD: 'ON_HOLD',
  RESOLVED: 'RESOLVED',
  ARCHIVED: 'ARCHIVED',
  // Dialog-layer alias
  ACTION_REQUIRED: 'TECH_REQUIRED',
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
export function getTicketStatusTag(status: string): { label: string; variant: TagVariant } {
  const config = getTicketStatusConfig(status)
  return { label: config.label, variant: config.variant }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export interface TicketStatusTagProps {
  /** Ticket status in any known format (ACTIVE, active, ACTION_REQUIRED, etc.) */
  status: string
  /** Override the default label */
  label?: string
  /** Additional className for the Tag */
  className?: string
  /** Show the status-specific icon (e.g. checkmark for resolved) */
  showIcon?: boolean
}

/**
 * Unified ticket status tag component.
 * Renders a styled Tag with the correct color variant and optional icon
 * for any ticket status value from any layer (backend, dialog, chat).
 */
export function TicketStatusTag({
  status,
  label,
  className,
  showIcon = true,
}: TicketStatusTagProps) {
  const config = getTicketStatusConfig(status)

  return (
    <Tag
      label={label ?? config.label}
      variant={config.variant}
      icon={showIcon ? config.icon : undefined}
      className={cn('shrink-0 w-fit', className)}
    />
  )
}
