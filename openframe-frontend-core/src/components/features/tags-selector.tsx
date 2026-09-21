'use client';

import { Search, X, Plus, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { cn } from '../../utils';
import { Button } from '../ui';

interface Tag {
  id: number;
  name: string;
  slug: string;
}

interface TagsSelectorProps {
  availableTags: Tag[];
  selectedTagIds: number[];
  onTagsChange: (tagIds: number[]) => void;
  onCreateTag?: (tagName: string) => Promise<Tag | null>;
  maxTags?: number;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  allowCreate?: boolean;
}

/**
 * Unified Tags Selector Component
 * Used across blog posts, case studies, and product releases
 * Features:
 * - Search autocomplete
 * - Chip display inside search input
 * - Tag limit (default 10)
 * - Removable chips
 * - Auto-opens on focus (like blog post wizard)
 * - Create new tags (when allowCreate is true and onCreateTag is provided)
 */
export function TagsSelector({
  availableTags,
  selectedTagIds,
  onTagsChange,
  onCreateTag,
  maxTags = 10,
  placeholder = 'Search tags...',
  className,
  disabled = false,
  allowCreate = true,
}: TagsSelectorProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  const handleTagAdd = (tagId: number) => {
    if (!selectedTagIds.includes(tagId) && selectedTagIds.length < maxTags) {
      onTagsChange([...selectedTagIds, tagId]);
      setSearchQuery('');
    }
  };

  const handleTagRemove = (tagId: number) => {
    onTagsChange(selectedTagIds.filter(id => id !== tagId));
  };

  const handleCreateTag = async () => {
    if (!onCreateTag || !searchQuery.trim() || isCreating) return;

    setIsCreating(true);
    try {
      const newTag = await onCreateTag(searchQuery.trim());
      if (newTag) {
        // Add the new tag to selection
        onTagsChange([...selectedTagIds, newTag.id]);
        setSearchQuery('');
        setShowDropdown(false);
      }
    } catch (error) {
      console.error('Failed to create tag:', error);
    } finally {
      setIsCreating(false);
    }
  };

  const getFilteredTagsForAutocomplete = () => {
    return availableTags.filter(
      tag => !selectedTagIds.includes(tag.id) && tag.name.toLowerCase().includes(searchQuery.toLowerCase()),
    );
  };

  const getSelectedTags = () => {
    return availableTags.filter(tag => selectedTagIds.includes(tag.id));
  };

  // Check if the search query exactly matches an existing tag (case-insensitive)
  const tagExistsWithName = (name: string) => {
    return availableTags.some(tag => tag.name.toLowerCase() === name.toLowerCase());
  };

  const canCreateNewTag = allowCreate && onCreateTag && searchQuery.trim() && !tagExistsWithName(searchQuery.trim());
  const filteredTags = getFilteredTagsForAutocomplete();

  return (
    <div className={cn('space-y-2', className)}>
      <div className="relative">
        {/* Search Icon */}
        <div className="pointer-events-none absolute left-3 top-3 z-10 flex items-center">
          <Search className="h-4 w-4 text-ods-text-secondary" />
        </div>

        {/* Input Container with Chips Inside */}
        <div
          className={cn(
            'w-full rounded-lg border border-ods-border bg-ods-bg',
            'focus-within:border-ods-accent focus-within:ring-2 focus-within:ring-ods-accent',
            'flex min-h-[42px] flex-wrap items-center gap-1.5 p-2 pl-10 transition-all duration-200',
            disabled && 'cursor-not-allowed opacity-50',
          )}
        >
          {/* Selected Tag Chips Inside Search Bar */}
          {getSelectedTags().map(tag => (
            <span
              key={tag.id}
              className="inline-flex items-center gap-1 rounded-md border border-ods-accent/30 bg-ods-accent/15 py-1 pl-2.5 pr-1 text-ods-text-primary text-h6"
            >
              {tag.name}
              {!disabled && (
                <button
                  type="button"
                  onClick={e => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleTagRemove(tag.id);
                  }}
                  className="inline-flex h-4 w-4 items-center justify-center rounded-full text-ods-text-secondary transition-colors hover:bg-ods-accent/20 hover:text-ods-text-primary"
                  aria-label={`Remove ${tag.name}`}
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </span>
          ))}

          {/* Search Input - Takes remaining space */}
          <input
            type="text"
            value={searchQuery}
            onChange={e => {
              setSearchQuery(e.target.value);
              setShowDropdown(true);
            }}
            onFocus={() => {
              if (selectedTagIds.length < maxTags) {
                setShowDropdown(true);
              }
            }}
            onBlur={() => {
              setTimeout(() => setShowDropdown(false), 200);
            }}
            onKeyDown={e => {
              if (e.key === 'Enter' && canCreateNewTag) {
                e.preventDefault();
                // handleCreateTag never rejects — it try/catch/finally's internally.
                void handleCreateTag();
              }
            }}
            placeholder={
              selectedTagIds.length >= maxTags
                ? 'Maximum tags reached'
                : selectedTagIds.length === 0
                  ? placeholder
                  : 'Add more...'
            }
            disabled={disabled || selectedTagIds.length >= maxTags}
            className={cn(
              'min-w-[100px] flex-1 border-none bg-transparent py-1 text-ods-text-primary outline-none text-h4 placeholder:text-ods-text-secondary focus:border-0 focus:outline-none focus:ring-0',
              selectedTagIds.length >= maxTags && 'cursor-not-allowed opacity-50',
            )}
          />

          {/* Clear Search Button */}
          {searchQuery && (
            <Button
              variant="transparent"
              type="button"
              onClick={() => {
                setSearchQuery('');
                setShowDropdown(false);
              }}
              leftIcon={<X className="h-3 w-3" />}
              className="h-5 min-h-0 w-5 min-w-0 shrink-0 p-0 text-ods-text-secondary hover:bg-transparent hover:text-ods-text-primary"
              aria-label="Clear search"
            />
          )}
        </div>

        {/* Autocomplete Dropdown - Shows all available tags on focus */}
        {showDropdown && !disabled && (
          <div className="absolute z-50 mt-1 max-h-60 w-full overflow-y-auto rounded-lg border border-ods-border bg-ods-card shadow-lg">
            <div className="p-3">
              {/* Create New Tag Option */}
              {canCreateNewTag && (
                <Button
                  variant="outline"
                  type="button"
                  onClick={handleCreateTag}
                  disabled={isCreating}
                  leftIcon={isCreating ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
                  className="mb-2 flex h-auto w-full flex-row items-center gap-1.5 rounded border-dashed border-ods-accent bg-ods-bg px-2 py-1 text-ods-accent !text-h6 hover:bg-ods-card"
                >
                  Create tag: <strong>"{searchQuery.trim()}"</strong>
                </Button>
              )}

              {/* Existing Tags */}
              {filteredTags.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {filteredTags.map(tag => (
                    <Button
                      key={tag.id}
                      variant="outline"
                      type="button"
                      onClick={() => handleTagAdd(tag.id)}
                      className="h-auto rounded border-ods-border bg-ods-bg px-2 py-0.5 text-ods-text-primary !text-h6 hover:border-ods-accent hover:bg-ods-card"
                    >
                      {tag.name}
                    </Button>
                  ))}
                </div>
              ) : !canCreateNewTag ? (
                <div className="w-full px-4 py-4 text-center">
                  <p className="text-ods-text-secondary text-h6">
                    {searchQuery.trim() ? `No tags found for "${searchQuery}"` : 'No tags available'}
                  </p>
                </div>
              ) : null}
            </div>
          </div>
        )}
      </div>

      {/* Tag Counter */}
      <div className="flex items-center justify-between">
        <div className="text-ods-text-secondary text-h6">
          {selectedTagIds.length} / {maxTags} tags selected
        </div>
        {selectedTagIds.length >= maxTags && <span className="text-ods-error text-h6">(Maximum reached)</span>}
      </div>
    </div>
  );
}
