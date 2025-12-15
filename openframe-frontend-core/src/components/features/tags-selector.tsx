"use client";

import { useState } from 'react';
import { Search, X } from 'lucide-react';
import { Button } from '../ui';
import { cn } from '../../utils';

export interface Tag {
  id: number;
  name: string;
  slug: string;
}

interface TagsSelectorProps {
  availableTags: Tag[];
  selectedTagIds: number[];
  onTagsChange: (tagIds: number[]) => void;
  maxTags?: number;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
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
 */
export function TagsSelector({
  availableTags,
  selectedTagIds,
  onTagsChange,
  maxTags = 10,
  placeholder = "Search tags...",
  className,
  disabled = false
}: TagsSelectorProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);

  const handleTagAdd = (tagId: number) => {
    if (!selectedTagIds.includes(tagId) && selectedTagIds.length < maxTags) {
      onTagsChange([...selectedTagIds, tagId]);
      setSearchQuery('');
    }
  };

  const handleTagRemove = (tagId: number) => {
    onTagsChange(selectedTagIds.filter(id => id !== tagId));
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

  return (
    <div className={cn("space-y-2", className)}>
      <div className="relative">
        {/* Search Icon */}
        <div className="absolute top-3 left-3 flex items-center pointer-events-none z-10">
          <Search className="h-4 w-4 text-ods-text-secondary" />
        </div>

        {/* Input Container with Chips Inside */}
        <div className={cn(
          "w-full bg-[#161616] border border-ods-border rounded-lg",
          "focus-within:ring-2 focus-within:ring-[#FFC008] focus-within:border-[#FFC008]",
          "transition-all duration-200 flex flex-wrap items-start gap-1 p-2 pl-10 min-h-[42px]",
          disabled && "opacity-50 cursor-not-allowed"
        )}>
          {/* Selected Tag Chips Inside Search Bar */}
          {getSelectedTags().map((tag) => (
            <div
              key={tag.id}
              className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-[#FFC008] text-black text-xs font-medium font-['DM_Sans'] transition-all"
            >
              <span>{tag.name}</span>
              {!disabled && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleTagRemove(tag.id)}
                  className="h-4 w-4 hover:bg-black/10 rounded-sm p-0.5 transition-colors"
                  type="button"
                >
                  <X className="h-3 w-3" />
                </Button>
              )}
            </div>
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
              size="icon"
              onClick={() => {
                setSearchQuery("");
                setShowDropdown(false);
              }}
              className="h-6 w-6 text-ods-text-secondary hover:text-ods-text-primary transition-colors duration-150 flex-shrink-0"
              type="button"
            >
              <X className="h-3 w-3" />
            </Button>
          )}
        </div>

        {/* Autocomplete Dropdown - Shows all available tags on focus */}
        {showDropdown && !disabled && (
          <div className="absolute z-50 w-full mt-1 bg-ods-card border border-ods-border rounded-lg shadow-lg max-h-60 overflow-y-auto">
            <div className="p-3">
              {getFilteredTagsForAutocomplete().length > 0 ? (
                <div className="flex flex-wrap gap-1">
                  {getFilteredTagsForAutocomplete().map((tag) => (
                    <div
                      key={tag.id}
                      onClick={() => handleTagAdd(tag.id)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md border border-ods-border hover:border-[#FFC008] bg-ods-bg-secondary hover:bg-ods-surface cursor-pointer text-ods-text-primary font-['DM_Sans'] text-[14px] transition-all"
                    >
                      {tag.name}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-4 px-4 text-center w-full">
                  <p className="text-ods-text-secondary text-sm font-['DM_Sans']">
                    {searchQuery.trim() ? `No tags found for "${searchQuery}"` : "No tags available"}
                  </p>
                </div>
              )}
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
          <span className="text-[11px] text-[#EF4444] font-['DM_Sans']">
            (Maximum reached)
          </span>
        )}
      </div>
    </div>
  );
}
