/**
 * ScriptArguments Component
 *
 * Displays and manages script arguments as key-value pairs.
 * Each argument has a name (key) and value input field with delete button.
 * Includes an "Add Script Argument" button to add new entries.
 */

import { Trash2 } from 'lucide-react';
import type React from 'react';
import { cn } from '../../utils/cn';
import { LockIcon, PlusCircleIcon } from '../icons-v2-generated';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';

/**
 * What an untouched stored secret shows in its value field.
 *
 * Rendered as the field's PLACEHOLDER, never as its value: a mask held in
 * `value` is indistinguishable from something the user typed, and would be
 * submitted back as the secret itself.
 */
const SECRET_MASK = '**********';

const STORED_SECRET_KEY_HINT = "A stored secret can't be renamed — delete it and add a new one";

/**
 * Single script argument with key and value
 */
export interface ScriptArgument {
  /** Unique identifier for the argument */
  id: string;
  /** Argument name/key */
  key: string;
  /** Argument value (empty string for flag-type arguments) */
  value: string;
  /**
   * A secret pair: the key carries a lock and the value is typed as a password.
   * Meaningful for environment variables only.
   */
  secret?: boolean;
  /**
   * The server holds a value for this secret and does not send it back. While
   * `value` is empty the field shows a mask, so empty means "keep what is
   * stored" and typing replaces it.
   *
   * The stored value is bound to the key, which is therefore read-only:
   * renaming would leave the old name holding the secret and the new one
   * holding nothing.
   */
  hasStoredValue?: boolean;
}

/**
 * Props for ScriptArguments component
 */
export interface ScriptArgumentsProps {
  /** Array of script arguments */
  arguments: ScriptArgument[];
  /** Callback when arguments change */
  onArgumentsChange?: (args: ScriptArgument[]) => void;
  /** Placeholder for key input */
  keyPlaceholder?: string;
  /** Placeholder for value input */
  valuePlaceholder?: string;
  /** Label for the add button */
  addButtonLabel?: string;
  /** Label for a second add button that appends a secret pair. Omit to not offer secrets. */
  addSecretButtonLabel?: string;
  /** Whether the component is disabled */
  disabled?: boolean;
  /** Additional CSS classes */
  className?: string;
  /** Label for the title input */
  titleLabel: string;
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
  addSecretButtonLabel,
  disabled = false,
  className,
  titleLabel,
}) => {
  const handleKeyChange = (id: string, newKey: string) => {
    if (!onArgumentsChange) return;
    const updated = args.map(arg => (arg.id === id ? { ...arg, key: newKey } : arg));
    onArgumentsChange(updated);
  };

  const handleValueChange = (id: string, newValue: string) => {
    if (!onArgumentsChange) return;
    const updated = args.map(arg => (arg.id === id ? { ...arg, value: newValue } : arg));
    onArgumentsChange(updated);
  };

  const handleDelete = (id: string) => {
    if (!onArgumentsChange) return;
    const updated = args.filter(arg => arg.id !== id);
    onArgumentsChange(updated);
  };

  const handleAdd = (secret = false) => {
    if (!onArgumentsChange) return;
    const newArg: ScriptArgument = {
      id: crypto.randomUUID(),
      key: '',
      value: '',
      // Only set on a secret, so a plain pair keeps the shape it always had.
      ...(secret && { secret: true }),
    };
    onArgumentsChange([...args, newArg]);
  };

  const isFirstRow = (index: number) => index === 0;

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      {args.map((arg, index) => {
        const isStoredSecret = Boolean(arg.secret && arg.hasStoredValue);
        // The mask stands for the stored value, so it goes once the user types a replacement.
        const showsMask = isStoredSecret && !arg.value;

        return (
          <div key={arg.id} className="flex w-full items-end gap-2">
            {/* Key input - with label only on first row */}
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              {isFirstRow(index) && <Label spacing="tight">{titleLabel}</Label>}
              <Input
                value={arg.key}
                onChange={e => handleKeyChange(arg.id, e.target.value)}
                placeholder={keyPlaceholder}
                disabled={disabled}
                readOnly={isStoredSecret}
                title={isStoredSecret ? STORED_SECRET_KEY_HINT : undefined}
                startAdornment={arg.secret ? <LockIcon role="img" aria-label="Secret" /> : undefined}
              />
            </div>

            {/* Value input with delete button */}
            <div className="flex min-w-0 flex-1 items-center gap-2">
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <Input
                  // `new-password` keeps a password manager from filling a saved login into a secret.
                  type={arg.secret ? 'password' : undefined}
                  autoComplete={arg.secret ? 'new-password' : undefined}
                  value={arg.value}
                  onChange={e => handleValueChange(arg.id, e.target.value)}
                  placeholder={showsMask ? SECRET_MASK : valuePlaceholder}
                  disabled={disabled}
                  className={cn(
                    !arg.value && 'placeholder:text-ods-text-muted',
                    // The mask reads as a value that is there, not as a prompt to fill one in.
                    showsMask && '[&_input]:placeholder:text-ods-text-primary',
                  )}
                />
              </div>
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => handleDelete(arg.id)}
                disabled={disabled}
                aria-label="Delete argument"
                leftIcon={<Trash2 className="size-4 md:size-6" color="var(--color-error)" />}
              />
            </div>
          </div>
        );
      })}

      {/* Add buttons - aligned left */}
      <div className="flex flex-wrap justify-start gap-[var(--spacing-system-xs)]">
        <Button
          type="button"
          variant="outline"
          size="small"
          onClick={() => handleAdd()}
          disabled={disabled}
          className="self-start"
          leftIcon={<PlusCircleIcon className="text-ods-text-secondary" />}
        >
          {addButtonLabel}
        </Button>
        {addSecretButtonLabel && (
          <Button
            type="button"
            variant="outline"
            size="small"
            onClick={() => handleAdd(true)}
            disabled={disabled}
            className="self-start"
            leftIcon={<LockIcon className="text-ods-text-secondary" />}
          >
            {addSecretButtonLabel}
          </Button>
        )}
      </div>
    </div>
  );
};

ScriptArguments.displayName = 'ScriptArguments';
