'use client';

import React from 'react';
import { cn } from '../../utils/cn';
import { Chevron02DownIcon } from '../icons-v2-generated';
import { InteractiveSkeleton } from '../loading/unified-skeleton';
import { ActionsMenuDropdown, type ActionsMenuGroup, type ActionsMenuItem } from './actions-menu';
import type { ButtonProps, SplitButtonIconAction } from './button';
import { Button, SplitButton } from './button';
import { InertWhileLoading, useLoadingScope } from './loading-scope';
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
  variant?: Exclude<
    ButtonProps['variant'],
    'overlay' | 'glyph' | 'link' | 'inverted' | 'field' | 'row' | 'tab' | 'chip' | 'card' | 'cell'
  >;
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
  /** The page's action set is still being read: the button is drawn for real (the caller's copy is static) and inert. */
  inert?: boolean;
}

function renderActionButton(action: PageActionButton, opts: RenderOptions = {}): React.ReactNode {
  if (opts.inert) {
    return (
      <InertWhileLoading className={cn('inline-flex', opts.fullWidth && 'flex-1')}>
        {renderRawActionButton(action, opts)}
      </InertWhileLoading>
    );
  }
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
   * The action SET depends on data still in flight: the actions are drawn for real and inert (an empty list is one
   * placeholder: the set is unknown). Opt-in: a page whose actions are already final while its title loads keeps
   * rendering them live.
   */
  loading?: boolean;
}

const ACTIONS_GAP = 'gap-[var(--spacing-system-xs)]';

/**
 * While the page reads the record that decides which actions exist (`loading`), the actions the caller passed are
 * drawn for real and inert: a labelled or icon button is static copy, so its box and its label are the loaded ones,
 * and an inert control promises nothing and cannot act on a wrong assumption before the data lands. The "…" trigger
 * is drawn the same way (`ActionsMenuDropdown loading`).
 *
 * An empty list is the one placeholder: `loading` means the action set is unknown, not known-empty, so nothing real can
 * be drawn. Its shape is what an empty header settles into for the variant: `icon-buttons` and `menu-primary` the
 * square "…" trigger (`icon`), `primary-buttons` a labelled button (`label`).
 */
function UnknownActionSkeleton({ shape, fullWidth }: { shape: 'icon' | 'label'; fullWidth?: boolean }) {
  if (shape === 'icon') return <InteractiveSkeleton.Button size="icon" />;
  return <InteractiveSkeleton.Button size="default" className={fullWidth ? 'flex-1' : undefined} />;
}

