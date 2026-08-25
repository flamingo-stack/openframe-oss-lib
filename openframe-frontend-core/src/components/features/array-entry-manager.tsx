'use client';

import { Trash2, Plus, Save, Loader2 } from 'lucide-react';
import { useState, useEffect, type ReactNode, type ClipboardEvent } from 'react';
import { Button, Input, Label } from '../ui';

interface ArrayEntryManagerProps<T extends object> {
  title: ReactNode; // Support string or ReactNode for badge integration
  items: T[];
  /**
   * Called with the committed items. May be async: in `requireSave` mode the
   * save button awaits it before clearing the dirty flag, so a consumer that
   * persists over the network keeps the unsaved-changes indicator lit until the
   * write settles. Declaring plain `void` here made that `await` a no-op on
   * paper while real callers were already passing async handlers.
   */
  onChange: (items: T[]) => void | Promise<void>;
  fieldKey: keyof T; // The key to edit (e.g., 'github_release_url', 'kb_article_path')
  placeholder: string;
  emptyMessage: string;
  addButtonText: string;
  saveButtonText?: string; // Text for save button when requireSave=true
  icon?: ReactNode;
  className?: string;
  requireSave?: boolean; // If true, show "Save" button and only call onChange when clicked
  onDirtyChange?: (isDirty: boolean) => void; // Callback when dirty state changes
  renderLabel?: (item: T, index: number) => ReactNode; // Custom label/badge renderer for each entry
  isSaving?: boolean; // Loading state for save button
}

export function ArrayEntryManager<T extends object>({
  title,
  items,
  onChange,
  fieldKey,
  placeholder,
  emptyMessage,
  addButtonText,
  saveButtonText = 'Save Changes',
  icon,
  className = '',
  requireSave = false,
  onDirtyChange,
  renderLabel,
  isSaving = false,
}: ArrayEntryManagerProps<T>) {
  // Local state for draft changes (when requireSave=true)
  const [draftItems, setDraftItems] = useState<T[]>(items);
  const [isDirty, setIsDirty] = useState(false);

  // Sync draft with props when items change from parent (but NOT when editing or
  // saving). Adjusted while rendering — React's documented prop-sync pattern —
  // rather than from an effect: the rows are drawn from `draftItems`, so a
  // parent refresh committed one frame of the OLD list before replacing it.
  const [syncedFrom, setSyncedFrom] = useState({ items, isDirty, isSaving });
  if (syncedFrom.items !== items || syncedFrom.isDirty !== isDirty || syncedFrom.isSaving !== isSaving) {
    setSyncedFrom({ items, isDirty, isSaving });
    if (!isDirty && !isSaving) {
      setDraftItems(items);
    }
  }

  // Notify parent when dirty state changes
  useEffect(() => {
    if (onDirtyChange) {
      onDirtyChange(isDirty);
    }
  }, [isDirty, onDirtyChange]);

  // `onChange` may be async (see the prop docs). Only the save button awaits it;
  // every other call site commits optimistically, so route them through here to
  // surface a rejection rather than leave it unhandled.
  const commit = (next: T[]) => {
    void Promise.resolve(onChange(next)).catch((err: unknown) => {
      console.error('[ArrayEntryManager] onChange failed:', err);
    });
  };

  const workingItems = requireSave ? draftItems : items;
  const setWorkingItems = requireSave
    ? (newItems: T[]) => {
        setDraftItems(newItems);
        setIsDirty(true);
      }
    : commit;

  const addItem = () => {
    const newItem = { [fieldKey]: '' } as T;
    setWorkingItems([newItem, ...workingItems]); // Add at top for better UX
  };

  const removeItem = (index: number) => {
    setWorkingItems(workingItems.filter((_, i) => i !== index));
  };

  const updateItem = (index: number, value: string) => {
    const updated = [...workingItems];
    updated[index] = { ...updated[index], [fieldKey]: value };
    setWorkingItems(updated);
  };

  const handleSave = async () => {
    await onChange(draftItems);
    setIsDirty(false); // Reset after save completes
  };

  // Handle paste of multiple IDs separated by newlines
  const handlePaste = (index: number, e: ClipboardEvent<HTMLInputElement>) => {
    const pastedText = e.clipboardData.getData('text');

    // Split by newlines (handles \n, \r\n, \r)
    const lines = pastedText
      .split(/[\r\n]+/)
      .map(line => line.trim())
      .filter(line => line.length > 0);

    // If only one line, let default paste behavior handle it
    if (lines.length <= 1) {
      return;
    }

    // Prevent default paste for multi-line
    e.preventDefault();

    const currentItem = items[index];
    const currentValue = (currentItem[fieldKey] as string) || '';

    // Build new items array
    const newItems = [...items];

    if (currentValue.trim() === '') {
      // If current field is empty, use first pasted value for it
      newItems[index] = { ...newItems[index], [fieldKey]: lines[0] };

      // Add remaining lines as new items after current index
      const additionalItems = lines.slice(1).map(line => ({ [fieldKey]: line }) as T);
      newItems.splice(index + 1, 0, ...additionalItems);
    } else {
      // If current field has value, add all pasted lines as new items after current
      const additionalItems = lines.map(line => ({ [fieldKey]: line }) as T);
      newItems.splice(index + 1, 0, ...additionalItems);
    }

    commit(newItems);
  };

  return (
    <div className={`space-y-3 ${className}`}>
      <div className="flex items-center justify-between">
        <Label>{title}</Label>
        <div className="flex items-center gap-2">
          {requireSave && isDirty && (
            <Button
              type="button"
              size="small-legacy"
              onClick={handleSave}
              disabled={isSaving}
              leftIcon={isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              className="bg-ods-accent text-ods-text-on-accent text-h6 hover:bg-ods-accent-hover"
            >
              {isSaving ? 'Saving...' : saveButtonText}
            </Button>
          )}
          <Button
            type="button"
            variant="outline"
            size="small-legacy"
            onClick={addItem}
            leftIcon={<Plus className="h-4 w-4" />}
            className="text-h6"
          >
            {addButtonText}
          </Button>
        </div>
      </div>

      {workingItems.map((item, index) => (
        <div key={index} className="flex items-center gap-3 rounded-lg border border-ods-border bg-ods-bg-surface p-3">
          {icon && <div className="flex h-8 w-8 items-center justify-center">{icon}</div>}

          <div className="flex-1 space-y-2">
            {renderLabel && renderLabel(item, index)}
            <Input
              placeholder={placeholder}
              value={item[fieldKey] as string}
              onChange={e => updateItem(index, e.target.value)}
              onKeyDown={e => e.key === 'Enter' && e.preventDefault()}
              onPaste={e => handlePaste(index, e)}
              className="border-ods-border bg-ods-bg text-ods-text-primary"
            />
          </div>

          <Button
            type="button"
            variant="transparent"
            size="icon"
            onClick={() => removeItem(index)}
            className="text-ods-error hover:bg-ods-error-secondary"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ))}

      {workingItems.length === 0 && (
        <div className="rounded-lg border border-ods-border bg-ods-bg-surface px-4 py-4 text-center">
          <p className="text-ods-text-secondary text-h6">{emptyMessage}</p>
        </div>
      )}
    </div>
  );
}
