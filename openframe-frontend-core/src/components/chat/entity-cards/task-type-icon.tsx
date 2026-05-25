'use client'

/**
 * Per-type icon for a ClickUp task — driven by `custom_item_id` via the
 * canonical `CUSTOM_ITEM_ID` map in `../utils/clickup-task-type-utils`.
 *
 * Used by the roadmap entity card so the icon slot communicates the
 * task TYPE (Bug, Feature, Story, …) at a glance instead of falling
 * back to a generic logo / two-letter placeholder.
 */

import React from 'react'
import {
  Bug,
  Inbox,
  Sparkles,
  BookOpen,
  Trophy,
  Component,
  Flag,
  Goal,
  ListTodo,
  CheckSquare,
  FileText,
  Repeat,
  Compass,
  type LucideIcon,
} from 'lucide-react'
import { CUSTOM_ITEM_ID } from '../utils/clickup-task-type-utils'

function iconFor(customItemId: number | null | undefined): LucideIcon {
  switch (customItemId) {
    case CUSTOM_ITEM_ID.BUG:        return Bug
    case CUSTOM_ITEM_ID.REQUEST:    return Inbox
    case CUSTOM_ITEM_ID.FEATURE:    return Sparkles
    case CUSTOM_ITEM_ID.STORY:      return BookOpen
    case CUSTOM_ITEM_ID.EPIC:       return Trophy
    case CUSTOM_ITEM_ID.COMPONENT:  return Component
    case CUSTOM_ITEM_ID.INITIATIVE: return Flag
    case CUSTOM_ITEM_ID.MILESTONE:  return Goal
    case CUSTOM_ITEM_ID.SUBTASK:    return ListTodo
    case CUSTOM_ITEM_ID.FORM:       return FileText
    case CUSTOM_ITEM_ID.RECURRING:  return Repeat
    case CUSTOM_ITEM_ID.PLAN:       return Compass
    case CUSTOM_ITEM_ID.STRATEGY:   return Compass
    case CUSTOM_ITEM_ID.TASK:
    default:
      return CheckSquare
  }
}

export interface TaskTypeIconProps {
  customItemId: number | null | undefined
  className?: string
}

export function TaskTypeIcon({ customItemId, className = 'h-5 w-5' }: TaskTypeIconProps) {
  const Icon = iconFor(customItemId)
  return <Icon className={className} aria-hidden="true" />
}
