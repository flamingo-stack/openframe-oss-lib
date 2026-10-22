'use client';

import { X, Plus } from 'lucide-react';
import { type KeyboardEvent, useState } from 'react';
import { cn } from '../../utils/cn';
import { InteractiveSkeleton, TextLineSkeleton } from '../loading/unified-skeleton';
import { Badge } from './badge';
import { Button } from './button';
import { Input } from './input';
import { Label } from './label';
import { useLoadingScope } from './loading-scope';

/** The field's layout (label, the input with its Add button, the tags, the count), shared with its loading form. */
export const TAGS_INPUT_CLASS = 'space-y-2';
/** The input and its Add button on one line. */
export const TAGS_INPUT_ROW_CLASS = 'flex items-center gap-2';
const TAGS_INPUT_FIELD_CLASS = 'flex-1';
const ADD_LABEL = 'Add';

function AddButton({ onClick, disabled }: { onClick?: () => void; disabled: boolean }) {
  return (
    <Button
      type="button"
      variant="outline"
      onClick={onClick}
      disabled={disabled}
      leftIcon={<Plus className="h-4 w-4" />}
    >
      {ADD_LABEL}
    </Button>
  );
}

interface TagsInputProps {
  value: string[];
  onChange: (tags: string[]) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  maxTags?: number;
  inputClassName?: string;
  badgeClassName?: string;
  label?: string;
  /** The tags are still being read: the field draws its own loading form (also inside a loading scope). */
  loading?: boolean;
}

/** A field of tags. ONE switch: while its tags are read (`loading`, or a loading scope) its own loading form. */
export function TagsInput(props: TagsInputProps) {
  if (useLoadingScope() || props.loading) {
    return <TagsInputSkeleton label={props.label} maxTags={props.maxTags} className={props.className} />;
  }
  return <LoadedTagsInput {...props} />;
}

function LoadedTagsInput({
  value = [],
  onChange,
  placeholder = 'Add a tag...',
  className,
  disabled = false,
  maxTags,
  inputClassName,
  badgeClassName,
  label,
}: TagsInputProps) {
  const [inputValue, setInputValue] = useState('');

  const handleAddTag = () => {
    const trimmedValue = inputValue.trim();

    if (!trimmedValue) return;

    // Check if tag already exists
    if (value.includes(trimmedValue)) {
      setInputValue('');
      return;
    }

    // Check max tags limit
    if (maxTags && value.length >= maxTags) {
      return;
    }

    onChange([...value, trimmedValue]);
    setInputValue('');
  };

  const handleRemoveTag = (tagToRemove: string) => {
    onChange(value.filter(tag => tag !== tagToRemove));
  };

  const handleKeyPress = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddTag();
    }
  };

  return (
    <div className={cn(TAGS_INPUT_CLASS, className)}>
      {label && <Label>{label}</Label>}

      <div className={TAGS_INPUT_ROW_CLASS}>
        <Input
          value={inputValue}
          onChange={e => setInputValue(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder={placeholder}
          disabled={disabled || (maxTags ? value.length >= maxTags : false)}
          className={cn(TAGS_INPUT_FIELD_CLASS, 'border-ods-border bg-ods-bg text-ods-text-primary', inputClassName)}
        />
        <AddButton
          onClick={handleAddTag}
          disabled={disabled || !inputValue.trim() || (maxTags ? value.length >= maxTags : false)}
        />
      </div>

      {value.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {value.map(tag => (
            <Badge key={tag} className={cn('flex items-center gap-1 py-1 pl-2 pr-1', badgeClassName)}>
              {tag}
              {!disabled && (
                <button
                  type="button"
                  onClick={() => handleRemoveTag(tag)}
                  className="rounded p-0.5 transition-colors hover:bg-white/20"
                  aria-label={`Remove ${tag} tag`}
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </Badge>
          ))}
        </div>
      )}

      {maxTags && (
        <p className="text-ods-text-secondary text-h6">
          {value.length}/{maxTags} tags
        </p>
      )}
    </div>
  );
}

/**
 * A `TagsInput` while its tags are read, in the field's own layout: the label and the Add button for real (the button
 * inert), the input's box and the tag count as skeletons. The tags themselves depend on the record and are not drawn.
 */
function TagsInputSkeleton({ label, maxTags, className }: Pick<TagsInputProps, 'label' | 'maxTags' | 'className'>) {
  return (
    <div className={cn(TAGS_INPUT_CLASS, className)}>
      {label && <Label>{label}</Label>}
      <div className={TAGS_INPUT_ROW_CLASS}>
        <InteractiveSkeleton.Input className={TAGS_INPUT_FIELD_CLASS} />
        <AddButton disabled />
      </div>
      {maxTags ? <TextLineSkeleton type="h6" className="w-16" /> : null}
    </div>
  );
}
