'use client';

import React from 'react';
import Image from '../../embed-shims/next-image';
import { cn } from '../../utils/cn';
import { CheckCircleIcon } from '../icons-v2-generated/signs-and-symbols/check-circle-icon';
import { Button } from '../ui/button';
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
      <Button
        // A selectable option drawn as a field: its accent border marks the picked one.
        variant="field"
        ref={ref}
        type="button"
        role="option"
        aria-selected={selected}
        data-state={selected ? 'open' : undefined}
        disabled={disabled}
        onClick={onClick}
        className={cn('content-md:h-16', className)}
      >
        {icon && (
          <span
            className={cn(
              'flex size-4 shrink-0 items-center justify-center content-md:size-6',
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
                'hidden truncate text-h6 content-md:flex',
                selected ? 'text-ods-accent' : 'text-ods-text-secondary',
              )}
              title={description}
            >
              {description}
            </span>
          )}
        </span>

        {tag && <Tag variant={tagVariant} className="shrink-0" label={tag} />}

        {selected && <CheckCircleIcon className="size-4 shrink-0 text-ods-accent content-md:size-6" />}
      </Button>
    );
  },
);

SelectButton.displayName = 'SelectButton';
