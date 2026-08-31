'use client';

import { type ReactNode, useId } from 'react';
import { useDragAndDropEnabled } from '../../hooks/ui/use-drag-and-drop-enabled';
import { cn } from '../../utils/cn';
import type { SortableDragHandleProps } from '../features/sortable-list/use-sortable-item';
import { DraggerIcon } from '../icons-v2-generated/interface/dragger-icon';
import { TrashIcon } from '../icons-v2-generated/interface/trash-icon';
import { InfoCircleIcon } from '../icons-v2-generated/signs-and-symbols/info-circle-icon';
import { Button } from './button';
import { ColorPresetSelect, ColorPickerInput } from './color-preset-select';
import { Input } from './input';
import { Label } from './label';
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
  /** From `useSortableItem` (via `TicketStatusConfigList`'s render args). */
  dragHandleProps?: SortableDragHandleProps;
  isDragging?: boolean;
  /**
   * The touch replacement for the drag handle (`SortableRowRenderArgs.moveButtons`).
   * Rendered beside the delete button; the drag rail is hidden on touch anyway.
   */
  moveButtons?: ReactNode;
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
  isDragging,
  moveButtons,
}: TicketStatusConfigRowProps) {
  // Standalone system rows render outside any SortableList, so the row answers
  // "is there a drag rail at all?" itself — same media gate the list uses.
  const dragAndDropEnabled = useDragAndDropEnabled();
  const nameInputId = useId();
  const isSystem = variant === 'system';
  const isCustomColor = !isSystem && presetKey === undefined;
  const previewColor = isSystem ? undefined : color;
  const showColorPicker = !isSystem && onColorChange && color !== undefined;
  // Custom rows render as filled pills (no border); system rows take the
  // page-configured variant (outline/primary). text-h5 already uppercases.
  const previewVariant: SystemTagVariant | undefined = systemTagVariant ?? (isSystem ? undefined : 'primary');

  // The fields carry a visible label, so everything that sits beside the
  // 44/48px field row (rail, chip, controls) drops below the label line by
  // exactly its height: the h4 line + the label's mb-1.
  const fieldRowOffset = 'mt-[calc(var(--font-line-space-h4-body)+0.25rem)]';

  const chip = (
    <TicketStatusTag
      status={statusKey}
      label={name || ' '}
      color={previewColor}
      variant={previewVariant}
      showIcon={isSystem}
      className="max-w-full"
    />
  );

  return (
    <div
      className={cn(
        // Transparent background — only the border outlines the row.
        'flex w-full items-start gap-3 rounded-md border border-ods-border md:gap-[var(--spacing-system-m)]',
        'p-[var(--spacing-system-m)]',
        // The dragged row travels over its siblings, so it needs an opaque back.
        isDragging && 'bg-ods-bg opacity-70 shadow-lg',
      )}
    >
      {dragAndDropEnabled && (
        <div
          className={cn(
            'flex h-11 w-8 shrink-0 items-center justify-center text-ods-text-secondary md:h-12',
            fieldRowOffset,
          )}
        >
          {isSystem ? (
            <DraggerIcon size={24} aria-hidden className="opacity-40" />
          ) : (
            <button
              type="button"
              aria-label="Drag to reorder"
              className="flex size-6 cursor-grab items-center justify-center rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ods-focus active:cursor-grabbing"
              {...dragHandleProps}
            >
              <DraggerIcon size={24} />
            </button>
          )}
        </div>
      )}

      {/* Every row spans the same equal column slots — two on tablet
          (name + color for custom, name + chip for system), four on desktop
          (name, color, a reserved slot, chip zone) with invisible spacers
          standing in for the cells a row doesn't use — so the name field is one
          width on every row and the columns align across the whole list.
          The trailing controls are a WRAP ITEM (ordered per breakpoint), not a
          full-height sibling column, so the lower rows span the full card width
          and the chip pins to the card's right edge on tablet/mobile. */}
      <div
        className={cn(
          'min-w-0 flex-1 items-start gap-x-3 gap-y-[var(--spacing-system-m)] md:gap-x-[var(--spacing-system-m)]',
          isSystem
            ? 'flex flex-wrap'
            : // Mobile custom rows are a strict two-column grid, per the mock:
              // fields (name / color / hex, all one width) on the left, the
              // controls and the chip stacked in the right column. From md up
              // the same children flow as a wrapping flex row.
              'grid grid-cols-[minmax(0,1fr)_auto] md:flex md:flex-wrap',
        )}
      >
        {/* System rows keep the chip beside the name on every width, so the name
            shares its row. */}
        <div className="order-1 flex min-w-0 grow basis-0 flex-col gap-[var(--spacing-system-xxs)]">
          <Label variant="large" htmlFor={nameInputId}>
            Status Name
          </Label>
          <Input
            id={nameInputId}
            value={name}
            onChange={e => onNameChange?.(e.target.value)}
            disabled={isSystem}
            readOnly={isSystem}
            maxLength={50}
          />
        </div>

        {showColorPicker ? (
          <div className="order-3 flex min-w-0 grow basis-full flex-col gap-[var(--spacing-system-xxs)] md:order-2 md:basis-0">
            <Label variant="large">Color</Label>
            <ColorPresetSelect value={color} presetKey={presetKey} onChange={onColorChange} />
            {/* Custom hex: a second field row inside the Color column, directly
                under the select (per design). */}
            {isCustomColor && (
              <div className="mt-[var(--spacing-system-xxs)] flex min-w-0">
                <ColorPickerInput value={color} onChange={next => onColorChange({ color: next, preset: undefined })} />
              </div>
            )}
          </div>
        ) : (
          <div aria-hidden className="hidden min-w-0 grow basis-0 lg:order-2 lg:block" />
        )}

        {/* Reserved desktop column slot (the mock's "No activity Indicator" zone). */}
        <div aria-hidden className="hidden min-w-0 grow basis-0 lg:order-3 lg:block" />

        {isSystem ? (
          <div
            className={cn(
              'order-2 flex h-11 min-w-0 grow basis-0 items-center justify-end md:h-12 lg:order-4',
              fieldRowOffset,
            )}
          >
            {chip}
          </div>
        ) : (
          <>
            {/* Desktop (lg+): the chip rides the first row, in its own column
                before the controls. */}
            <div
              className={cn(
                'hidden h-12 min-w-0 grow basis-0 items-center justify-end lg:order-4 lg:flex',
                fieldRowOffset,
              )}
            >
              {chip}
            </div>
            {/* Tablet: the chip takes a full row of its own, pinned to the
                card's right edge (the controls above no longer narrow it). */}
            <div className="hidden min-w-0 basis-full items-center justify-end md:order-4 md:flex lg:hidden">
              {chip}
            </div>
            {/* Mobile: the chip fills the second grid column beside the color
                field, left-aligned with the controls above it. */}
            <div className={cn('order-4 flex h-11 min-w-0 items-center md:hidden', fieldRowOffset)}>{chip}</div>
          </>
        )}

        <div
          className={cn(
            'flex h-11 shrink-0 items-center justify-end gap-[var(--spacing-system-s)] md:h-12 lg:order-5',
            isSystem ? 'order-3' : 'order-2 md:order-3',
            fieldRowOffset,
          )}
        >
          {!isSystem && moveButtons}
          {isSystem ? (
            <div className="flex w-11 justify-center md:w-12">
              <TouchFriendlyTooltip content={systemTooltip}>
                <button
                  type="button"
                  aria-label={systemTooltip ?? 'System status'}
                  className="flex size-6 items-center justify-center text-ods-text-secondary outline-none focus-visible:ring-2 focus-visible:ring-ods-focus"
                >
                  <InfoCircleIcon size={24} />
                </button>
              </TouchFriendlyTooltip>
            </div>
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
    </div>
  );
}
