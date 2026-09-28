'use client';

import React from 'react';
import Image from '../../embed-shims/next-image';
import { cn } from '../../utils/cn';
import { CheckCircleIcon } from '../icons-v2-generated/signs-and-symbols/check-circle-icon';
import { Tag, type TagProps } from '../ui/tag';

export interface SelectButtonProps {
  title: string;
  description?: string;
  selected?: boolean;
  disabled?: boolean;
  icon?: React.ReactNode;
  image?: {
    src: string;
    alt: string;
  };
  tag?: string;
  tagVariant?: TagProps['variant'];
  onClick?: () => void;
  className?: string;
}

export const SelectButton = React.forwardRef<HTMLButtonElement, SelectButtonProps>(
  (
    {
      title,
      description,
      selected = false,
      disabled = false,
      icon,
      image,
      tag,
      tagVariant = 'outline',
      onClick,
      className,
    },
    ref,
  ) => {
    return (
      <button
        ref={ref}
        type="button"
        role="option"
        aria-selected={selected}
        disabled={disabled}
        onClick={onClick}
        className={cn(
          'group flex h-11 items-center gap-1 rounded-[6px] border px-3 py-3 transition-colors duration-200 md:h-16 md:gap-2 md:px-4',
          'w-full text-left font-body',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ods-focus',
          'disabled:pointer-events-none disabled:opacity-50',
          // Hover / active move the BACKGROUND only, like Input — the accent
          // border is reserved for the selected state, so an unselected button
          // no longer flashes "selected" under the cursor.
          selected
            ? 'border-ods-accent bg-ods-open-yellow-light hover:bg-ods-open-yellow-light-hover active:bg-ods-open-yellow-light-action'
            : 'border-ods-border bg-ods-card hover:bg-ods-bg-hover active:bg-ods-bg-active',
          className,
        )}
      >
        {icon && (
          <span
            className={cn(
              'flex size-4 shrink-0 items-center justify-center md:size-6',
              selected ? 'text-ods-accent' : 'text-ods-text-secondary',
            )}
          >
            {icon}
          </span>
        )}

        {image && (
          <span className="size-10 shrink-0 overflow-hidden rounded">
            <Image
              src={image.src}
              alt={image.alt}
              className="size-full object-cover"
              width={40}
              height={40}
              unoptimized
            />
          </span>
        )}

        <span className="flex min-w-0 flex-1 flex-col justify-center overflow-hidden">
          <span className="truncate text-ods-text-primary text-h4" title={title}>
            {title}
          </span>
          {description && (
            <span
              className={cn(
                'hidden truncate text-h6 md:flex',
                selected ? 'text-ods-accent' : 'text-ods-text-secondary',
              )}
              title={description}
            >
              {description}
            </span>
          )}
        </span>

        {tag && <Tag variant={tagVariant} className="shrink-0" label={tag} />}

        {selected && <CheckCircleIcon className="size-4 shrink-0 text-ods-accent md:size-6" />}
      </button>
    );
  },
);

SelectButton.displayName = 'SelectButton';
