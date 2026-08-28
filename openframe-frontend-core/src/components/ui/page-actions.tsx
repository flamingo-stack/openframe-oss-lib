'use client';

import React from 'react';
import { cn } from '../../utils/cn';
import { Chevron02DownIcon } from '../icons-v2-generated';
import { ActionsMenuDropdown, type ActionsMenuGroup, type ActionsMenuItem } from './actions-menu';
import type { ButtonProps, SplitButtonIconAction } from './button';
import { Button, SplitButton } from './button';
import { Skeleton } from './skeleton';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './tooltip';

export type PageActionButton = {
  /** Button label. Omit to render an icon-only button. */
  label?: string;
  /** Accessible name. Required for icon-only buttons (when `label` is omitted). */
  ariaLabel?: string;
  /** Click handler. Optional when `href` or `submenu` is provided. */
  onClick?: () => void;
  icon?: React.ReactNode;
  /** `overlay` is media chrome only — SplitButton has no divider colour for it. */
  variant?: Exclude<ButtonProps['variant'], 'overlay' | 'glyph'>;
  disabled?: boolean;
  /**
   * For SplitButton actions (when `iconAction` is set): disables only the main
   * half. Combine with `iconAction.disabled` for icon-only disable. Ignored
   * for non-SplitButton actions.
   */
  mainDisabled?: boolean;
  loading?: boolean;
  /** Show action only on mobile (below md). Default: visible on all screens. */
  showOnlyMobile?: boolean;
  /**
   * Render the desktop button as icon-only (label hidden, icon centered). The full
   * label still appears in the mobile "..." dropdown. The desktop icon is forced to
   * `text-ods-text-primary`; the mobile row keeps the caller-provided icon color.
   */
  iconOnlyOnDesktop?: boolean;
  /** Render as a link (next/link). Mutually exclusive with `submenu`. */
  href?: string;
  /** Forwarded to next/link's prefetch. Only applies when `href` is set. */
  prefetch?: boolean;
  /** Open link in a new tab. Only applies when `href` is set. */
  openInNewTab?: boolean;
  /**
   * Render the action as a `SplitButton` (two independent click targets).
   * The main half runs `onClick`/`href`; the icon half runs its own action.
   * Mutually exclusive with `submenu`.
   */
  iconAction?: SplitButtonIconAction;
  /**
   * Render a button with a chevron that opens a dropdown. The whole button is
   * a single click target — clicking anywhere opens the menu.
   * Mutually exclusive with `iconAction` and `href`/`onClick`.
   */
  submenu?: ActionsMenuItem[];
  /** When set, the rendered desktop button is wrapped in a hover tooltip. */
  tooltip?: React.ReactNode;
};

function actionKey(action: PageActionButton, idx: number) {
  return `${action.label ?? action.ariaLabel ?? 'action'}-${idx}`;
}

function actionToMenuItems(action: PageActionButton, idx: number): ActionsMenuItem[] {
  if (action.submenu && action.submenu.length > 0) {
    // When a split-button action collapses into the merged mobile "..." menu,
    // its chevron disappears and its children become sibling rows. Prefix
    // each child with the parent label.
    if (!action.label) return action.submenu;
    return action.submenu.map(item => ({
      ...item,
      label: `${action.label} (${item.label})`,
    }));
  }

  if (!action.label) return [];
  return [
    {
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
    },
  ];
}

interface RenderOptions {
  /** Force the rendered button to be icon-only (label hidden). */
  iconOnly?: boolean;
  /** Stretch the button to fill flex parent (used in mobile bottom bar). */
  fullWidth?: boolean;
}

function renderActionButton(action: PageActionButton, opts: RenderOptions = {}): React.ReactNode {
  const button = renderRawActionButton(action, opts);
  if (!action.tooltip) return button;
  return (
    <TooltipProvider delayDuration={0}>
      <Tooltip>
        <TooltipTrigger asChild>{button}</TooltipTrigger>
        <TooltipContent>{action.tooltip}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function renderRawActionButton(action: PageActionButton, opts: RenderOptions = {}): React.ReactNode {
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
    );
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
    );
  }

  // Icon-only button (no label, or explicitly icon-only on desktop).
  const isIconOnly = opts.iconOnly || !action.label || action.iconOnlyOnDesktop;
  if (isIconOnly) {
    const iconNode = action.iconOnlyOnDesktop ? (
      <span className="inline-flex [&_svg]:!text-ods-text-primary">{action.icon}</span>
    ) : (
      action.icon
    );
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
    );
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
  );
}

export interface PageActionsProps {
  variant?: 'icon-buttons' | 'primary-buttons' | 'menu-primary';
  actions: PageActionButton[];
  menuActions?: ActionsMenuGroup[];
  /**
   * Desktop-only slot rendered before the action buttons (e.g. a `TabSelector`
   * for view-mode toggles). Hidden on mobile and never merged into the "…" menu.
   * Honored by the `icon-buttons` and `menu-primary` variants.
   */
  selector?: React.ReactNode;
  className?: string;
  /**
   * Render placeholders instead of the actions — for pages whose action SET
   * depends on data still in flight. Opt-in: a page whose actions are already
   * final while its title loads keeps rendering them.
   */
  loading?: boolean;
}

