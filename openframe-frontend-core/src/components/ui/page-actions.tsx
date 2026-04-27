'use client'

import React from 'react'
import { cn } from '../../utils/cn'
import { Chevron02DownIcon } from '../icons-v2-generated'
import { ActionsMenuDropdown, type ActionsMenuGroup, type ActionsMenuItem } from './actions-menu'
import type { ButtonProps } from './button'
import { Button } from './button'

export type PageActionButton = {
  /** Button label. Omit to render an icon-only button (icon becomes `centerIcon`). */
  label?: string
  /** Accessible name. Required for icon-only buttons (when `label` is omitted). */
  ariaLabel?: string
  /** Click handler. Optional when `href` or `submenu` is provided. */
  onClick?: () => void
  icon?: React.ReactNode
  variant?: ButtonProps['variant']
  disabled?: boolean
  loading?: boolean
  /** Show action only on mobile (below md). Default: visible on all screens. */
  showOnlyMobile?: boolean
  /**
   * Render the desktop button as icon-only (label hidden, icon centered). The full
   * label still appears in the mobile "..." dropdown. The desktop icon is forced to
   * `text-ods-text-primary`; the mobile row keeps the caller-provided icon color.
   */
  iconOnlyOnDesktop?: boolean
  /** Render as a link (next/link). Mutually exclusive with `submenu`. */
  href?: string
  /** Forwarded to next/link's prefetch. Only applies when `href` is set. */
  prefetch?: boolean
  /** Open link in a new tab. Only applies when `href` is set. */
  openInNewTab?: boolean
  /** Render a split button with a chevron opening a dropdown. Mutually exclusive with `href`/`onClick`. */
  submenu?: ActionsMenuItem[]
}

function actionKey(action: PageActionButton, idx: number) {
  return `${action.label ?? action.ariaLabel ?? 'action'}-${idx}`
}

function actionToMenuItems(action: PageActionButton, idx: number): ActionsMenuItem[] {
  if (action.submenu && action.submenu.length > 0) {
    // When a split-button action collapses into the merged mobile "..." menu,
    // its chevron disappears and its children become sibling rows. Prefix
    // each child with the parent label.
    if (!action.label) return action.submenu
    return action.submenu.map(item => ({
      ...item,
      label: `${action.label} (${item.label})`,
    }))
  }

  if (!action.label) return []
  return [{
    id: `action-${idx}`,
    label: action.label,
    icon: action.icon,
    onClick: action.onClick,
    disabled: action.disabled,
    href: action.href,
  }]
}

