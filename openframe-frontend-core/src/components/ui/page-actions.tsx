'use client'

import React from 'react'
import { cn } from '../../utils/cn'
import { Ellipsis01Icon } from '../icons-v2-generated'
import { Button } from './button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from './dropdown-menu'
import { MoreActionsMenu, type MoreActionsItem } from './more-actions-menu'

export type PageActionButton = {
  label: string
  onClick: () => void
  icon?: React.ReactNode
  variant?: 'primary' | 'outline'
  disabled?: boolean
  loading?: boolean
}

export interface PageActionsProps {
  variant?: 'icon-buttons' | 'primary-buttons' | 'menu-primary'
  actions: PageActionButton[]
  menuActions?: MoreActionsItem[]
  className?: string
  gap?: 'sm' | 'md' | 'lg'
}

export function PageActions({
  variant = 'icon-buttons',
  actions,
  menuActions,
  className,
  gap = 'md'
}: PageActionsProps) {
  const gapClasses = {
    sm: 'gap-2',
    md: 'gap-4',
    lg: 'gap-6'
  }

  if (variant === 'icon-buttons') {
    return <IconButtonsVariant actions={actions} className={className} gapClass={gapClasses[gap]} />
  }

  if (variant === 'menu-primary') {
    return <MenuPrimaryVariant actions={actions} menuActions={menuActions || []} className={className} gapClass={gapClasses[gap]} />
  }

  return <PrimaryButtonsVariant actions={actions} className={className} gapClass={gapClasses[gap]} />
}

function IconButtonsVariant({
  actions,
  className,
  gapClass
}: {
  actions: PageActionButton[]
  className?: string
  gapClass: string
}) {
  const menuItems: MoreActionsItem[] = actions.map(action => ({
    label: action.label,
    onClick: action.onClick,
    icon: action.icon,
    disabled: action.disabled
  }))

  const isSingleAction = actions.length === 1
  const singleAction = isSingleAction ? actions[0] : null

  return (
    <>
      {/* Desktop: Show all buttons with icons */}
      <div className={cn('hidden md:flex items-center', gapClass, className)}>
        {actions.map((action, idx) => (
          <Button
            key={`${action.label}-${idx}`}
            variant="outline"
            onClick={action.onClick}
            disabled={action.disabled}
            loading={action.loading}
            leftIcon={action.icon}
          >
            {action.label}
          </Button>
        ))}
      </div>

      {/* Mobile: Show single icon button or MoreActionsMenu */}
      <div className={cn('flex md:hidden', className)}>
        {isSingleAction && singleAction ? (
          <Button
            variant="outline"
            size="icon"
            onClick={singleAction.onClick}
            disabled={singleAction.disabled}
            loading={singleAction.loading}
            centerIcon={singleAction.icon}
            aria-label={singleAction.label}
          />
        ) : (
          <MoreActionsMenu items={menuItems} />
        )}
      </div>
    </>
  )
}

/**
 * Primary buttons variant - shows primary + outline buttons,
 * becomes fixed bottom bar on mobile
 */
function PrimaryButtonsVariant({
  actions,
  className,
  gapClass
}: {
  actions: PageActionButton[]
  className?: string
  gapClass: string
}) {
  // Sort actions: primary first, then outline
  const sortedActions = [...actions].sort((a, b) => {
    if (a.variant === 'primary' && b.variant !== 'primary') return 1
    if (a.variant !== 'primary' && b.variant === 'primary') return -1
    return 0
  })

  return (
    <>
      {/* Desktop: Normal layout (outline left, primary right) */}
      <div className={cn('hidden md:flex items-center', gapClass, className)}>
        {sortedActions.map((action, idx) => (
          <Button
            key={`desktop-${action.label}-${idx}`}
            variant={action.variant}
            onClick={action.onClick}
            disabled={action.disabled}
            loading={action.loading}
            leftIcon={action.icon}
          >
            {action.label}
          </Button>
        ))}
      </div>

      {/* Mobile: Fixed bottom bar */}
      <MobileBottomActions actions={sortedActions} gapClass={gapClass} />
    </>
  )
}

