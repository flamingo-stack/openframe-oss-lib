"use client";

import { Button, Input, Label } from '../ui';
import { Trash2, Plus, LucideIcon } from 'lucide-react';
import { ReactNode, ClipboardEvent } from 'react';

interface ArrayEntryManagerProps<T extends { [key: string]: any }> {
  title: ReactNode; // Support string or ReactNode for badge integration
  items: T[];
  onChange: (items: T[]) => void;
  fieldKey: keyof T; // The key to edit (e.g., 'github_release_url', 'kb_article_path')
  placeholder: string;
  emptyMessage: string;
  addButtonText: string;
  icon?: ReactNode;
  className?: string;
}

export function ArrayEntryManager<T extends { [key: string]: any }>({
  title,
  items,
  onChange,
  fieldKey,
  placeholder,
  emptyMessage,
  addButtonText,
  icon,
  className = ''
}: ArrayEntryManagerProps<T>) {
  const addItem = () => {
    const newItem = { [fieldKey]: '' } as T;
    onChange([...items, newItem]);
  };

  const removeItem = (index: number) => {
    onChange(items.filter((_, i) => i !== index));
  };

  const updateItem = (index: number, value: string) => {
    const updated = [...items];
    updated[index] = { ...updated[index], [fieldKey]: value };
    onChange(updated);
  };

  // Handle paste of multiple IDs separated by newlines
  const handlePaste = (index: number, e: ClipboardEvent<HTMLInputElement>) => {
    const pastedText = e.clipboardData.getData('text');

    // Split by newlines (handles \n, \r\n, \r)
    const lines = pastedText.split(/[\r\n]+/).map(line => line.trim()).filter(line => line.length > 0);

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
      const additionalItems = lines.slice(1).map(line => ({ [fieldKey]: line } as T));
      newItems.splice(index + 1, 0, ...additionalItems);
    } else {
      // If current field has value, add all pasted lines as new items after current
      const additionalItems = lines.map(line => ({ [fieldKey]: line } as T));
      newItems.splice(index + 1, 0, ...additionalItems);
    }

    onChange(newItems);
  };

  return (
    <div className={`space-y-3 ${className}`}>
      <div className="flex items-center justify-between">
        <Label className="text-[14px] text-ods-text-primary">{title}</Label>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={addItem}
          leftIcon={<Plus className="h-4 w-4" />}
          className="font-['DM_Sans'] text-[14px]"
        >
          {addButtonText}
        </Button>
      </div>

      {items.map((item, index) => (
        <div key={index} className="flex items-center gap-3 p-3 bg-ods-bg-secondary rounded-lg border border-ods-border">
          {icon && (
            <div className="w-8 h-8 flex items-center justify-center">
              {icon}
            </div>
          )}

          <div className="flex-1">
            <Input
              placeholder={placeholder}
              value={item[fieldKey] as string}
              onChange={(e) => updateItem(index, e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && e.preventDefault()}
              onPaste={(e) => handlePaste(index, e)}
              className="bg-[#161616]"
            />
          </div>

          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => removeItem(index)}
            className="text-red-400 hover:text-red-300 hover:bg-red-400/10"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ))}

      {items.length === 0 && (
        <div className="text-center py-4 px-4 bg-ods-bg-secondary border border-ods-border rounded-lg">
          <p className="text-ods-text-secondary text-sm font-['DM_Sans']">
            {emptyMessage}
          </p>
        </div>
      )}
    </div>
  );
}
