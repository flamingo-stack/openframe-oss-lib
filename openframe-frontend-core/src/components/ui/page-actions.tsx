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
  /**
   * Variant determines the layout and button styles
   * - 'icon-buttons': Buttons with icons (outline style), collapses to MoreActionsMenu on mobile
   * - 'primary-buttons': Primary + outline button combo, becomes full-width fixed bottom on mobile
   */
  variant?: 'icon-buttons' | 'primary-buttons'
  /**
   * Action buttons to display
   * For 'icon-buttons': All buttons rendered as outline with icons
   * For 'primary-buttons': First button is primary, second is outline
   */
  actions: PageActionButton[]
  /**
   * Additional CSS classes for the container
   */
  className?: string
  /**
   * Gap between buttons (default: 16px)
   */
  gap?: 'sm' | 'md' | 'lg'
}

/**
 * PageActions component for displaying action buttons in page headers.
 *
 * Two variants:
 * 1. 'icon-buttons' - Buttons with icons, collapses to dropdown menu on mobile
 * 2. 'primary-buttons' - Primary + outline buttons, fixed to bottom on mobile
 *
 * @example
 * // Icon buttons variant (for list pages)
 * <PageActions
 *   variant="icon-buttons"
 *   actions={[
 *     { label: 'Edit Categories', onClick: () => {}, icon: <ColorsIcon /> },
 *     { label: 'Add Script', onClick: () => {}, icon: <PlusCircleIcon /> }
 *   ]}
 * />
 *
 * @example
 * // Primary buttons variant (for detail/form pages)
 * <PageActions
 *   variant="primary-buttons"
 *   actions={[
 *     { label: 'Save Script', onClick: () => {}, variant: 'primary' },
 *     { label: 'Test Script', onClick: () => {}, variant: 'outline' }
 *   ]}
 * />
 */
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

/**
 * Icon buttons variant - shows buttons with icons on desktop,
 * collapses to MoreActionsMenu on mobile (or shows single icon button if only one action)
 */
function IconButtonsVariant({
  actions,
  className,
  gapClass
}: {
  actions: PageActionButton[]
  className?: string
  gapClass: string
}) {
  // Convert actions to MoreActionsMenu items for mobile
  const menuItems: MoreActionsItem[] = actions.map(action => ({
    label: action.label,
    onClick: action.onClick,
    icon: action.icon,
    disabled: action.disabled
  }))

  // If only one action, show it as icon button on mobile instead of menu
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
            className="bg-ods-card border-ods-border hover:bg-ods-bg-hover"
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
            className="bg-ods-card border-ods-border hover:bg-ods-bg-hover"
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
    if (a.variant === 'primary' && b.variant !== 'primary') return -1
    if (a.variant !== 'primary' && b.variant === 'primary') return 1
    return 0
  })

  // Reverse for desktop (primary on right)
  const desktopActions = [...sortedActions].reverse()

  return (
    <>
      {/* Desktop: Normal layout (outline left, primary right) */}
      <div className={cn('hidden md:flex items-center', gapClass, className)}>
        {desktopActions.map((action, idx) => (
          <Button
            key={`desktop-${action.label}-${idx}`}
            variant={action.variant === 'primary' ? 'primary' : 'outline'}
            onClick={action.onClick}
            disabled={action.disabled}
            loading={action.loading}
            leftIcon={action.icon}
            className={action.variant !== 'primary' ? 'bg-ods-card border-ods-border hover:bg-ods-bg-hover' : ''}
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
 * Mobile bottom fixed action bar
 */
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
          variant={action.variant === 'primary' ? 'primary' : 'outline'}
          onClick={action.onClick}
          disabled={action.disabled}
          loading={action.loading}
          className={cn(
            'flex-1',
            action.variant !== 'primary' && 'bg-ods-card border-ods-border'
          )}
        >
          {action.label}
        </Button>
      ))}
    </div>
  )
}

/**
 * Hook to add bottom padding to page content when using primary-buttons variant
 * This prevents content from being hidden behind the fixed mobile action bar
 */
export function usePageActionsBottomPadding(variant: PageActionsProps['variant']) {
  return variant === 'primary-buttons' ? 'pb-40 md:pb-0' : ''
}

export default PageActions
