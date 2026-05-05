'use client'

import React from 'react'
import { cn } from '../../utils/cn'
import { Chevron02DownIcon } from '../icons-v2-generated'
import { ActionsMenuDropdown, type ActionsMenuGroup, type ActionsMenuItem } from './actions-menu'
import type { ButtonProps, SplitButtonIconAction } from './button'
import { Button, SplitButton } from './button'

export type PageActionButton = {
  /** Button label. Omit to render an icon-only button. */
  label?: string
  /** Accessible name. Required for icon-only buttons (when `label` is omitted). */
  ariaLabel?: string
  /** Click handler. Optional when `href` or `submenu` is provided. */
  onClick?: () => void
  icon?: React.ReactNode
  variant?: ButtonProps['variant']
  disabled?: boolean
  /**
   * For SplitButton actions (when `iconAction` is set): disables only the main
   * half. Combine with `iconAction.disabled` for icon-only disable. Ignored
   * for non-SplitButton actions.
   */
  mainDisabled?: boolean
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
  /**
   * Render the action as a `SplitButton` (two independent click targets).
   * The main half runs `onClick`/`href`; the icon half runs its own action.
   * Mutually exclusive with `submenu`.
   */
  iconAction?: SplitButtonIconAction
  /**
   * Render a button with a chevron that opens a dropdown. The whole button is
   * a single click target — clicking anywhere opens the menu.
   * Mutually exclusive with `iconAction` and `href`/`onClick`.
   */
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
    iconAction: action.iconAction
      ? {
          icon: action.iconAction.icon,
          'aria-label': action.iconAction['aria-label'],
          onClick: action.iconAction.onClick as (() => void) | undefined,
          href: action.iconAction.href,
          openInNewTab: action.iconAction.openInNewTab,
          disabled: action.iconAction.disabled,
        }
      : undefined,
  }]
}

interface RenderOptions {
  /** Force the rendered button to be icon-only (label hidden). */
  iconOnly?: boolean
  /** Stretch the button to fill flex parent (used in mobile bottom bar). */
  fullWidth?: boolean
}

function renderActionButton(action: PageActionButton, opts: RenderOptions = {}): React.ReactNode {
  // Two-target SplitButton — primary action + secondary icon action.
  if (action.iconAction) {
    return (
      <SplitButton
        variant={action.variant ?? undefined}
        href={action.href}
        prefetch={action.prefetch}
        openInNewTab={action.openInNewTab}
        onClick={action.onClick}
        disabled={action.disabled}
        mainDisabled={action.mainDisabled}
        leftIcon={action.icon}
        fullWidth={opts.fullWidth}
        iconAction={action.iconAction}
      >
        {action.label}
      </SplitButton>
    )
  }

  // Submenu — single click target with a trailing chevron divider.
  if (action.submenu && action.submenu.length > 0) {
    return (
      <ActionsMenuDropdown
        groups={[{ items: action.submenu }]}
        customTrigger={
          <Button
            variant="outline"
            disabled={action.disabled}
            loading={action.loading}
            leftIcon={action.icon}
            splitIcon={<Chevron02DownIcon className="h-4 w-4" />}
            className={opts.fullWidth ? 'flex-1' : undefined}
          >
            {action.label}
          </Button>
        }
      />
    )
  }

  // Icon-only button (no label, or explicitly icon-only on desktop).
  const isIconOnly = opts.iconOnly || !action.label || action.iconOnlyOnDesktop
  if (isIconOnly) {
    const iconNode = action.iconOnlyOnDesktop
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
        leftIcon={iconNode}
        aria-label={action.label ?? action.ariaLabel}
      />
    )
  }

  // Default labeled button.
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
      className={opts.fullWidth ? 'flex-1' : undefined}
    >
      {action.label}
    </Button>
  )
}

export interface PageActionsProps {
  variant?: 'icon-buttons' | 'primary-buttons' | 'menu-primary'
  actions: PageActionButton[]
  menuActions?: ActionsMenuGroup[]
  /**
   * Desktop-only slot rendered before the action buttons (e.g. a `TabSelector`
   * for view-mode toggles). Hidden on mobile and never merged into the "…" menu.
   * Currently honored by the `icon-buttons` variant.
   */
  selector?: React.ReactNode
  className?: string
}

const ACTIONS_GAP = 'gap-[var(--spacing-system-xs)]'

export function PageActions({
  variant = 'icon-buttons',
  actions,
  menuActions,
  selector,
  className,
}: PageActionsProps) {
  if (variant === 'icon-buttons') {
    return <IconButtonsVariant actions={actions} menuActions={menuActions} selector={selector} className={className} />
  }

  if (variant === 'menu-primary') {
    return <MenuPrimaryVariant actions={actions} menuActions={menuActions || []} className={className} />
  }

  return <PrimaryButtonsVariant actions={actions} className={className} />
}

