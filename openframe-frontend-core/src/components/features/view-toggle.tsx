'use client';

import { cn } from '../../utils/cn';
import { GridViewIcon } from '../icons-v2-generated/interface/grid-view-icon';
import { TableViewIcon } from '../icons-v2-generated/interface/table-view-icon';
import { ToggleGroup, ToggleGroupItem } from '../ui';

const VIEW_MODES = ['grid', 'table'] as const;
type ViewMode = (typeof VIEW_MODES)[number];

/** The toggle reports a plain string (empty when the active option is clicked again). */
function isViewMode(value: string): value is ViewMode {
  return (VIEW_MODES as readonly string[]).includes(value);
}

interface ViewToggleProps {
  /**
   * Current selected view mode
   */
  value: ViewMode;
  /**
   * Callback fired when view mode changes
   */
  onValueChange: (value: ViewMode) => void;
  /**
   * Whether the toggle is disabled
   */
  disabled?: boolean;
  /**
   * Additional CSS classes for the toggle group
   */
  className?: string;
  /**
   * Size of the toggle buttons
   */
  size?: 'default' | 'sm' | 'lg';
  /**
   * Custom ARIA label for accessibility
   */
  'aria-label'?: string;
}

/**
 * ViewToggle - A 2-state button component for switching between grid and table views
 *
 * Built on top of Radix UI ToggleGroup for accessibility and proper keyboard navigation.
 * Uses ODS design tokens for consistent theming across platforms.
 *
 * @example
 * ```tsx
 * const [viewMode, setViewMode] = useState<'grid' | 'table'>('table')
 *
 * <ViewToggle
 *   value={viewMode}
 *   onValueChange={setViewMode}
 *   className="bg-ods-card border border-ods-border"
 * />
 * ```
 */
export function ViewToggle({
  value,
  onValueChange,
  disabled = false,
  className,
  size = 'default',
  'aria-label': ariaLabel = 'Switch between grid and table view',
}: ViewToggleProps) {
  return (
    <ToggleGroup
      type="single"
      value={value}
      onValueChange={(newValue: string) => {
        // Only update if we have a valid value (user clicked a different option)
        if (isViewMode(newValue) && newValue !== value) {
          onValueChange(newValue);
        }
      }}
      className={cn('flex rounded-[6px] border border-ods-border bg-ods-card p-1', className)}
      disabled={disabled}
      aria-label={ariaLabel}
    >
      <ToggleGroupItem
        value="grid"
        size={size}
        className={cn(
          'rounded p-2 transition-all duration-200',
          value === 'grid'
            ? 'bg-ods-accent text-ods-text-on-accent'
            : 'text-ods-text-secondary hover:bg-ods-bg-hover hover:text-ods-text-primary',
          disabled && 'cursor-not-allowed opacity-50',
        )}
        aria-label="Grid view"
        disabled={disabled}
      >
        <GridViewIcon
          className="h-5 w-5"
          color={
            disabled
              ? 'var(--ods-system-greys-grey)'
              : value === 'grid'
                ? 'var(--ods-system-greys-black)'
                : 'var(--ods-system-greys-grey)'
          }
        />
      </ToggleGroupItem>

      <ToggleGroupItem
        value="table"
        size={size}
        className={cn(
          'rounded p-2 transition-all duration-200',
          value === 'table'
            ? 'bg-ods-accent text-ods-text-on-accent'
            : 'text-ods-text-secondary hover:bg-ods-bg-hover hover:text-ods-text-primary',
          disabled && 'cursor-not-allowed opacity-50',
        )}
        aria-label="Table view"
        disabled={disabled}
      >
        <TableViewIcon
          className="h-5 w-5"
          color={
            disabled
              ? 'var(--ods-system-greys-grey)'
              : value === 'table'
                ? 'var(--ods-system-greys-black)'
                : 'var(--ods-system-greys-grey)'
          }
        />
      </ToggleGroupItem>
    </ToggleGroup>
  );
}

// Type exports for consumers
export type { ViewMode, ViewToggleProps };
