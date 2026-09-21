'use client';

import * as PopoverPrimitive from '@radix-ui/react-popover';
import * as ScrollAreaPrimitive from '@radix-ui/react-scroll-area';
import { type MouseEvent, useCallback, useRef, useState } from 'react';
import { useKeyboardCollisionPadding } from '../../hooks/ui/use-keyboard-collision-padding';
import { cn } from '../../utils/cn';
import {
  CheckIcon,
  PencilIcon,
  PlusIcon,
  SearchIcon,
  TrashIcon,
  XmarkIcon,
  XmarkCircleIcon,
} from '../icons-v2-generated';
import { Button } from './button';
import { FieldWrapper } from './field-wrapper';
import { Input } from './input';
import { Tag } from './tag';

export interface TagItem {
  id: string;
  name: string;
  color?: string;
}

export interface TagsManagerProps {
  /** All available tags */
  tags: TagItem[];
  /** IDs of currently selected tags */
  selectedIds: string[];
  /** Called when selection changes */
  onChange: (ids: string[]) => void;
  /** Called to create a new tag; should return the created tag */
  onCreateTag?: (name: string) => Promise<TagItem | null | undefined>;
  /** Called to update a tag name */
  onUpdateTag?: (id: string, name: string) => Promise<void>;
  /** Called to delete a tag */
  onDeleteTag?: (id: string) => Promise<void>;
  /** Whether create is in progress */
  isCreating?: boolean;
  /** Whether update is in progress */
  isUpdating?: boolean;
  /** Whether delete is in progress */
  isDeleting?: boolean;
  /** Label displayed above the input */
  label?: string;
  /** Placeholder for the search input */
  searchPlaceholder?: string;
  /** Whether the component is disabled */
  disabled?: boolean;
  /** Additional className for the root container */
  className?: string;
}

