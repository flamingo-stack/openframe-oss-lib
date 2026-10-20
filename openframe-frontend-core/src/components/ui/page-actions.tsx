'use client';

import React from 'react';
import { cn } from '../../utils/cn';
import { Chevron02DownIcon } from '../icons-v2-generated';
import { InteractiveSkeleton, UnifiedSkeleton } from '../loading/unified-skeleton';
import { ActionsMenuDropdown, type ActionsMenuGroup, type ActionsMenuItem } from './actions-menu';
import type { ButtonProps, SplitButtonIconAction } from './button';
import { Button, SplitButton } from './button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './tooltip';

export type PageActionButton = {
  /** Button label. Omit to render an icon-only button. */
  label?: string;
  /** Accessible name. Required for icon-only buttons (when `label` is omitted). */
  ariaLabel?: string;
  /** Click handler. Optional when `href` or `submenu` is provided. */
  onClick?: () => void;
  icon?: React.ReactNode;
  /** `overlay` and `glyph` are media chrome and `link` an inline text action; none is a page action, and SplitButton has no divider colour for them. */
  variant?: Exclude<ButtonProps['variant'], 'overlay' | 'glyph' | 'link' | 'inverted'>;
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
   * `text-ods-text-primary`; the mobile row keeps the caller-provided icon color
   * (re-tinted only when it was picked for a filled variant, see `menuRowIcon`).
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

/** Variants that paint the button: the caller tints its icon for that fill (`text-ods-text-on-accent`). */
const FILLED_VARIANTS: ReadonlySet<NonNullable<PageActionButton['variant']>> = new Set([
  'accent',
  'destructive',
  'warning',
]);

/**
 * The action's icon as a "..." menu row shows it. An icon tinted for a filled
 * button (an empty list's accent "Add ...") is dark on the menu's dark row, so it
 * is re-tinted to the row's secondary icon color. Outline and transparent buttons
 * sit on the page background like the row does, so their icon is kept as is. No
 * variant renders as accent, the Button default.
 *
 * `&&` doubles the class (specificity 0,2,1): a caller that tints the fill with its
 * own `[&_svg]:!text-...` wrapper ties with a single class, and the tie would go to
 * whichever rule the consumer's stylesheet happens to emit last.
 */
function menuRowIcon(action: PageActionButton): React.ReactNode {
  if (!action.icon || !FILLED_VARIANTS.has(action.variant ?? 'accent')) return action.icon;
  return <span className="inline-flex [&&_svg]:!text-ods-text-secondary">{action.icon}</span>;
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
      icon: menuRowIcon(action),
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
   * Slot rendered before the action buttons (e.g. a `TabSelector` for
   * view-mode toggles). Honored by the `icon-buttons` and `menu-primary`
   * variants. On mobile, `icon-buttons` hides it; `menu-primary` surfaces it
   * as the header row INSIDE the "…" menu (the tickets design — the view
   * switcher must stay reachable where the header has no room for it).
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
        // Static placeholder list — index IS the identity here.
        const key = `action-skeleton-${idx}`;
        // The square button's own size (`Button size="icon"`).
        if (isIconOnly) return <InteractiveSkeleton.Button key={key} size="icon" />;
        // A labelled action is the button it will render (its label is the caller's copy), drawn invisible under one
        // bar, so the placeholder is that button's box at every breakpoint. Not a control while it loads.
        if (action) {
          return (
            <span key={key} inert aria-hidden className={cn('relative inline-flex', fullWidth && 'flex-1')}>
              <span className={cn('invisible inline-flex', fullWidth && 'flex-1')}>
                {renderRawActionButton(action, { fullWidth })}
              </span>
              <UnifiedSkeleton className="absolute inset-0 h-full" />
            </span>
          );
        }
        // An unknown set that settles into a labelled button: the default button's size.
        return <InteractiveSkeleton.Button key={key} size="default" className={fullWidth ? 'flex-1' : undefined} />;
      })}
    </>
  );
}

/** Mobile placeholder for the variants that collapse to ONE trigger (icon button or "…"). */
function MobileTriggerSkeleton() {
  return <InteractiveSkeleton.Button size="icon" />;
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
      <div className={cn('hidden items-center content-md:flex', ACTIONS_GAP, className)}>
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
      <div className={cn('flex content-md:hidden', className)}>
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
 *
 * The bottom bar spans the WINDOW, so it stays on the viewport `md` step. A
 * content area narrowed by a docked side panel is a third case: the window is
 * wide (no bar) but the title row has no room for every labelled button, so the
 * actions compact into the row instead. `md:content-max-md:` is exactly that case
 * and never matches outside a content area.
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
      <div className={cn('hidden items-center md:content-md:flex', ACTIONS_GAP, className)}>
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

      <div className={cn('hidden items-center md:content-max-md:flex', ACTIONS_GAP, className)}>
        {loading ? <MobileTriggerSkeleton /> : <CompactPrimaryActions actions={desktopActions} />}
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
      <div className={cn('hidden items-center content-md:flex', ACTIONS_GAP, className)}>
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

      <div className={cn('flex content-md:hidden', className)}>
        {loading ? (
          <MobileTriggerSkeleton />
        ) : hasMobileMenuItems || selector ? (
          // The selector rides into the menu as its header row: on mobile the
          // title row has no room for it, and hiding it entirely (what
          // `icon-buttons` does) would leave no way to switch views at all.
          <ActionsMenuDropdown groups={mobileMenuGroups} header={selector} />
        ) : null}
      </div>
    </>
  );
}

/**
 * `primary-buttons` in a narrow content area of a wide window: the accent (and
 * icon-only) actions stay buttons, the other labelled ones fold into one "..."
 * menu — unless that menu would hold a single action, which stays a button.
 */
function CompactPrimaryActions({ actions }: { actions: PageActionButton[] }) {
  const foldable = actions.filter(action => action.variant !== 'accent' && !!action.label);
  const fold = foldable.length > 1;
  const inline = fold ? actions.filter(action => !foldable.includes(action)) : actions;
  return (
    <>
      {fold && <ActionsMenuDropdown groups={[{ items: foldable.flatMap(actionToMenuItems) }]} />}
      {inline.map((action, idx) => (
        <React.Fragment key={`compact-${actionKey(action, idx)}`}>{renderActionButton(action)}</React.Fragment>
      ))}
    </>
  );
}

function MobileBottomActions({ actions, loading }: { actions: PageActionButton[]; loading?: boolean }) {
  return (
    <div
      className={cn(
        // Over the composer dock where the layout has one (AppLayout publishes its height).
        'fixed bottom-[var(--of-composer-dock-height,0px)] left-0 right-0 z-50 md:hidden',
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
