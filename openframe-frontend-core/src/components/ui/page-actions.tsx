'use client'

import React from 'react'
import { cn } from '../../utils/cn'
import { Button } from './button'
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
  variant?: 'icon-buttons' | 'primary-buttons'
  actions: PageActionButton[]
  className?: string
  gap?: 'sm' | 'md' | 'lg'
}

export function PageActions({
  variant = 'icon-buttons',
  actions,
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
  return variant === 'primary-buttons' ? 'pb-40 md:pb-0' : ''
}

export default PageActions