export function TagsManager({
  tags,
  selectedIds,
  onChange,
  onCreateTag,
  onUpdateTag,
  onDeleteTag,
  isCreating = false,
  isUpdating = false,
  isDeleting = false,
  label = 'Tags',
  searchPlaceholder = 'Search and add Tags',
  disabled = false,
  className,
}: TagsManagerProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const keyboardPadding = useKeyboardCollisionPadding();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const editInputRef = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedTags = tags.filter(t => selectedIds.includes(t.id));
  const filtered = tags.filter(t => t.name.toLowerCase().includes(search.toLowerCase()));
  const showCreateOption =
    onCreateTag && search.trim() && !tags.some(t => t.name.toLowerCase() === search.trim().toLowerCase());

  const toggleTag = useCallback(
    (id: string) => {
      if (selectedIds.includes(id)) {
        onChange(selectedIds.filter(i => i !== id));
      } else {
        onChange([...selectedIds, id]);
      }
    },
    [selectedIds, onChange],
  );

  const handleCreate = useCallback(async () => {
    if (!onCreateTag) return;
    const name = search.trim();
    if (!name) return;
    try {
      const result = await onCreateTag(name);
      if (result?.id) {
        onChange([...selectedIds, result.id]);
        setSearch('');
      }
    } catch (error) {
      // Leave the typed name in the input so the user can retry; the caller
      // owns user-facing error reporting via its own mutation state.
      console.error('Failed to create tag:', error);
    }
  }, [search, onCreateTag, selectedIds, onChange]);

  const startEdit = useCallback((id: string, name: string) => {
    setEditingId(id);
    setEditingName(name);
    setTimeout(() => editInputRef.current?.focus(), 0);
  }, []);

  const confirmEdit = useCallback(async () => {
    if (!onUpdateTag || !editingId || !editingName.trim()) return;
    try {
      await onUpdateTag(editingId, editingName.trim());
      // Only leave edit mode once the rename actually landed.
      setEditingId(null);
      setEditingName('');
    } catch (error) {
      console.error('Failed to rename tag:', error);
    }
  }, [editingId, editingName, onUpdateTag]);

  const cancelEdit = useCallback(() => {
    setEditingId(null);
    setEditingName('');
  }, []);

  const handleDelete = useCallback(
    async (id: string) => {
      if (!onDeleteTag) return;
      try {
        await onDeleteTag(id);
        if (selectedIds.includes(id)) {
          onChange(selectedIds.filter(i => i !== id));
        }
      } catch (error) {
        // Keep the tag selected if the delete failed — dropping it from the
        // selection would silently desync the form from the server.
        console.error('Failed to delete tag:', error);
      }
    },
    [onDeleteTag, selectedIds, onChange],
  );

  const handleClearAll = useCallback(
    (e: MouseEvent) => {
      e.stopPropagation();
      onChange([]);
      setSearch('');
      inputRef.current?.focus();
    },
    [onChange],
  );

  return (
    <FieldWrapper label={label} className={className}>
      <div className="relative" ref={containerRef}>
        <PopoverPrimitive.Root open={open} onOpenChange={setOpen}>
          {/* Anchor container */}
          <PopoverPrimitive.Anchor asChild>
            <label
              className={cn(
                'flex min-h-11 w-full cursor-text flex-wrap items-center gap-2 rounded-[6px] border px-3 py-1 md:min-h-12',
                'transition-colors duration-200',
                'border-ods-border bg-ods-card',
                'group',
                !disabled &&
                  'hover:border-ods-border-hover hover:bg-ods-bg-hover active:border-ods-border-active active:bg-ods-bg-active',
                disabled && '!cursor-not-allowed bg-ods-bg',
                open && 'border-ods-accent hover:border-ods-accent',
              )}
              onClickCapture={() => {
                if (!disabled) setOpen(true);
              }}
            >
              {/* Search adornment */}
              <span
                className={cn(
                  'flex-shrink-0 text-ods-text-secondary transition-colors duration-200 [&_svg]:size-4 md:[&_svg]:size-6',
                  open && 'text-ods-accent',
                )}
              >
                <SearchIcon />
              </span>

              {/* Selected tags rendered as Tag components */}
              {selectedTags.map(tag => (
                <Tag
                  key={tag.id}
                  label={tag.name}
                  variant="outline"
                  onClose={disabled ? undefined : () => toggleTag(tag.id)}
                />
              ))}

              {/* Inline search input */}
              <input
                ref={inputRef}
                type="text"
                value={search}
                onChange={e => {
                  setSearch(e.target.value);
                  if (!open) setOpen(true);
                }}
                onFocus={() => setOpen(true)}
                onKeyDown={e => {
                  if (e.key === 'Escape') setOpen(false);
                  if (e.key === 'Enter' && showCreateOption) {
                    e.preventDefault();
                    void handleCreate();
                  }
                  if (e.key === 'Backspace' && !search && selectedIds.length > 0) {
                    onChange(selectedIds.slice(0, -1));
                  }
                }}
                placeholder={selectedTags.length === 0 ? searchPlaceholder : 'Add More...'}
                disabled={disabled}
                className={cn(
                  'min-w-0 flex-1 border-none bg-transparent outline-none',
                  'text-h4',
                  'text-ods-text-primary placeholder:text-ods-text-secondary',
                  'disabled:cursor-not-allowed',
                )}
              />

              {/* Clear all button — shown when tags are selected */}
              {selectedTags.length > 0 && !disabled && (
                <button
                  type="button"
                  onClick={handleClearAll}
                  className="flex flex-shrink-0 items-center justify-center transition-opacity hover:opacity-70 [&_svg]:size-4 md:[&_svg]:size-6"
                  aria-label="Clear all tags"
                >
                  <XmarkCircleIcon className="text-ods-text-secondary" />
                </button>
              )}
            </label>
          </PopoverPrimitive.Anchor>

          {/* Dropdown */}
          <PopoverPrimitive.Content
            className={cn(
              'z-50 mt-1 w-[var(--radix-popover-trigger-width)]',
              'rounded border border-ods-border bg-ods-card',
              'flex max-h-[var(--radix-popper-available-height)] flex-col overflow-hidden',
              'data-[state=open]:animate-in data-[state=closed]:animate-out',
              'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
              'data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
              'data-[side=bottom]:slide-in-from-top-2 data-[side=top]:slide-in-from-bottom-2',
            )}
            sideOffset={4}
            align="start"
            // The anchor is the tag field that raises the software keyboard, so
            // this list is always positioned with the keyboard up — see
            // useKeyboardCollisionPadding.
            collisionPadding={{ bottom: keyboardPadding }}
            onOpenAutoFocus={e => {
              e.preventDefault();
              inputRef.current?.focus();
            }}
            onInteractOutside={e => {
              if (containerRef.current?.contains(e.target as Node)) {
                e.preventDefault();
              }
            }}
          >
            <ScrollAreaPrimitive.Root className="flex min-h-0 flex-col overflow-hidden">
              <ScrollAreaPrimitive.Viewport className="max-h-60 min-h-0 w-full">
                <div role="listbox">
                  {filtered.map(tag => {
                    const isSelected = selectedIds.includes(tag.id);
                    const isEditing = editingId === tag.id;

                    if (isEditing) {
                      return (
                        <div
                          key={tag.id}
                          className="flex items-center gap-1 border-b border-ods-border px-2 py-1 last:border-b-0"
                        >
                          <Input
                            ref={editInputRef}
                            value={editingName}
                            onChange={e => setEditingName(e.target.value)}
                            onKeyDown={e => {
                              if (e.key === 'Enter') void confirmEdit();
                              if (e.key === 'Escape') cancelEdit();
                            }}
                            className="flex-1"
                          />
                          <Button
                            type="button"
                            variant="transparent"
                            size="icon"
                            onClick={confirmEdit}
                            disabled={isUpdating}
                          >
                            <CheckIcon size={14} className="text-ods-success" />
                          </Button>
                          <Button type="button" variant="transparent" size="icon" onClick={cancelEdit}>
                            <XmarkIcon size={14} className="text-ods-text-secondary" />
                          </Button>
                        </div>
                      );
                    }

                    return (
                      <div
                        key={tag.id}
                        role="option"
                        aria-selected={isSelected}
                        tabIndex={0}
                        className={cn(
                          'flex h-11 cursor-pointer items-center border-b border-ods-border px-4 transition-colors last:border-b-0 md:h-12',
                          'text-h4',
                          isSelected ? 'text-ods-accent' : 'text-ods-text-primary',
                          'group/item hover:bg-ods-bg-hover',
                        )}
                        onClick={() => toggleTag(tag.id)}
                        onKeyDown={e => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            toggleTag(tag.id);
                          }
                        }}
                      >
                        <div className="flex w-full items-center justify-between">
                          <span className="truncate" title={tag.name}>
                            {tag.name}
                          </span>
                          <div className="flex shrink-0 items-center gap-1">
                            {isSelected && <CheckIcon className="text-ods-accent" size={20} />}
                            {(onUpdateTag || onDeleteTag) && (
                              <div className="flex items-center gap-0.5 opacity-0 transition-opacity group-hover/item:opacity-100">
                                {onUpdateTag && (
                                  <Button
                                    type="button"
                                    variant="transparent"
                                    size="icon"
                                    onClick={e => {
                                      e.stopPropagation();
                                      startEdit(tag.id, tag.name);
                                    }}
                                  >
                                    <PencilIcon size={14} className="text-ods-text-secondary" />
                                  </Button>
                                )}
                                {onDeleteTag && (
                                  <Button
                                    type="button"
                                    variant="transparent"
                                    size="icon"
                                    onClick={e => {
                                      e.stopPropagation();
                                      void handleDelete(tag.id);
                                    }}
                                    disabled={isDeleting}
                                  >
                                    <TrashIcon size={14} className="text-ods-error" />
                                  </Button>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  {showCreateOption && (
                    <div
                      role="option"
                      // A create-new action, never a selectable value — but the
                      // role still requires the state, and `false` is the truth.
                      aria-selected={false}
                      tabIndex={0}
                      className={cn(
                        'flex h-11 cursor-pointer items-center gap-2 px-4 transition-colors text-h4 md:h-12',
                        'hover:bg-ods-bg-hover',
                        isCreating && 'pointer-events-none opacity-50',
                      )}
                      onClick={handleCreate}
                      onKeyDown={e => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          void handleCreate();
                        }
                      }}
                    >
                      <PlusIcon size={16} className="shrink-0 text-ods-accent" />
                      <span className="truncate text-ods-accent" title={`Create "${search.trim()}"`}>
                        Create &ldquo;{search.trim()}&rdquo;
                      </span>
                    </div>
                  )}

                  {filtered.length === 0 && !showCreateOption && (
                    <div className="px-4 py-2 text-ods-text-secondary text-h6">No tags found</div>
                  )}
                </div>
              </ScrollAreaPrimitive.Viewport>
              <ScrollAreaPrimitive.Scrollbar className="hidden" orientation="vertical">
                <ScrollAreaPrimitive.Thumb />
              </ScrollAreaPrimitive.Scrollbar>
            </ScrollAreaPrimitive.Root>
          </PopoverPrimitive.Content>
        </PopoverPrimitive.Root>
      </div>
    </FieldWrapper>
  );
}