const ACTIONS_GAP = 'gap-[var(--spacing-system-xs)]';

/** Matches `Button` size="icon" / size="default" exactly, so a placeholder and the
 *  button that replaces it occupy the same box at both breakpoints. `rounded-md`
 *  is the same token `Button` itself uses — a raw `6px` would agree today and
 *  drift the moment a platform overrides `--radius`. */
const SKELETON_HEIGHT = 'h-11 md:h-12';
const SKELETON_ICON_WIDTH = 'w-11 md:w-12';
const SKELETON_LABEL_WIDTH = 'w-[120px] md:w-[140px]';
const SKELETON_RADIUS = 'rounded-md';

/**
 * Placeholders for actions whose SHAPE isn't known yet — the page is still
 * loading the record that decides which actions exist (e.g. an archived entity
 * offers "Unarchive" where an active one offers "Edit").
 *
 * Why not render the actions anyway: a button is a promise. Painting the
 * optimistic set means a flash of the wrong header AND a live click target that
 * can act on the wrong assumption before the data lands. A grey box promises
 * nothing and can't be clicked.
 *
 * The placeholders are derived from the actions the caller passed — one per
 * action, each sized like the button that action WILL render — so the common
 * case (the data confirms that set) settles with no layout shift at all. Sizing
 * per action matters: `renderRawActionButton` collapses a label-less action (or
 * one flagged `iconOnlyOnDesktop`) to a square `size="icon"` button, and a
 * 140px-wide placeholder snapping to 48px is exactly the shift this is meant to
 * avoid.
 *
 * An empty list still yields one placeholder: `loading` means the action set is
 * unknown, not known-empty. Its shape comes from `emptyFallback`, because what
 * an empty header settles into differs per variant — `icon-buttons` and
 * `menu-primary` fall back to the square "…" overflow trigger, `primary-buttons`
 * has no overflow trigger at all and settles into a labelled button.
 */
function ActionSkeletons({
  actions,
  fullWidth,
  emptyFallback = 'icon',
}: {
  actions: PageActionButton[];
  fullWidth?: boolean;
  emptyFallback?: 'icon' | 'label';
}) {
  const items = actions.length > 0 ? actions : [null];
  return (
    <>
      {items.map((action, idx) => {
        // Mirrors `renderRawActionButton`'s `isIconOnly`. The mobile bottom bar
        // stretches only labelled buttons (`fullWidth: !!action.label`), so an
        // icon action keeps its square box there too.
        const isIconOnly = action ? !action.label || !!action.iconOnlyOnDesktop : emptyFallback === 'icon';
        return (
          <Skeleton
            // Static placeholder list — index IS the identity here.
            key={`action-skeleton-${idx}`}
            className={cn(
              SKELETON_HEIGHT,
              SKELETON_RADIUS,
              isIconOnly ? SKELETON_ICON_WIDTH : fullWidth ? 'flex-1' : SKELETON_LABEL_WIDTH,
            )}
          />
        );
      })}
    </>
  );
}

/** Mobile placeholder for the variants that collapse to ONE trigger (icon button or "…"). */
function MobileTriggerSkeleton() {
  return <Skeleton className={cn(SKELETON_HEIGHT, SKELETON_ICON_WIDTH, SKELETON_RADIUS)} />;
}

export function PageActions({
  variant = 'icon-buttons',
  actions,
  menuActions,
  selector,
  className,
  loading,
}: PageActionsProps) {
  if (variant === 'icon-buttons') {
    return (
      <IconButtonsVariant
        actions={actions}
        menuActions={menuActions}
        selector={selector}
        className={className}
        loading={loading}
      />
    );
  }

  if (variant === 'menu-primary') {
    return (
      <MenuPrimaryVariant
        actions={actions}
        menuActions={menuActions || []}
        selector={selector}
        className={className}
        loading={loading}
      />
    );
  }

  return <PrimaryButtonsVariant actions={actions} className={className} loading={loading} />;
}

