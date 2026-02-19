"use client"

import React from 'react'
import { cn } from '../../utils/cn'
import { CheckCircleIcon } from '../icons-v2-generated/signs-and-symbols/check-circle-icon'
import { Tag, type TagProps } from '../ui/tag'

export interface SelectButtonProps {
  title: string
  description?: string
  selected?: boolean
  disabled?: boolean
  icon?: React.ReactNode
  image?: {
    src: string
    alt: string
  }
  tag?: string
  tagVariant?: TagProps['variant']
  onClick?: () => void
  className?: string
}

export const SelectButton = React.forwardRef<HTMLButtonElement, SelectButtonProps>(
  ({ title, description, selected = false, disabled = false, icon, image, tag, tagVariant = "outline", onClick, className }, ref) => {
    return (
      <button
        ref={ref}
        type="button"
        role="option"
        aria-selected={selected}
        disabled={disabled}
        onClick={onClick}
        className={cn(
          "group flex items-center md:gap-2 gap-1 h-11 md:h-16 px-3 md:px-4 py-3 rounded-[6px] border transition-colors duration-200",
          "font-['DM_Sans'] text-left w-full",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ods-focus",
          "disabled:pointer-events-none disabled:opacity-50",
          selected
            ? "bg-[var(--ods-open-yellow-light)] border-ods-accent hover:bg-[var(--ods-open-yellow-light-hover)] active:bg-[var(--ods-open-yellow-light-action)]"
            : "bg-ods-card border-ods-border hover:bg-ods-bg-hover hover:border-ods-accent active:bg-ods-bg-active active:border-ods-accent",
          className,
        )}
      >
        {icon && (
          <span className={cn("shrink-0 flex items-center justify-center size-4 md:size-6", selected ? "text-ods-accent" : "text-ods-text-secondary")}>
            {icon}
          </span>
        )}

        {image && (
          <span className="shrink-0 size-10 rounded overflow-hidden">
            <img
              src={image.src}
              alt={image.alt}
              className="size-full object-cover"
            />
          </span>
        )}

        <span className="flex flex-1 flex-col justify-center min-w-0 overflow-hidden">
          <span className="md:text-[18px] text-[14px] font-medium text-ods-text-primary truncate">
            {title}
          </span>
          {description && (
            <span
              className={cn(
                "text-[14px] font-medium leading-5 truncate hidden md:flex",
                selected ? "text-ods-accent" : "text-ods-text-secondary",
              )}
            >
              {description}
            </span>
          )}
        </span>

        {tag && (
          <Tag variant={tagVariant} className="shrink-0">
            {tag}
          </Tag>
        )}

        {selected && (
          <CheckCircleIcon
            className="shrink-0 size-4 md:size-6 text-ods-accent"
          />
        )}
      </button>
    )
  },
)

SelectButton.displayName = "SelectButton"
