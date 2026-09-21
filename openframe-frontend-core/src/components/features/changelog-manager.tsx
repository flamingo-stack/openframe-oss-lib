'use client';

import { Trash2, Plus, ChevronDown, ChevronUp, Eye, EyeOff } from 'lucide-react';
import { useState } from 'react';
import type { ChangelogEntry } from '../../types/product-release';
import {
  Button,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  StatusBadge,
  Textarea,
} from '../ui';

export interface ChangelogTagOption {
  value: string;
  label: string;
}

interface ChangelogManagerProps {
  title: string;
  entries: ChangelogEntry[];
  onChange: (entries: ChangelogEntry[]) => void;
  className?: string;
  /** Expand all items - useful after AI enrichment fills entries */
  expandAll?: boolean;
  /**
   * When true, render a per-entry public/internal visibility toggle (Eye/EyeOff icon)
   * in each entry's header. New entries default to 'public'. Used by investor updates
   * — leave undefined for product releases so they keep their existing UX.
   */
  showVisibilityToggle?: boolean;
  /**
   * When given, each entry gets a tag select (stored as `entry.tag`) and its header
   * shows the chosen tag as a badge. New entries start on the first option.
   */
  tagOptions?: readonly ChangelogTagOption[];
  /** Label of the tag select. Default "Tag". */
  tagLabel?: string;
  /** Entry field labels and placeholders. Defaults are the product-release wording. */
  titleLabel?: string;
  titlePlaceholder?: string;
  descriptionLabel?: string;
  descriptionPlaceholder?: string;
}