function ActionButton({ action }: { action: PageActionButton }) {
  if (action.submenu && action.submenu.length > 0) {
    return (
      <ActionsMenuDropdown
        groups={[{ items: action.submenu }]}
        customTrigger={
          <Button
            variant="split-action"
            disabled={action.disabled}
            loading={action.loading}
            leftIcon={action.icon}
            rightIcon={<Chevron02DownIcon className="h-4 w-4" />}
          >
            {action.label}
          </Button>
        }
      />
    )
  }

  if (!action.label || action.iconOnlyOnDesktop) {
    const centerIcon = action.iconOnlyOnDesktop
      ? <span className="inline-flex [&_svg]:!text-ods-text-primary">{action.icon}</span>
      : action.icon
    return (
      <Button
        variant={action.variant}
        size="icon"
        href={action.href}
        prefetch={action.prefetch}
        openInNewTab={action.openInNewTab}
        onClick={action.onClick}
        disabled={action.disabled}
        loading={action.loading}
        centerIcon={centerIcon}
        aria-label={action.label ?? action.ariaLabel}
      />
    )
  }

  return (
    <Button
      variant={action.variant}
      href={action.href}
      prefetch={action.prefetch}
      openInNewTab={action.openInNewTab}
      onClick={action.onClick}
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
  menuActions?: ActionsMenuGroup[]
  className?: string
  gap?: 'sm' | 'md' | 'lg'
}

export function PageActions({
  variant = 'icon-buttons',
  actions,
  menuActions,
  className,
  gap = 'sm'
}: PageActionsProps) {
  const gapClasses = {
    sm: 'gap-2',
    md: 'gap-4',
    lg: 'gap-6'
  }

  if (variant === 'icon-buttons') {
    return <IconButtonsVariant actions={actions} menuActions={menuActions} className={className} gapClass={gapClasses[gap]} />
  }

  if (variant === 'menu-primary') {
    return <MenuPrimaryVariant actions={actions} menuActions={menuActions || []} className={className} gapClass={gapClasses[gap]} />
  }

  return <PrimaryButtonsVariant actions={actions} className={className} gapClass={gapClasses[gap]} />
}

function IconButtonsVariant({
  actions,
  menuActions,
  className,
  gapClass
}: {
  actions: PageActionButton[]
  menuActions?: ActionsMenuGroup[]
  className?: string
  gapClass: string
}) {
  const desktopActions = actions.filter(a => !a.showOnlyMobile)
  const hasMenuActions = !!menuActions && menuActions.some(g => g.items.length > 0)

  const isSingleAction = actions.length === 1 && !actions[0].submenu?.length
  const singleAction = isSingleAction ? actions[0] : null
  const useSingleActionMobile = isSingleAction && !hasMenuActions

  return (
    <>
      {/* Desktop: Show all buttons with icons, plus an overflow menu at the end */}
      <div className={cn('hidden md:flex items-center', gapClass, className)}>
        {desktopActions.map((action, idx) => (
          <ActionButton key={actionKey(action, idx)} action={action} />
        ))}
        {hasMenuActions && <ActionsMenuDropdown groups={menuActions} />}
      </div>

      {/* Mobile: Show single icon button, or one merged ActionsMenu with every item */}
      <div className={cn('flex md:hidden', className)}>
        {useSingleActionMobile && singleAction ? (
          <Button
            variant={singleAction.variant}
            size="icon"
            onClick={singleAction.onClick}
            href={singleAction.href}
            prefetch={singleAction.prefetch}
            openInNewTab={singleAction.openInNewTab}
            disabled={singleAction.disabled}
            loading={singleAction.loading}
            centerIcon={singleAction.icon}
            aria-label={singleAction.label ?? singleAction.ariaLabel}
          />
        ) : (
          <ActionsMenuDropdown
            groups={[
              { items: actions.flatMap(actionToMenuItems) },
              ...(menuActions ?? [])
            ]}
          />
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
          <ActionButton key={`desktop-${actionKey(action, idx)}`} action={action} />
        ))}
      </div>

      {/* Mobile: Fixed bottom bar */}
      <MobileBottomActions actions={sortedActions} gapClass={gapClass} />
    </>
  )
}

/**
 * Menu + primary variant - shows menu ("...") + primary button on desktop,
 * all actions move to a single "..." menu on mobile
 */
function MenuPrimaryVariant({
  actions,
  menuActions,
  className,
  gapClass
}: {
  actions: PageActionButton[]
  menuActions: ActionsMenuGroup[]
  className?: string
  gapClass: string
}) {
  const desktopActions = actions.filter(a => !a.showOnlyMobile)
  const hasMenuActions = menuActions.some(g => g.items.length > 0)

  return (
    <>
      {/* Desktop: menu dropdown + action buttons */}
      <div className={cn('hidden md:flex items-center', gapClass, className)}>
        {hasMenuActions && <ActionsMenuDropdown groups={menuActions} />}
        {desktopActions.map((action, idx) => (
          <ActionButton
            key={`desktop-${actionKey(action, idx)}`}
            action={{ ...action, variant: action.variant || 'primary' }}
          />
        ))}
      </div>

      {/* Mobile: single "..." menu with actions merged in */}
      <div className={cn('flex md:hidden', className)}>
        <ActionsMenuDropdown
          groups={[
            { items: actions.flatMap(actionToMenuItems) },
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
        action.label ? (
          <Button
            key={`mobile-${actionKey(action, idx)}`}
            variant={action.variant}
            onClick={action.onClick}
            href={action.href}
            prefetch={action.prefetch}
            openInNewTab={action.openInNewTab}
            leftIcon={action.icon}
            disabled={action.disabled}
            loading={action.loading}
            className={'flex-1'}
          >
            {action.label}
          </Button>
        ) : (
          <Button
            key={`mobile-${actionKey(action, idx)}`}
            variant={action.variant}
            size="icon"
            onClick={action.onClick}
            href={action.href}
            prefetch={action.prefetch}
            openInNewTab={action.openInNewTab}
            centerIcon={action.icon}
            disabled={action.disabled}
            loading={action.loading}
            aria-label={action.ariaLabel}
          />
        )
      ))}
    </div>
  )
}

export function usePageActionsBottomPadding(variant: PageActionsProps['variant']) {
  return variant === 'primary-buttons' || variant === 'menu-primary' ? 'pb-40 md:pb-0' : ''
}

export default PageActions
