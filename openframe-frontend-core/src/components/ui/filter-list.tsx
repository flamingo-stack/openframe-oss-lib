"use client"

import * as React from "react"
import * as CheckboxPrimitive from "@radix-ui/react-checkbox"
import { Check } from "lucide-react"
import { cn } from "../../utils/cn"

export interface FilterListItemProps {
  title: string
  meta?: Array<string | number>
  selected?: boolean
  onToggle?: (selected: boolean) => void
  disabled?: boolean
  className?: string
}

export function FilterListItem({
  title,
  meta,
  selected = false,
  onToggle,
  disabled = false,
  className,
}: FilterListItemProps) {
  const handleToggle = () => {
    if (disabled) return
    onToggle?.(!selected)
  }

  return (
    <div
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-pressed={selected}
      aria-disabled={disabled}
      onClick={handleToggle}
      onKeyDown={(e) => {
        if (disabled) return
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault()
          handleToggle()
        }
      }}
      className={cn(
        "flex w-full items-center gap-[var(--spacing-system-m)] px-[var(--spacing-system-m)] py-[var(--spacing-system-sf)]",
        "border-b border-ods-border last:border-b-0",
        "transition-colors outline-none",
        "focus-visible:ring-2 focus-visible:ring-ods-accent",
        disabled
          ? "cursor-not-allowed opacity-60"
          : "cursor-pointer hover:bg-ods-bg-hover",
        selected
          ? "bg-[var(--ods-open-yellow-secondary)] hover:bg-[var(--ods-open-yellow-secondary)]"
          : "bg-ods-bg",
        className,
      )}
    >
      <div className="flex min-w-0 flex-1 flex-col">
        <p className="truncate text-h4 text-ods-text-primary">
          {title}
        </p>

        {meta && meta.length > 0 && (
          <div
            className={cn(
              "flex items-start gap-[var(--spacing-system-xxs)] text-h6",
              selected ? "text-ods-accent" : "text-ods-text-secondary",
            )}
          >
            {meta.map((item, index) => (
              <React.Fragment key={index}>
                {index > 0 && <span aria-hidden="true">•</span>}
                <span>{item}</span>
              </React.Fragment>
            ))}
          </div>
        )}
      </div>

      <CheckboxPrimitive.Root
        checked={selected}
        onCheckedChange={(c) => onToggle?.(c === true)}
        onClick={(e) => e.stopPropagation()}
        disabled={disabled}
        aria-label={title}
        className={cn(
          "flex h-6 w-6 shrink-0 items-center justify-center rounded-md border-2",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ods-accent",
          selected
            ? "border-ods-accent bg-ods-accent"
            : "border-ods-text-secondary bg-ods-card",
        )}
      >
        <CheckboxPrimitive.Indicator className="flex items-center justify-center">
          <Check className="h-3.5 w-3.5 text-ods-text-on-accent" strokeWidth={3} />
        </CheckboxPrimitive.Indicator>
      </CheckboxPrimitive.Root>
    </div>
  )
}

export interface FilterListProps<T = unknown> {
  items: Array<{
    id: string
    title: string
    meta?: Array<string | number>
    disabled?: boolean
    data?: T
  }>
  selectedIds: string[]
  onChange: (selectedIds: string[]) => void
  multiple?: boolean
  className?: string
}

export function FilterList<T = unknown>({
  items,
  selectedIds,
  onChange,
  multiple = true,
  className,
}: FilterListProps<T>) {
  const handleToggle = (id: string, selected: boolean) => {
    if (multiple) {
      onChange(
        selected ? [...selectedIds, id] : selectedIds.filter((v) => v !== id),
      )
    } else {
      onChange(selected ? [id] : [])
    }
  }

  return (
    <div
      role="listbox"
      aria-multiselectable={multiple}
      className={cn("flex w-full flex-col", className)}
    >
      {items.map((item) => (
        <FilterListItem
          key={item.id}
          title={item.title}
          meta={item.meta}
          selected={selectedIds.includes(item.id)}
          disabled={item.disabled}
          onToggle={(selected) => handleToggle(item.id, selected)}
        />
      ))}
    </div>
  )
}
