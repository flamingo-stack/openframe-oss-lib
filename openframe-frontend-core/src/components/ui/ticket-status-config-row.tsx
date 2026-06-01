'use client'

import type { DraggableAttributes, DraggableSyntheticListeners } from '@dnd-kit/core'
import * as React from 'react'
import { cn } from '../../utils/cn'
import { DraggerIcon } from '../icons-v2-generated/interface/dragger-icon'
import { TrashIcon } from '../icons-v2-generated/interface/trash-icon'
import { InfoCircleIcon } from '../icons-v2-generated/signs-and-symbols/info-circle-icon'
import { Button } from './button'
import { ColorPresetSelect, ColorPickerInput } from './color-preset-select'
import { Input } from './input'
import { type TagProps } from './tag'
import { TicketStatusTag } from './ticket-status-tag'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './tooltip'

type SystemTagVariant = Extract<TagProps['variant'], 'outline' | 'primary'>

export interface TicketStatusConfigRowProps {
  variant: 'system' | 'custom'
  /**
   * Canonical ticket-status key for system rows (e.g. 'ACTIVE', 'RESOLVED'),
   * or the row's unique id for custom rows. Forwarded to TicketStatusTag.
   */
  statusKey: string
  name: string
  onNameChange?: (value: string) => void
  color?: string
  presetKey?: string
  onColorChange?: (next: { color: string; preset?: string }) => void
  systemTooltip?: string
  systemTagVariant?: SystemTagVariant
  onDelete?: () => void
  deleteDisabled?: boolean
  deleteDisabledReason?: string
  dragHandleProps?: DraggableSyntheticListeners
  dragHandleAttributes?: DraggableAttributes
  isDragging?: boolean
}

function WithLeftTooltip({ content, children }: { content?: string; children: React.ReactElement }) {
  if (!content) return children
  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>{children}</TooltipTrigger>
        <TooltipContent side="left" className="max-w-xs">
          {content}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

export function TicketStatusConfigRow({
  variant,
  statusKey,
  name,
  onNameChange,
  color,
  presetKey,
  onColorChange,
  systemTooltip,
  systemTagVariant,
  onDelete,
  deleteDisabled,
  deleteDisabledReason,
  dragHandleProps,
  dragHandleAttributes,
  isDragging,
}: TicketStatusConfigRowProps) {
  const isSystem = variant === 'system'
  const isCustomColor = !isSystem && presetKey === undefined
  const previewColor = isSystem ? undefined : color
  const showColorPicker = !isSystem && onColorChange && color !== undefined
  // Custom rows render as filled pills (no border); system rows take the
  // page-configured variant (outline/primary). text-h5 already uppercases.
  const previewVariant: SystemTagVariant | undefined = systemTagVariant ?? (isSystem ? undefined : 'primary')

  return (
    <div
      className={cn(
        'flex w-full items-center gap-[var(--spacing-system-m)] rounded-md border border-ods-border bg-ods-card',
        'p-[var(--spacing-system-m)]',
        isDragging && 'opacity-70 shadow-lg',
      )}
    >
      <div className="flex size-8 shrink-0 items-center justify-center text-ods-text-secondary">
        {isSystem ? (
          <DraggerIcon size={24} aria-hidden className="opacity-40" />
        ) : (
          <button
            type="button"
            aria-label="Drag to reorder"
            className="flex size-6 cursor-grab items-center justify-center rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ods-focus active:cursor-grabbing"
            {...dragHandleAttributes}
            {...dragHandleProps}
          >
            <DraggerIcon size={24} />
          </button>
        )}
      </div>

      <div className="flex flex-1 min-w-0 flex-col gap-[var(--spacing-system-xxs)]">
        <Input
          value={name}
          onChange={e => onNameChange?.(e.target.value)}
          disabled={isSystem}
          readOnly={isSystem}
          aria-label="Status name"
          maxLength={50}
        />
      </div>

      {showColorPicker ? (
        <div className="flex flex-1 min-w-0">
          <ColorPresetSelect value={color} presetKey={presetKey} onChange={onColorChange} />
        </div>
      ) : (
        <div aria-hidden className="hidden flex-1 min-w-0 md:block" />
      )}

      {showColorPicker && isCustomColor ? (
        <div className="flex flex-1 min-w-0">
          <ColorPickerInput value={color} onChange={next => onColorChange({ color: next, preset: undefined })} />
        </div>
      ) : (
        <div aria-hidden className="hidden flex-1 min-w-0 md:block" />
      )}

      <div className="flex h-12 flex-1 min-w-0 items-center justify-end">
        <TicketStatusTag
          status={statusKey}
          label={name || ' '}
          color={previewColor}
          variant={previewVariant}
          showIcon={isSystem}
          className="max-w-full"
        />
      </div>

      <div className="flex size-12 shrink-0 items-center justify-center">
        {isSystem ? (
          <WithLeftTooltip content={systemTooltip}>
            <button
              type="button"
              aria-label={systemTooltip ?? 'System status'}
              className="flex size-6 items-center justify-center text-ods-text-secondary outline-none focus-visible:ring-2 focus-visible:ring-ods-focus"
            >
              <InfoCircleIcon size={24} />
            </button>
          </WithLeftTooltip>
        ) : (
          <WithLeftTooltip content={deleteDisabled ? deleteDisabledReason : undefined}>
            <span className="inline-flex">
              <Button
                type="button"
                variant="outline"
                size="icon"
                aria-label="Delete status"
                disabled={deleteDisabled}
                onClick={deleteDisabled ? undefined : onDelete}
                className="size-12"
              >
                <TrashIcon />
              </Button>
            </span>
          </WithLeftTooltip>
        )}
      </div>
    </div>
  )
}
