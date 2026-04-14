"use client";

import { Button, Input, Textarea, Label } from '../ui';
import { Trash2, Plus, ChevronDown, ChevronUp, Eye, EyeOff } from 'lucide-react';
import { useState, useEffect } from 'react';
import type { ChangelogEntry } from '../../types/product-release';

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
}

export function ChangelogManager({
  title,
  entries,
  onChange,
  className = '',
  expandAll = false,
  showVisibilityToggle = false,
}: ChangelogManagerProps) {
  const [expandedIndices, setExpandedIndices] = useState<Set<number>>(new Set());

  // When expandAll changes to true and there are entries, expand all
  useEffect(() => {
    if (expandAll && entries.length > 0) {
      setExpandedIndices(new Set(entries.map((_, i) => i)));
    }
  }, [expandAll, entries.length]);

  const addEntry = () => {
    const newEntry: ChangelogEntry = {
      title: '',
      description: '',
      ...(showVisibilityToggle && { visibility: 'public' as const }),
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
        <Label className="text-[14px] text-ods-text-primary">
          {title}
        </Label>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={addEntry}
          leftIcon={<Plus className="h-4 w-4" />}
          className="font-['DM_Sans'] text-[14px]"
        >
          Add Entry
        </Button>
      </div>

      {entries.map((entry, index) => {
        const isExpanded = expandedIndices.has(index);
        const hasContent = entry.title.trim().length > 0;

        return (
          <div key={index} className="bg-ods-bg-secondary rounded-lg border border-ods-border overflow-hidden">
            {/* Header - always visible */}
            <div className="flex items-center gap-3 p-3">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => toggleExpanded(index)}
                className="shrink-0"
              >
                {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </Button>

              <div className="flex-1 min-w-0">
                {hasContent ? (
                  <p className="font-['DM_Sans'] font-medium text-[14px] text-ods-text-primary truncate">
                    {entry.title}
                  </p>
                ) : (
                  <p className="font-['DM_Sans'] font-medium text-[14px] text-ods-text-secondary italic">
                    New entry (click to edit)
                  </p>
                )}
              </div>

              {showVisibilityToggle && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => toggleVisibility(index)}
                  className="shrink-0"
                  title={
                    (entry.visibility ?? 'public') === 'public'
                      ? 'Visible to investors'
                      : 'Internal only'
                  }
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
                variant="ghost"
                size="icon"
                onClick={() => removeEntry(index)}
                className="text-red-400 hover:text-red-300 hover:bg-red-400/10 shrink-0"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>

            {/* Expanded content */}
            {isExpanded && (
              <div className="px-3 pb-3 space-y-3 border-t border-ods-border pt-3">
                {/* Title */}
                <div className="space-y-1">
                  <Label className="text-[12px] text-ods-text-secondary">Title *</Label>
                  <Input
                    placeholder="e.g., New dark mode theme support"
                    value={entry.title}
                    onChange={(e) => updateEntry(index, 'title', e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && e.preventDefault()}
                    className="bg-[#161616]"
                  />
                </div>

                {/* Description */}
                <div className="space-y-1">
                  <Label className="text-[12px] text-ods-text-secondary">Description</Label>
                  <Textarea
                    placeholder="Detailed explanation of the change..."
                    value={entry.description || ''}
                    onChange={(e) => updateEntry(index, 'description', e.target.value)}
                    rows={2}
                    className="bg-[#161616]"
                  />
                </div>
              </div>
            )}
          </div>
        );
      })}

      {entries.length === 0 && (
        <div className="text-center py-4 px-4 bg-ods-bg-secondary border border-ods-border rounded-lg">
          <p className="text-ods-text-secondary text-sm font-['DM_Sans']">
            No entries added. Click "Add Entry" to create {title.toLowerCase()}.
          </p>
        </div>
      )}
    </div>
  );
}