function IconButtonsVariant({
  actions,
  menuActions,
  selector,
  className,
  loading,
}: {
  actions: PageActionButton[];
  menuActions?: ActionsMenuGroup[];
  selector?: React.ReactNode;
  className?: string;
  loading?: boolean;
}) {
  const desktopActions = actions.filter(a => !a.showOnlyMobile);
  const hasMenuActions = !!menuActions && menuActions.some(g => g.items.length > 0);

  const isSingleAction = actions.length === 1 && !actions[0].submenu?.length;
  const singleAction = isSingleAction ? actions[0] : null;
  const useSingleActionMobile = isSingleAction && !hasMenuActions;

  const mobileMenuGroups = [{ items: actions.flatMap(actionToMenuItems) }, ...(menuActions ?? [])];
  const hasMobileMenuItems = mobileMenuGroups.some(g => g.items.length > 0);

  return (
    <>
      {/* Desktop: every action as an icon button + optional overflow menu */}
      <div className={cn('hidden items-center md:flex', ACTIONS_GAP, className)}>
        {selector}
        {loading ? (
          <ActionSkeletons actions={desktopActions} />
        ) : (
          <>
            {desktopActions.map((action, idx) => (
              <React.Fragment key={actionKey(action, idx)}>{renderActionButton(action)}</React.Fragment>
            ))}
            {hasMenuActions && <ActionsMenuDropdown groups={menuActions} />}
          </>
        )}
      </div>

      {/* Mobile: single icon button OR all actions merged into one "..." menu */}
      <div className={cn('flex md:hidden', className)}>
        {loading ? (
          <MobileTriggerSkeleton />
        ) : useSingleActionMobile && singleAction ? (
          renderActionButton(singleAction, { iconOnly: true })
        ) : hasMobileMenuItems ? (
          <ActionsMenuDropdown groups={mobileMenuGroups} />
        ) : null}
      </div>
    </>
  );
}

/**
 * Primary buttons variant — primary + outline buttons on desktop,
 * fixed bottom bar on mobile.
 */
function PrimaryButtonsVariant({
  actions,
  className,
  loading,
}: {
  actions: PageActionButton[];
  className?: string;
  loading?: boolean;
}) {
  // Sort: outline first, accent last (rightmost on desktop).
  const sortedActions = [...actions].sort((a, b) => {
    if (a.variant === 'accent' && b.variant !== 'accent') return 1;
    if (a.variant !== 'accent' && b.variant === 'accent') return -1;
    return 0;
  });

  const desktopActions = sortedActions.filter(a => !a.showOnlyMobile);

  return (
    <>
      <div className={cn('hidden items-center md:flex', ACTIONS_GAP, className)}>
        {loading ? (
          // No overflow trigger in this variant — an unknown action set settles
          // into a labelled button, not a square one.
          <ActionSkeletons actions={desktopActions} emptyFallback="label" />
        ) : (
          desktopActions.map((action, idx) => (
            <React.Fragment key={`desktop-${actionKey(action, idx)}`}>{renderActionButton(action)}</React.Fragment>
          ))
        )}
      </div>

      <MobileBottomActions actions={sortedActions} loading={loading} />
    </>
  );
}

/**
 * Menu + primary variant — "..." menu + primary buttons on desktop,
 * all actions merged into a single "..." menu on mobile.
 */
function MenuPrimaryVariant({
  actions,
  menuActions,
  selector,
  className,
  loading,
}: {
  actions: PageActionButton[];
  menuActions: ActionsMenuGroup[];
  selector?: React.ReactNode;
  className?: string;
  loading?: boolean;
}) {
  const desktopActions = actions.filter(a => !a.showOnlyMobile);
  const hasMenuActions = menuActions.some(g => g.items.length > 0);

  const mobileMenuGroups = [{ items: actions.flatMap(actionToMenuItems) }, ...menuActions];
  const hasMobileMenuItems = mobileMenuGroups.some(g => g.items.length > 0);

  return (
    <>
      <div className={cn('hidden items-center md:flex', ACTIONS_GAP, className)}>
        {selector}
        {loading ? (
          <ActionSkeletons actions={desktopActions} />
        ) : (
          <>
            {hasMenuActions && <ActionsMenuDropdown groups={menuActions} />}
            {desktopActions.map((action, idx) => (
              <React.Fragment key={`desktop-${actionKey(action, idx)}`}>
                {renderActionButton({ ...action, variant: action.variant || 'accent' })}
              </React.Fragment>
            ))}
          </>
        )}
      </div>

      <div className={cn('flex md:hidden', className)}>
        {loading ? (
          <MobileTriggerSkeleton />
        ) : hasMobileMenuItems ? (
          <ActionsMenuDropdown groups={mobileMenuGroups} />
        ) : null}
      </div>
    </>
  );
}

function MobileBottomActions({ actions, loading }: { actions: PageActionButton[]; loading?: boolean }) {
  return (
    <div
      className={cn(
        'fixed bottom-0 left-0 right-0 z-50 md:hidden',
        'border-t border-ods-border bg-ods-card',
        // `lf` (24px at every breakpoint), NOT `l` — this bar is `md:hidden`, so the
        // only value it ever uses is the MOBILE one, and `l` is 16px there. The
        // fixed variant is what keeps the 24px the bar has always had.
        'flex items-start p-[var(--spacing-system-lf)]',
        ACTIONS_GAP,
      )}
    >
      {loading ? (
        <ActionSkeletons actions={actions} fullWidth emptyFallback="label" />
      ) : (
        actions.map((action, idx) => (
          <React.Fragment key={`mobile-${actionKey(action, idx)}`}>
            {renderActionButton(action, { fullWidth: !!action.label })}
          </React.Fragment>
        ))
      )}
    </div>
  );
}

export function usePageActionsBottomPadding(variant: PageActionsProps['variant']) {
  return variant === 'primary-buttons' || variant === 'menu-primary' ? 'pb-40 md:pb-0' : '';
}

export default PageActions;