/**
 * Menu + primary variant - shows MoreActionsMenu ("...") + primary button on desktop,
 * all actions move to a fixed bottom bar on mobile
 */
function MenuPrimaryVariant({
  actions,
  menuActions,
  className,
  gapClass
}: {
  actions: PageActionButton[]
  menuActions: MoreActionsItem[]
  className?: string
  gapClass: string
}) {
  return (
    <>
      {/* Desktop: MoreActionsMenu + primary buttons */}
      <div className={cn('hidden md:flex items-center', gapClass, className)}>
        {menuActions.length > 0 && <MoreActionsMenu items={menuActions} />}
        {actions.map((action, idx) => (
          <Button
            key={`desktop-${action.label}-${idx}`}
            variant={action.variant || 'primary'}
            onClick={action.onClick}
            disabled={action.disabled}
            loading={action.loading}
            leftIcon={action.icon}
          >
            {action.label}
          </Button>
        ))}
      </div>

      {/* Mobile: Fixed bottom bar — full-width menu button + primary buttons */}
      <div className={cn(
        'fixed md:hidden bottom-0 left-0 right-0 z-50',
        'bg-ods-card border-t border-ods-border',
        'flex items-start pt-6 pb-6 px-6',
        gapClass
      )}>
        {menuActions.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                className="flex-1"
                aria-label="More actions"
                centerIcon={<Ellipsis01Icon size={24} className="text-text-primary" />}
              />
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="start"
              side="top"
              sideOffset={6}
              className="bg-ods-card border border-ods-border p-0 rounded-[4px] min-w-[200px]"
            >
              {menuActions.map((item, idx) => (
                <DropdownMenuItem
                  key={`mobile-menu-${item.label}-${idx}`}
                  onClick={(e) => {
                    e.stopPropagation()
                    if (!item.disabled) item.onClick()
                  }}
                  disabled={item.disabled}
                  className="flex items-center gap-2 px-4 py-3 bg-ods-bg hover:bg-ods-bg-hover focus:bg-ods-bg-hover border-b border-ods-border last:border-b-0 rounded-none cursor-pointer data-[disabled]:opacity-50 data-[disabled]:cursor-not-allowed"
                >
                  {item.icon && (
                    <div className={cn(item.danger ? 'text-ods-error' : 'text-ods-text-secondary', '[&_svg]:size-6 [&_svg]:shrink-0')}>{item.icon}</div>
                  )}
                  <span className={`font-medium text-[18px] leading-6 ${item.danger ? 'text-ods-text-primary' : 'text-ods-text-primary'}`}>
                    {item.label}
                  </span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
        {actions.map((action, idx) => (
          <Button
            key={`mobile-${action.label}-${idx}`}
            variant={action.variant || 'primary'}
            onClick={action.onClick}
            disabled={action.disabled}
            loading={action.loading}
            leftIcon={action.icon}
            className="flex-1"
          >
            {action.label}
          </Button>
        ))}
      </div>
    </>
  )
}

function MobileBottomActions({
  actions,
  gapClass
}: {
  actions: PageActionButton[]
  gapClass: string
}) {
  return (
    <div className={cn(
      'fixed md:hidden bottom-0 left-0 right-0 z-50',
      'bg-ods-card border-t border-ods-border',
      'flex items-start pt-6 pb-6 px-6',
      gapClass
    )}>
      {actions.map((action, idx) => (
        <Button
          key={`mobile-${action.label}-${idx}`}
          variant={action.variant}
          onClick={action.onClick}
          leftIcon={action.icon}
          disabled={action.disabled}
          loading={action.loading}
          className={'flex-1'}
        >
          {action.label}
        </Button>
      ))}
    </div>
  )
}

export function usePageActionsBottomPadding(variant: PageActionsProps['variant']) {
  return variant === 'primary-buttons' || variant === 'menu-primary' ? 'pb-40 md:pb-0' : ''
}

export default PageActions