function IconButtonsVariant({
  actions,
  menuActions,
  selector,
  className,
}: {
  actions: PageActionButton[]
  menuActions?: ActionsMenuGroup[]
  selector?: React.ReactNode
  className?: string
}) {
  const desktopActions = actions.filter(a => !a.showOnlyMobile)
  const hasMenuActions = !!menuActions && menuActions.some(g => g.items.length > 0)

  const isSingleAction = actions.length === 1 && !actions[0].submenu?.length
  const singleAction = isSingleAction ? actions[0] : null
  const useSingleActionMobile = isSingleAction && !hasMenuActions

  return (
    <>
      {/* Desktop: every action as an icon button + optional overflow menu */}
      <div className={cn('hidden md:flex items-center', ACTIONS_GAP, className)}>
        {selector}
        {desktopActions.map((action, idx) => (
          <React.Fragment key={actionKey(action, idx)}>
            {renderActionButton(action)}
          </React.Fragment>
        ))}
        {hasMenuActions && <ActionsMenuDropdown groups={menuActions} />}
      </div>

      {/* Mobile: single icon button OR all actions merged into one "..." menu */}
      <div className={cn('flex md:hidden', className)}>
        {useSingleActionMobile && singleAction ? (
          renderActionButton(singleAction, { iconOnly: true })
        ) : (
          <ActionsMenuDropdown
            groups={[
              { items: actions.flatMap(actionToMenuItems) },
              ...(menuActions ?? []),
            ]}
          />
        )}
      </div>
    </>
  )
}

/**
 * Primary buttons variant — primary + outline buttons on desktop,
 * fixed bottom bar on mobile.
 */
function PrimaryButtonsVariant({
  actions,
  className,
}: {
  actions: PageActionButton[]
  className?: string
}) {
  // Sort: outline first, accent last (rightmost on desktop).
  const sortedActions = [...actions].sort((a, b) => {
    if (a.variant === 'accent' && b.variant !== 'accent') return 1
    if (a.variant !== 'accent' && b.variant === 'accent') return -1
    return 0
  })

  const desktopActions = sortedActions.filter(a => !a.showOnlyMobile)

  return (
    <>
      <div className={cn('hidden md:flex items-center', ACTIONS_GAP, className)}>
        {desktopActions.map((action, idx) => (
          <React.Fragment key={`desktop-${actionKey(action, idx)}`}>
            {renderActionButton(action)}
          </React.Fragment>
        ))}
      </div>

      <MobileBottomActions actions={sortedActions} />
    </>
  )
}

/**
 * Menu + primary variant — "..." menu + primary buttons on desktop,
 * all actions merged into a single "..." menu on mobile.
 */
function MenuPrimaryVariant({
  actions,
  menuActions,
  className,
}: {
  actions: PageActionButton[]
  menuActions: ActionsMenuGroup[]
  className?: string
}) {
  const desktopActions = actions.filter(a => !a.showOnlyMobile)
  const hasMenuActions = menuActions.some(g => g.items.length > 0)

  return (
    <>
      <div className={cn('hidden md:flex items-center', ACTIONS_GAP, className)}>
        {hasMenuActions && <ActionsMenuDropdown groups={menuActions} />}
        {desktopActions.map((action, idx) => (
          <React.Fragment key={`desktop-${actionKey(action, idx)}`}>
            {renderActionButton({ ...action, variant: action.variant || 'accent' })}
          </React.Fragment>
        ))}
      </div>

      <div className={cn('flex md:hidden', className)}>
        <ActionsMenuDropdown
          groups={[
            { items: actions.flatMap(actionToMenuItems) },
            ...menuActions,
          ]}
        />
      </div>
    </>
  )
}

function MobileBottomActions({ actions }: { actions: PageActionButton[] }) {
  return (
    <div className={cn(
      'fixed md:hidden bottom-0 left-0 right-0 z-50',
      'bg-ods-card border-t border-ods-border',
      'flex items-start pt-6 pb-6 px-6',
      ACTIONS_GAP,
    )}>
      {actions.map((action, idx) => (
        <React.Fragment key={`mobile-${actionKey(action, idx)}`}>
          {renderActionButton(action, { fullWidth: !!action.label })}
        </React.Fragment>
      ))}
    </div>
  )
}

export function usePageActionsBottomPadding(variant: PageActionsProps['variant']) {
  return variant === 'primary-buttons' || variant === 'menu-primary' ? 'pb-40 md:pb-0' : ''
}

export default PageActions
