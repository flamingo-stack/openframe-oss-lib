"use client";

import { useState } from 'react';
import { Search, X, Plus, Loader2 } from 'lucide-react';
import { Button } from '../ui';
import { cn } from '../../utils';

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
  placeholder = "Search tags...",
  className,
  disabled = false,
  allowCreate = true
}: TagsSelectorProps) {
  const [searchQuery, setSearchQuery] = useState("");
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
    return availableTags.filter(tag =>
      !selectedTagIds.includes(tag.id) &&
      tag.name.toLowerCase().includes(searchQuery.toLowerCase())
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
    <div className={cn("space-y-2", className)}>
      <div className="relative">
        {/* Search Icon */}
        <div className="absolute top-3 left-3 flex items-center pointer-events-none z-10">
          <Search className="h-4 w-4 text-ods-text-secondary" />
        </div>

        {/* Input Container with Chips Inside */}
        <div className={cn(
          "w-full bg-ods-bg border border-ods-border rounded-lg",
          "focus-within:ring-2 focus-within:ring-ods-accent focus-within:border-ods-accent",
          "transition-all duration-200 flex flex-wrap items-center gap-1.5 p-2 pl-10 min-h-[42px]",
          disabled && "opacity-50 cursor-not-allowed"
        )}>
          {/* Selected Tag Chips Inside Search Bar */}
          {getSelectedTags().map((tag) => (
            <span
              key={tag.id}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-ods-accent text-ods-bg text-xs font-medium font-['DM_Sans']"
            >
              {tag.name}
              {!disabled && (
                <Button
                  variant="ghost"
                  size="none"
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleTagRemove(tag.id);
                  }}
                  centerIcon={<X className="w-2.5 h-2.5" />}
                  className="w-3 h-3 p-0 min-h-0 min-w-0 ml-0.5 hover:opacity-70 text-ods-bg hover:bg-transparent"
                  aria-label={`Remove ${tag.name}`}
                  fullWidthOnMobile={false}
                />
              )}
            </span>
          ))}

          {/* Search Input - Takes remaining space */}
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => {
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
            onKeyDown={(e) => {
              if (e.key === 'Enter' && canCreateNewTag) {
                e.preventDefault();
                handleCreateTag();
              }
            }}
            placeholder={selectedTagIds.length >= maxTags ? "Maximum tags reached" : selectedTagIds.length === 0 ? placeholder : "Add more..."}
            disabled={disabled || selectedTagIds.length >= maxTags}
            className={cn(
              "flex-1 min-w-[100px] bg-transparent border-none outline-none text-ods-text-primary placeholder:text-ods-text-secondary text-[14px] font-['DM_Sans'] leading-[1.4em] py-1 focus:outline-none focus:ring-0 focus:border-0",
              selectedTagIds.length >= maxTags && "cursor-not-allowed opacity-50"
            )}
          />

          {/* Clear Search Button */}
          {searchQuery && (
            <Button
              variant="ghost"
              size="none"
              type="button"
              onClick={() => {
                setSearchQuery("");
                setShowDropdown(false);
              }}
              centerIcon={<X className="w-3 h-3" />}
              className="w-5 h-5 p-0 min-h-0 min-w-0 shrink-0 text-ods-text-secondary hover:text-ods-text-primary hover:bg-transparent"
              aria-label="Clear search"
              fullWidthOnMobile={false}
            />
          )}
        </div>

        {/* Autocomplete Dropdown - Shows all available tags on focus */}
        {showDropdown && !disabled && (
          <div className="absolute z-50 w-full mt-1 bg-ods-card border border-ods-border rounded-lg shadow-lg max-h-60 overflow-y-auto">
            <div className="p-3">
              {/* Create New Tag Option */}
              {canCreateNewTag && (
                <Button
                  variant="outline"
                  size="none"
                  type="button"
                  onClick={handleCreateTag}
                  disabled={isCreating}
                  leftIcon={isCreating ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
                  className="w-full flex flex-row items-center gap-1.5 px-2 py-1 mb-2 h-auto rounded border-dashed border-ods-accent bg-ods-bg hover:bg-ods-card text-ods-accent font-['DM_Sans'] !text-xs !font-medium"
                  fullWidthOnMobile={true}
                >
                  Create tag: <strong>"{searchQuery.trim()}"</strong>
                </Button>
              )}

              {/* Existing Tags */}
              {filteredTags.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {filteredTags.map((tag) => (
                    <Button
                      key={tag.id}
                      variant="outline"
                      size="none"
                      type="button"
                      onClick={() => handleTagAdd(tag.id)}
                      className="h-auto px-2 py-0.5 rounded border-ods-border hover:border-ods-accent bg-ods-bg hover:bg-ods-card text-ods-text-primary font-['DM_Sans'] !text-xs !font-medium"
                      fullWidthOnMobile={false}
                    >
                      {tag.name}
                    </Button>
                  ))}
                </div>
              ) : !canCreateNewTag ? (
                <div className="py-4 px-4 text-center w-full">
                  <p className="text-ods-text-secondary text-sm font-['DM_Sans']">
                    {searchQuery.trim() ? `No tags found for "${searchQuery}"` : "No tags available"}
                  </p>
                </div>
              ) : null}
            </div>
          </div>
        )}
      </div>

      {/* Tag Counter */}
      <div className="flex items-center justify-between">
        <div className="text-[11px] text-ods-text-secondary font-['DM_Sans']">
          {selectedTagIds.length} / {maxTags} tags selected
        </div>
        {selectedTagIds.length >= maxTags && (
          <span className="text-[11px] text-[--ods-attention-red-error] font-['DM_Sans']">
            (Maximum reached)
          </span>
        )}
      </div>
    </div>
  );
}