export function ChangelogManager({
  title,
  entries,
  onChange,
  className = '',
  expandAll = false,
  showVisibilityToggle = false,
  tagOptions,
  tagLabel = 'Tag',
  titleLabel = 'Title',
  titlePlaceholder = 'e.g., New dark mode theme support',
  descriptionLabel = 'Description',
  descriptionPlaceholder = 'Detailed explanation of the change...',
}: ChangelogManagerProps) {
  const tagLabelOf = (value?: string) => tagOptions?.find(o => o.value === value)?.label;
  const entryCount = entries.length;
  const allExpanded = () => new Set(Array.from({ length: entryCount }, (_, i) => i));

  // Mounting already-expanded is a one-shot initial value, so it is a lazy
  // `useState` initialiser rather than the first run of an effect.
  const [expandedIndices, setExpandedIndices] = useState<Set<number>>(() =>
    expandAll && entryCount > 0 ? allExpanded() : new Set(),
  );

  // When expandAll changes to true and there are entries, expand all — and
  // likewise when enrichment appends entries while it is already true. Adjusted
  // while rendering (React's prop-sync pattern): the prop flip has already
  // scheduled this render, so expanding here shows the entries in it instead of
  // painting them collapsed and re-rendering to open them.
  const [expandSync, setExpandSync] = useState({ expandAll, entryCount });
  if (expandSync.expandAll !== expandAll || expandSync.entryCount !== entryCount) {
    setExpandSync({ expandAll, entryCount });
    if (expandAll && entryCount > 0) {
      setExpandedIndices(allExpanded());
    }
  }

  const addEntry = () => {
    const newEntry: ChangelogEntry = {
      title: '',
      description: '',
      ...(showVisibilityToggle && { visibility: 'public' as const }),
      ...(tagOptions?.length && { tag: tagOptions[0].value }),
    };
    onChange([...entries, newEntry]);
    // Expand the newly added entry
    setExpandedIndices(prev => new Set([...prev, entries.length]));
  };

  const toggleVisibility = (index: number) => {
    const updated = [...entries];
    const current = updated[index].visibility ?? 'public';
    updated[index] = { ...updated[index], visibility: current === 'public' ? 'internal' : 'public' };
    onChange(updated);
  };

  const removeEntry = (index: number) => {
    onChange(entries.filter((_, i) => i !== index));
    // Remove from expanded and adjust indices for items after removed one
    setExpandedIndices(prev => {
      const newSet = new Set<number>();
      prev.forEach(i => {
        if (i < index) newSet.add(i);
        else if (i > index) newSet.add(i - 1);
      });
      return newSet;
    });
  };

  const updateEntry = (index: number, field: keyof ChangelogEntry, value: string) => {
    const updated = [...entries];
    updated[index] = { ...updated[index], [field]: value };
    onChange(updated);
  };

  const toggleExpanded = (index: number) => {
    setExpandedIndices(prev => {
      const newSet = new Set(prev);
      if (newSet.has(index)) {
        newSet.delete(index);
      } else {
        newSet.add(index);
      }
      return newSet;
    });
  };

  return (
    <div className={`space-y-3 ${className}`}>
      <div className="flex items-center justify-between">
        <Label>{title}</Label>
        <Button
          type="button"
          variant="outline"
          size="small-legacy"
          onClick={addEntry}
          leftIcon={<Plus className="h-4 w-4" />}
          className="text-h6"
        >
          Add Entry
        </Button>
      </div>

      {entries.map((entry, index) => {
        const isExpanded = expandedIndices.has(index);
        const hasContent = entry.title.trim().length > 0;

        return (
          <div key={index} className="overflow-hidden rounded-lg border border-ods-border bg-ods-bg-surface">
            {/* Header - always visible */}
            <div className="flex items-center gap-3 p-3">
              <Button
                type="button"
                variant="transparent"
                size="icon"
                onClick={() => toggleExpanded(index)}
                className="shrink-0"
              >
                {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </Button>

              <div className="min-w-0 flex-1">
                {hasContent ? (
                  <p className="truncate text-ods-text-primary text-h6">{entry.title}</p>
                ) : (
                  <p className="italic text-ods-text-secondary text-h6">New entry (click to edit)</p>
                )}
              </div>

              {tagOptions && tagLabelOf(entry.tag) && (
                <StatusBadge
                  variant="button"
                  singleLine
                  text={tagLabelOf(entry.tag) as string}
                  className="shrink-0 whitespace-nowrap"
                />
              )}

              {showVisibilityToggle && (
                <Button
                  type="button"
                  variant="transparent"
                  size="icon"
                  onClick={() => toggleVisibility(index)}
                  className="shrink-0"
                  title={(entry.visibility ?? 'public') === 'public' ? 'Visible to investors' : 'Internal only'}
                >
                  {(entry.visibility ?? 'public') === 'public' ? (
                    <Eye className="h-4 w-4 text-ods-accent" />
                  ) : (
                    <EyeOff className="h-4 w-4 text-ods-text-secondary" />
                  )}
                </Button>
              )}

              <Button
                type="button"
                variant="transparent"
                size="icon"
                onClick={() => removeEntry(index)}
                className="shrink-0 text-ods-error hover:bg-ods-error-secondary hover:text-ods-error-hover"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>

            {/* Expanded content */}
            {isExpanded && (
              <div className="space-y-3 border-t border-ods-border px-3 pb-3 pt-3">
                {/* Title */}
                <div className="space-y-1">
                  <Label className="text-ods-text-secondary">{titleLabel} *</Label>
                  <Input
                    placeholder={titlePlaceholder}
                    value={entry.title}
                    onChange={e => updateEntry(index, 'title', e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && e.preventDefault()}
                    className="bg-ods-bg"
                  />
                </div>

                {/* Description */}
                <div className="space-y-1">
                  <Label className="text-ods-text-secondary">{descriptionLabel}</Label>
                  <Textarea
                    placeholder={descriptionPlaceholder}
                    value={entry.description || ''}
                    onChange={e => updateEntry(index, 'description', e.target.value)}
                    rows={2}
                    className="bg-ods-bg"
                  />
                </div>

                {/* Tag */}
                {tagOptions && (
                  <div className="space-y-1">
                    <Label className="text-ods-text-secondary">{tagLabel}</Label>
                    <Select value={entry.tag ?? ''} onValueChange={value => updateEntry(index, 'tag', value)}>
                      <SelectTrigger className="bg-ods-bg">
                        <SelectValue placeholder={tagLabel} />
                      </SelectTrigger>
                      <SelectContent>
                        {tagOptions.map(option => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}

      {entries.length === 0 && (
        <div className="rounded-lg border border-ods-border bg-ods-bg-surface px-4 py-4 text-center">
          <p className="text-ods-text-secondary text-h6">
            No entries added. Click "Add Entry" to create {title.toLowerCase()}.
          </p>
        </div>
      )}
    </div>
  );
}
