'use client';

import type { DraggableAttributes, DraggableSyntheticListeners } from '@dnd-kit/core';
import { cn } from '../../utils/cn';
import { DraggerIcon } from '../icons-v2-generated/interface/dragger-icon';
import { TrashIcon } from '../icons-v2-generated/interface/trash-icon';
import { InfoCircleIcon } from '../icons-v2-generated/signs-and-symbols/info-circle-icon';
import { Button } from './button';
import { ColorPresetSelect, ColorPickerInput } from './color-preset-select';
import { Input } from './input';
import type { TagProps } from './tag';
import { TicketStatusTag } from './ticket-status-tag';
import { TouchFriendlyTooltip } from './touch-friendly-tooltip';

type SystemTagVariant = Extract<TagProps['variant'], 'outline' | 'primary'>;

export interface TicketStatusConfigRowProps {
  variant: 'system' | 'custom';
  /**
   * Canonical ticket-status key for system rows (e.g. 'ACTIVE', 'RESOLVED'),
   * or the row's unique id for custom rows. Forwarded to TicketStatusTag.
   */
  statusKey: string;
  name: string;
  onNameChange?: (value: string) => void;
  color?: string;
  presetKey?: string;
  onColorChange?: (next: { color: string; preset?: string }) => void;
  systemTooltip?: string;
  systemTagVariant?: SystemTagVariant;
  onDelete?: () => void;
  deleteDisabled?: boolean;
  deleteDisabledReason?: string;
  dragHandleProps?: DraggableSyntheticListeners;
  dragHandleAttributes?: DraggableAttributes;
  isDragging?: boolean;
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
  const isSystem = variant === 'system';
  const isCustomColor = !isSystem && presetKey === undefined;
  const previewColor = isSystem ? undefined : color;
  const showColorPicker = !isSystem && onColorChange && color !== undefined;
  // Custom rows render as filled pills (no border); system rows take the
  // page-configured variant (outline/primary). text-h5 already uppercases.
  const previewVariant: SystemTagVariant | undefined = systemTagVariant ?? (isSystem ? undefined : 'primary');
  const colClass = 'min-w-0 grow basis-[calc(50%-6px)] md:basis-0';

  return (
    <div
      className={cn(
        'flex w-full items-start gap-3 rounded-md border border-ods-border bg-ods-card md:gap-[var(--spacing-system-m)]',
        'p-[var(--spacing-system-m)]',
        isDragging && 'opacity-70 shadow-lg',
      )}
    >
      <div className="flex h-11 w-8 shrink-0 items-center justify-center text-ods-text-secondary md:h-12">
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

      <div className="flex min-w-0 flex-1 flex-wrap items-start gap-x-3 gap-y-4 md:flex-nowrap md:gap-[var(--spacing-system-m)]">
        <div className={cn('flex flex-col gap-[var(--spacing-system-xxs)]', colClass)}>
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
          <div className={cn('flex', colClass)}>
            <ColorPresetSelect value={color} presetKey={presetKey} onChange={onColorChange} />
          </div>
        ) : (
          <div aria-hidden className={cn('hidden md:block', colClass)} />
        )}

        {showColorPicker && isCustomColor ? (
          <div className={cn('flex', colClass)}>
            <ColorPickerInput value={color} onChange={next => onColorChange({ color: next, preset: undefined })} />
          </div>
        ) : (
          <div aria-hidden className={cn('hidden md:block', colClass)} />
        )}

        <div className={cn('flex h-11 items-center justify-start md:h-12 md:justify-end', colClass)}>
          <TicketStatusTag
            status={statusKey}
            label={name || ' '}
            color={previewColor}
            variant={previewVariant}
            showIcon={isSystem}
            className="max-w-full"
          />
        </div>
      </div>

      <div className="flex h-11 w-12 shrink-0 items-center justify-center md:h-12">
        {isSystem ? (
          <TouchFriendlyTooltip content={systemTooltip}>
            <button
              type="button"
              aria-label={systemTooltip ?? 'System status'}
              className="flex size-6 items-center justify-center text-ods-text-secondary outline-none focus-visible:ring-2 focus-visible:ring-ods-focus"
            >
              <InfoCircleIcon size={24} />
            </button>
          </TouchFriendlyTooltip>
        ) : (
          <TouchFriendlyTooltip content={deleteDisabled ? deleteDisabledReason : undefined}>
            <span className="inline-flex">
              <Button
                type="button"
                variant="outline"
                size="icon"
                aria-label="Delete status"
                disabled={deleteDisabled}
                onClick={deleteDisabled ? undefined : onDelete}
                className={cn('size-11 md:size-12', deleteDisabled && 'pointer-events-none')}
              >
                <TrashIcon className="text-ods-error" />
              </Button>
            </span>
          </TouchFriendlyTooltip>
        )}
      </div>
    </div>
  );
}
