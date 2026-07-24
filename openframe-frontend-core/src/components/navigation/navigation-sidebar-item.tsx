"use client"

import { cloneElement, type ReactElement } from 'react'
import { NavigationSidebarItem } from '../../types/navigation'
import { cn } from '../../utils'

interface IconProps {
  color?: string
  className?: string
}

export interface NavigationSidebarItemButtonProps {
  item: NavigationSidebarItem
  showLabel: boolean
  disabled: boolean
  onClick: (item: NavigationSidebarItem, event?: React.MouseEvent) => void
}

export function NavigationSidebarItemButton({
  item,
  showLabel,
  disabled,
  onClick,
}: NavigationSidebarItemButtonProps) {
  const isActive = item.isActive ?? false
  const unreadCount = item.unreadCount ?? 0
  const hasUnread = unreadCount > 0

  return (
    <button
      onClick={(event) => onClick(item, event)}
      disabled={disabled}
      className={cn(
        "w-full flex items-center justify-start relative",
        "h-14 p-[var(--spacing-system-m)]",
        "transition-colors duration-300",
        "[&_svg]:transition-colors [&_svg]:duration-300",
        "before:content-[''] before:absolute before:left-0 before:top-0 before:bottom-0 before:w-1",
        "before:transition-colors before:duration-300",
        !isActive && !disabled && "hover:bg-ods-bg-hover text-ods-text-primary [&_svg]:fill-ods-text-secondary",
        !isActive && disabled && "text-ods-text-secondary [&_svg]:fill-ods-text-secondary",
        isActive && !disabled && [
          "bg-[var(--ods-open-yellow-light)] text-ods-accent",
          "[&_svg]:fill-ods-accent",
          "before:bg-ods-accent",
        ],
        isActive && disabled && "text-ods-text-secondary [&_svg]:fill-ods-text-secondary",
        disabled && "cursor-not-allowed opacity-50",
      )}
      title={!showLabel ? item.label : undefined}
      aria-label={item.label}
      aria-current={isActive ? 'page' : undefined}
    >
      <div className="relative flex items-center justify-center flex-shrink-0">
        {cloneElement(item.icon as ReactElement<IconProps>, {
          color: isActive && !disabled ? "text-ods-accent" : "text-ods-text-secondary",
        })}
        {hasUnread && !showLabel && (
          <span className="absolute top-0 right-0 bg-ods-warning rounded-full w-2 h-2" />
        )}
      </div>

      <span
        className={cn(
          "text-h4 flex-1 text-left truncate transition-[opacity,margin-left] duration-300",
          showLabel ? "opacity-100 ml-[var(--spacing-system-xs)]" : "opacity-0 ml-0",
        )}
        aria-hidden={!showLabel}
      >
        {item.label}
      </span>

      {hasUnread && showLabel && (
        <span className="bg-ods-accent flex items-center justify-center flex-shrink-0 p-2 rounded-md size-6">
          <span className="text-h5 text-ods-text-on-accent">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        </span>
      )}
    </button>
  )
}
