/**
 * ScriptArguments Component
 *
 * Displays and manages script arguments as key-value pairs.
 * Each argument has a name (key) and value input field with delete button.
 * Includes an "Add Script Argument" button to add new entries.
 */

import { PlusCircle, Trash2 } from 'lucide-react'
import React from 'react'
import { cn } from '../../utils/cn'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Label } from '../ui/label'

/**
 * Single script argument with key and value
 */
export interface ScriptArgument {
  /** Unique identifier for the argument */
  id: string
  /** Argument name/key */
  key: string
  /** Argument value (empty string for flag-type arguments) */
  value: string
}

/**
 * Props for ScriptArguments component
 */
export interface ScriptArgumentsProps {
  /** Array of script arguments */
  arguments: ScriptArgument[]
  /** Callback when arguments change */
  onArgumentsChange?: (args: ScriptArgument[]) => void
  /** Placeholder for key input */
  keyPlaceholder?: string
  /** Placeholder for value input */
  valuePlaceholder?: string
  /** Label for the add button */
  addButtonLabel?: string
  /** Whether the component is disabled */
  disabled?: boolean
  /** Additional CSS classes */
  className?: string
  /** Label for the title input */
  titleLabel: string
}

/**
 * ScriptArguments - Displays and manages script arguments
 *
 * @example
 * ```tsx
 * <ScriptArguments
 *   arguments={[
 *     { id: '1', key: 'port', value: '3000' },
 *     { id: '2', key: 'verbose', value: '' },
 *   ]}
 *   onArgumentsChange={(args) => setArguments(args)}
 * />
 * ```
 */
export const ScriptArguments: React.FC<ScriptArgumentsProps> = ({
  arguments: args,
  onArgumentsChange,
  keyPlaceholder = 'Enter Key',
  valuePlaceholder = 'Enter Value (empty=flag)',
  addButtonLabel = 'Add Script Argument',
  disabled = false,
  className,
  titleLabel
}) => {
  const handleKeyChange = (id: string, newKey: string) => {
    if (!onArgumentsChange) return
    const updated = args.map((arg) =>
      arg.id === id ? { ...arg, key: newKey } : arg
    )
    onArgumentsChange(updated)
  }

  const handleValueChange = (id: string, newValue: string) => {
    if (!onArgumentsChange) return
    const updated = args.map((arg) =>
      arg.id === id ? { ...arg, value: newValue } : arg
    )
    onArgumentsChange(updated)
  }

  const handleDelete = (id: string) => {
    if (!onArgumentsChange) return
    const updated = args.filter((arg) => arg.id !== id)
    onArgumentsChange(updated)
  }

  const handleAdd = () => {
    if (!onArgumentsChange) return
    const newArg: ScriptArgument = {
      id: crypto.randomUUID(),
      key: '',
      value: ''
    }
    onArgumentsChange([...args, newArg])
  }

  const isFirstRow = (index: number) => index === 0

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      {args.map((arg, index) => (
        <div
          key={arg.id}
          className="flex gap-2 items-end w-full"
        >
          {/* Key input - with label only on first row */}
          <div className="flex flex-1 flex-col gap-1 min-w-0">
            {isFirstRow(index) && (
              <Label spacing="tight">{titleLabel}</Label>
            )}
            <Input
              value={arg.key}
              onChange={(e) => handleKeyChange(arg.id, e.target.value)}
              placeholder={keyPlaceholder}
              disabled={disabled}
            />
          </div>

          {/* Value input with delete button */}
          {/* Value input with delete button */}
          <div className="flex flex-1 gap-2 items-center min-w-0">
            <div className="flex flex-1 flex-col gap-1 min-w-0">
              <Input
                value={arg.value}
                onChange={(e) => handleValueChange(arg.id, e.target.value)}
                placeholder={valuePlaceholder}
                disabled={disabled}
                className={cn(
                  !arg.value && 'placeholder:text-[#888]'
                )}
              />
            </div>
            <Button
              type="button"
              variant="card"
              size="icon"
              onClick={() => handleDelete(arg.id)}
              disabled={disabled}
              aria-label="Delete argument"
              centerIcon={<Trash2 className="size-4 sm:size-6 " color="var(--ods-attention-red-error)" />}
            />
          </div>
        </div>
      ))}

      {/* Add button - aligned left */}
      <div className="flex justify-start">
        <Button
          type="button"
          variant="ghost-subtle"
          className="text-ods-text-primary"
          onClick={handleAdd}
          disabled={disabled}
          leftIcon={<PlusCircle className="size-6" />}
          noPadding
        >
          {addButtonLabel}
        </Button>
      </div>
    </div>
  )
}

ScriptArguments.displayName = 'ScriptArguments'