export function PageActions({
  variant = 'icon-buttons',
  actions,
  menuActions,
  selector,
  className,
  loading: loadingProp,
}: PageActionsProps) {
  const loading = useLoadingScope() || loadingProp;
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
  loading: loadingProp,
}: {
  actions: PageActionButton[];
  menuActions?: ActionsMenuGroup[];
  selector?: React.ReactNode;
  className?: string;
  loading?: boolean;
}) {
  const loading = useLoadingScope() || loadingProp;
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
        {desktopActions.map((action, idx) => (
          <React.Fragment key={actionKey(action, idx)}>{renderActionButton(action, { inert: loading })}</React.Fragment>
        ))}
        {/* An unknown set with no menu: the trigger's square. With a menu, the trigger already is it. */}
        {loading && desktopActions.length === 0 && !hasMenuActions && <UnknownActionSkeleton shape="icon" />}
        {hasMenuActions && <ActionsMenuDropdown groups={menuActions} loading={loading} />}
      </div>

      {/* Mobile: single icon button OR all actions merged into one "..." menu */}
      <div className={cn('flex content-md:hidden', className)}>
        {useSingleActionMobile && singleAction ? (
          renderActionButton(singleAction, { iconOnly: true, inert: loading })
        ) : hasMobileMenuItems ? (
          <ActionsMenuDropdown groups={mobileMenuGroups} loading={loading} />
        ) : loading ? (
          <UnknownActionSkeleton shape="icon" />
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
  loading: loadingProp,
}: {
  actions: PageActionButton[];
  className?: string;
  loading?: boolean;
}) {
  const loading = useLoadingScope() || loadingProp;
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
        {desktopActions.map((action, idx) => (
          <React.Fragment key={`desktop-${actionKey(action, idx)}`}>
            {renderActionButton(action, { inert: loading })}
          </React.Fragment>
        ))}
        {/* No overflow trigger in this variant: an unknown action set settles into a labelled button. */}
        {loading && desktopActions.length === 0 && <UnknownActionSkeleton shape="label" />}
      </div>

      <div className={cn('hidden items-center md:content-max-md:flex', ACTIONS_GAP, className)}>
        <CompactPrimaryActions actions={desktopActions} loading={loading} />
        {loading && desktopActions.length === 0 && <UnknownActionSkeleton shape="icon" />}
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
  loading: loadingProp,
}: {
  actions: PageActionButton[];
  menuActions: ActionsMenuGroup[];
  selector?: React.ReactNode;
  className?: string;
  loading?: boolean;
}) {
  const loading = useLoadingScope() || loadingProp;
  const desktopActions = actions.filter(a => !a.showOnlyMobile);
  const hasMenuActions = menuActions.some(g => g.items.length > 0);

  const mobileMenuGroups = [{ items: actions.flatMap(actionToMenuItems) }, ...menuActions];
  const hasMobileMenuItems = mobileMenuGroups.some(g => g.items.length > 0);

  return (
    <>
      <div className={cn('hidden items-center content-md:flex', ACTIONS_GAP, className)}>
        {selector}
        {hasMenuActions && <ActionsMenuDropdown groups={menuActions} loading={loading} />}
        {desktopActions.map((action, idx) => (
          <React.Fragment key={`desktop-${actionKey(action, idx)}`}>
            {renderActionButton({ ...action, variant: action.variant || 'accent' }, { inert: loading })}
          </React.Fragment>
        ))}
        {/* An unknown set with no menu: the trigger's square. With a menu, the trigger already is it. */}
        {loading && desktopActions.length === 0 && !hasMenuActions && <UnknownActionSkeleton shape="icon" />}
      </div>

      <div className={cn('flex content-md:hidden', className)}>
        {hasMobileMenuItems || selector ? (
          // The selector rides into the menu as its header row: on mobile the
          // title row has no room for it, and hiding it entirely (what
          // `icon-buttons` does) would leave no way to switch views at all.
          <ActionsMenuDropdown groups={mobileMenuGroups} header={selector} loading={loading} />
        ) : loading ? (
          <UnknownActionSkeleton shape="icon" />
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
function CompactPrimaryActions({ actions, loading: loadingProp }: { actions: PageActionButton[]; loading?: boolean }) {
  const loading = useLoadingScope() || loadingProp;
  const foldable = actions.filter(action => action.variant !== 'accent' && !!action.label);
  const fold = foldable.length > 1;
  const inline = fold ? actions.filter(action => !foldable.includes(action)) : actions;
  return (
    <>
      {fold && <ActionsMenuDropdown groups={[{ items: foldable.flatMap(actionToMenuItems) }]} loading={loading} />}
      {inline.map((action, idx) => (
        <React.Fragment key={`compact-${actionKey(action, idx)}`}>
          {renderActionButton(action, { inert: loading })}
        </React.Fragment>
      ))}
    </>
  );
}

function MobileBottomActions({ actions, loading: loadingProp }: { actions: PageActionButton[]; loading?: boolean }) {
  const loading = useLoadingScope() || loadingProp;
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
      {actions.map((action, idx) => (
        <React.Fragment key={`mobile-${actionKey(action, idx)}`}>
          {renderActionButton(action, { fullWidth: !!action.label, inert: loading })}
        </React.Fragment>
      ))}
      {loading && actions.length === 0 && <UnknownActionSkeleton shape="label" fullWidth />}
    </div>
  );
}

export function usePageActionsBottomPadding(variant: PageActionsProps['variant']) {
  return variant === 'primary-buttons' || variant === 'menu-primary' ? 'pb-40 md:pb-0' : '';
}

export default PageActions;
