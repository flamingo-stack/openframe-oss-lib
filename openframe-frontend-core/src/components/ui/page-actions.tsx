'use client'

import React from 'react'
import type { ButtonProps } from './button'
import { cn } from '../../utils/cn'
import { Button } from './button'
import { DropdownButton } from './dropdown-button'
import { MoreActionsMenu, type MoreActionsItem } from './more-actions-menu'

export type PageActionButton = {
  label: string
  /** Click handler. Optional when `href` is provided. */
  onClick?: () => void
  /** If set, the action renders as a Next.js Link (real <a href> in the DOM). */
  href?: string
  /** Only relevant with `href` — opens the link in a new tab. */
  openInNewTab?: boolean
  icon?: React.ReactNode
  variant?: ButtonProps['variant']
  disabled?: boolean
  loading?: boolean
  /** Show action only on mobile (below md). Default: visible on all screens. */
  showOnlyMobile?: boolean
  /**
   * When set, renders the action as a split button on desktop — main label on
   * the left, chevron on the right that opens a dropdown of alternatives.
   * On mobile these items are flattened into the main "..." menu.
   */
  dropdownItems?: MoreActionsItem[]
}

function actionToMenuItem(action: PageActionButton): MoreActionsItem {
  return {
    label: action.label,
    onClick: action.onClick,
    href: action.href,
    openInNewTab: action.openInNewTab,
    icon: action.icon,
    disabled: action.disabled
  }
}

function actionToMenuItems(action: PageActionButton): MoreActionsItem[] {
  // When `dropdownItems` is set the label itself is not an action — it's just
  // the trigger. Only the dropdown items are clickable targets, so those are
  // what we surface in the mobile "..." menu.
  if (action.dropdownItems && action.dropdownItems.length > 0) {
    return action.dropdownItems
  }
  return [actionToMenuItem(action)]
}

function ActionButton({ action }: { action: PageActionButton }) {
  if (action.dropdownItems && action.dropdownItems.length > 0) {
    return (
      <DropdownButton
        label={action.label}
        icon={action.icon}
        items={action.dropdownItems}
        disabled={!!(action.disabled || action.loading)}
      />
    )
  }
  return (
    <Button
      variant={action.variant}
      onClick={action.onClick}
      href={action.href}
      openInNewTab={action.openInNewTab}
      disabled={action.disabled}
      loading={action.loading}
      leftIcon={action.icon}
    >
      {action.label}
    </Button>
  )
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
  const desktopActions = actions.filter(a => !a.showOnlyMobile)

  const menuItems: MoreActionsItem[] = actions.flatMap(actionToMenuItems)

  const isSingleAction = actions.length === 1 && !actions[0].dropdownItems?.length
  const singleAction = isSingleAction ? actions[0] : null

  return (
    <>
      {/* Desktop: Show all buttons with icons */}
      <div className={cn('hidden md:flex items-center', gapClass, className)}>
        {desktopActions.map((action, idx) => (
          <ActionButton key={`${action.label}-${idx}`} action={action} />
        ))}
      </div>

      {/* Mobile: Show single icon button or MoreActionsMenu */}
      <div className={cn('flex md:hidden', className)}>
        {isSingleAction && singleAction ? (
          <Button
            variant={singleAction.variant}
            size="icon"
            onClick={singleAction.onClick}
            href={singleAction.href}
            openInNewTab={singleAction.openInNewTab}
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

  const desktopActions = sortedActions.filter(a => !a.showOnlyMobile)

  return (
    <>
      {/* Desktop: Normal layout (outline left, primary right) */}
      <div className={cn('hidden md:flex items-center', gapClass, className)}>
        {desktopActions.map((action, idx) => (
          <ActionButton key={`desktop-${action.label}-${idx}`} action={action} />
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
  const desktopActions = actions.filter(a => !a.showOnlyMobile)

  return (
    <>
      {/* Desktop: MoreActionsMenu + primary buttons */}
      <div className={cn('hidden md:flex items-center', gapClass, className)}>
        {menuActions.length > 0 && <MoreActionsMenu items={menuActions} />}
        {desktopActions.map((action, idx) => (
          <ActionButton
            key={`desktop-${action.label}-${idx}`}
            action={{ ...action, variant: action.variant || 'primary' }}
          />
        ))}
      </div>

      {/* Mobile: single "..." menu with primary actions merged in */}
      <div className={cn('flex md:hidden', className)}>
        <MoreActionsMenu
          items={[
            ...actions.flatMap(actionToMenuItems),
            ...menuActions
          ]}
        />
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
          href={action.href}
          openInNewTab={action.openInNewTab}
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
