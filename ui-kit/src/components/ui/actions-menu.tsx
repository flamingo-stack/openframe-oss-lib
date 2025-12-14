'use client'

import React, { useState, useRef, useEffect, useCallback } from 'react'
import ReactDOM from 'react-dom'
import { ChevronRight, Check, ExternalLink } from 'lucide-react'

export interface ActionsMenuItem {
  id: string
  label: string
  icon?: React.ReactNode
  onClick?: () => void
  disabled?: boolean
  type?: 'item' | 'checkbox' | 'submenu' | 'separator'
  checked?: boolean
  submenu?: ActionsMenuItem[]
  /** Optional URL for navigation items */
  href?: string
  /** Show an external link icon on hover that opens href in a new tab */
  showExternalLinkOnHover?: boolean
}

export interface ActionsMenuGroup {
  items: ActionsMenuItem[]
  separator?: boolean
}

export interface ActionsMenuProps {
  groups: ActionsMenuGroup[]
  className?: string
  onItemClick?: (item: ActionsMenuItem) => void
}

interface MenuItemProps {
  item: ActionsMenuItem
  onItemClick?: (item: ActionsMenuItem) => void
  isNested?: boolean
  parentCloseHandler?: () => void
}

const MenuItem: React.FC<MenuItemProps> = ({ 
  item, 
  onItemClick, 
  isNested = false,
  parentCloseHandler
}) => {
  const [showSubmenu, setShowSubmenu] = useState(false)
  const [submenuPosition, setSubmenuPosition] = useState({ top: 0, left: 0 })
  const itemRef = useRef<HTMLDivElement>(null)
  const submenuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (showSubmenu && itemRef.current) {
      const rect = itemRef.current.getBoundingClientRect()
      const submenuWidth = 256 // min-w-[256px]
      const viewportWidth = window.innerWidth

      // Check available space on both sides
      const spaceRight = viewportWidth - rect.right
      const spaceLeft = rect.left

      let left: number
      if (spaceRight >= submenuWidth + 4) {
        // Position to the right (default)
        left = rect.right + 4
      } else if (spaceLeft >= submenuWidth + 4) {
        // Position to the left
        left = rect.left - submenuWidth - 4
      } else {
        // Fallback: position to whichever side has more space
        left = spaceRight >= spaceLeft ? rect.right + 4 : rect.left - submenuWidth - 4
      }

      setSubmenuPosition({
        top: rect.top,
        left
      })
    }
  }, [showSubmenu])

  const closeSubmenu = useCallback(() => {
    setShowSubmenu(false)
  }, [])

  const handleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    e.preventDefault()

    // Don't allow clicks on disabled items
    if (item.disabled) {
      return
    }

    if (item.type === 'submenu') {
      setShowSubmenu(prev => !prev)
    } else if (item.type === 'checkbox') {
      item.onClick?.()
      onItemClick?.(item)
    } else if (item.onClick) {
      item.onClick()
      onItemClick?.(item)

      if (isNested && parentCloseHandler) {
        parentCloseHandler()
      }
    }
  }, [item, onItemClick, isNested, parentCloseHandler])

  const handleExternalClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    e.preventDefault()
    if (item.href) {
      window.open(item.href, '_blank', 'noopener,noreferrer')
    }
    onItemClick?.(item)
    if (isNested && parentCloseHandler) {
      parentCloseHandler()
    }
  }, [item, onItemClick, isNested, parentCloseHandler])

  useEffect(() => {
    if (showSubmenu) {
      const handleClickOutside = (e: MouseEvent) => {
        if (
          itemRef.current && 
          !itemRef.current.contains(e.target as Node) &&
          submenuRef.current &&
          !submenuRef.current.contains(e.target as Node)
        ) {
          setShowSubmenu(false)
        }
      }

      document.addEventListener('mousedown', handleClickOutside)
      return () => {
        document.removeEventListener('mousedown', handleClickOutside)
      }
    }
  }, [showSubmenu])

  if (item.type === 'separator') {
    return <div className="bg-ods-system-greys-soft-grey h-1 w-full" />
  }

  const itemClasses = `
    flex items-center gap-2 px-3 py-3 cursor-pointer transition-colors
    bg-ods-card
    ${item.disabled
      ? 'text-ods-text-secondary cursor-not-allowed'
      : 'text-ods-text-primary hover:bg-[#2b2b2b]'
    }
    ${showSubmenu && item.type === 'submenu' ? 'bg-[#2b2b2b]' : ''}
    ${!isNested ? 'border-b border-ods-border' : ''}
    ${item.showExternalLinkOnHover && item.href ? 'group' : ''}
  `

  return (
    <div className="relative">
      <div
        ref={itemRef}
        className={itemClasses}
        onClick={handleClick}
      >
        {item.icon && (
          <div className={`w-6 h-6 flex-shrink-0 flex items-center justify-center ${item.disabled ? 'opacity-50' : ''}`}>
            {item.icon}
          </div>
        )}
        
        <span className={`flex-1 text-[18px] font-medium leading-6 ${item.disabled ? 'text-ods-text-secondary' : 'text-ods-text-primary'}`}>
          {item.label}
        </span>

        {/* External link icon - appears on hover */}
        {item.showExternalLinkOnHover && item.href && !item.disabled && (
          <span
            className="opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={handleExternalClick}
          >
            <ExternalLink
              className="w-5 h-5 text-ods-text-secondary hover:text-ods-text-primary transition-colors cursor-pointer"
            />
          </span>
        )}

        {item.type === 'checkbox' && (
          <div className={`
            w-6 h-6 flex items-center justify-center rounded-md transition-colors
            ${item.checked 
              ? 'bg-[#ffc008]' 
              : 'border-2 border-ods-border bg-transparent'
            }
          `}>
            {item.checked && <Check className="w-4 h-4 text-black" strokeWidth={3} />}
          </div>
        )}

        {item.type === 'submenu' && (
          <ChevronRight className="w-6 h-6 text-ods-text-secondary" />
        )}
      </div>

      {/* Submenu */}
      {item.type === 'submenu' && showSubmenu && item.submenu && typeof window !== 'undefined' && ReactDOM.createPortal(
        <div
          ref={submenuRef}
          className="fixed z-[9999] min-w-[256px] bg-[#161616] border border-ods-border rounded-md shadow-xl overflow-hidden"
          style={{ 
            top: `${submenuPosition.top}px`,
            left: `${submenuPosition.left}px`
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {item.submenu.map((subItem, index) => (
            <MenuItem
              key={subItem.id || index}
              item={subItem}
              onItemClick={onItemClick}
              isNested={true}
              parentCloseHandler={closeSubmenu}
            />
          ))}
        </div>,
        document.body
      )}
    </div>
  )
}

const GroupSeparator: React.FC = () => (
  <div className="bg-ods-system-greys-soft-grey h-1 w-full" />
)

export const ActionsMenu: React.FC<ActionsMenuProps> = ({ 
  groups, 
  className = '', 
  onItemClick 
}) => {
  return (
    <div className={`relative min-w-[256px] bg-[#161616] border border-ods-border rounded-md shadow-lg ${className}`}>
      {groups.map((group, groupIndex) => (
        <React.Fragment key={groupIndex}>
          {group.items.map((item, itemIndex) => (
            <MenuItem
              key={item.id || `${groupIndex}-${itemIndex}`}
              item={item}
              onItemClick={onItemClick}
            />
          ))}
          {group.separator && groupIndex < groups.length - 1 && <GroupSeparator />}
        </React.Fragment>
      ))}
    </div>
  )
}

export default ActionsMenu