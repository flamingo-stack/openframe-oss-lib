'use client';

import type React from 'react';
import type { HTMLAttributes } from 'react';
import type { NavGroup, NavMenu } from '../../types/navigation';
import { cn } from '../../utils/cn';
import { CaseStudyCard } from '../chat/entity-cards/case-study-card';
import { NavItemRow } from './nav-item-row';
import { defaultRenderSiteNavLink, type SiteNavLinkRenderer } from './site-nav-link';

/** A column with more links than this lays them out in two columns. */
const TWO_COLUMN_OVER = 4;

/** True when a menu opens the full-width mega panel instead of a dropdown list. */
export function isMegaMenu(menu: Pick<NavMenu, 'columns' | 'features' | 'sideLinks'>): boolean {
  return (menu.columns?.length ?? 0) > 1 || !!menu.features?.length || !!menu.sideLinks?.length;
}

export interface NavPanelProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  menu: NavMenu;
  open: boolean;
  renderLink?: SiteNavLinkRenderer;
  /** Values for `NavLink.badgeKey`. */
  badges?: Record<string, number>;
  /** Rendered under the links of a menu with `showSocial`. */
  social?: React.ReactNode;
  /** Called when a link is activated, so the owner can close the menu. */
  onNavigate?: () => void;
  /**
   * How an OPEN mega menu arrived: `open` from a closed bar (the panel fades
   * in), `from-start` / `from-end` from the mega menu before or after it in
   * the row (the surface stays put and only the content slides in from that
   * side). Default `open`.
   */
  motion?: NavPanelMotion;
  /**
   * Another mega menu is open: this closed one leaves without a fade, so the
   * two panels never show through each other mid-switch.
   */
  handoff?: boolean;
  ref?: React.Ref<HTMLDivElement>;
}

export type NavPanelMotion = 'open' | 'from-start' | 'from-end';

const HEADING_CLASS = 'mb-[var(--spacing-system-xsf)] ml-[var(--spacing-system-sf)] text-ods-text-muted text-h5';

function Column({
  group,
  wide,
  rowProps,
}: {
  group: NavGroup;
  wide: boolean;
  rowProps: Pick<NavPanelProps, 'renderLink' | 'badges' | 'onNavigate'>;
}) {
  const twoColumns = wide && group.links.length > TWO_COLUMN_OVER;
  return (
    <div className={cn('flex min-w-0 flex-col', wide && (twoColumns ? 'flex-[2]' : 'flex-1'))}>
      {group.title && <div className={HEADING_CLASS}>{group.title}</div>}
      <div
        className={
          twoColumns
            ? 'grid grid-cols-2 gap-x-[var(--spacing-system-mf)] gap-y-[var(--spacing-system-xxs)]'
            : 'flex flex-col gap-[var(--spacing-system-xxs)]'
        }
      >
        {group.links.map(link => (
          <NavItemRow
            key={link.id}
            link={link}
            renderLink={rowProps.renderLink}
            onNavigate={rowProps.onNavigate}
            badge={link.badgeKey ? rowProps.badges?.[link.badgeKey] : undefined}
          />
        ))}
      </div>
    </div>
  );
}

/**
 * The panel a header menu opens, in the one shape its data asks for: a single
 * column is a compact dropdown under its trigger; more than one column, or
 * features, or side links make the full-width mega menu under the bar.
 *
 * Always in the DOM, so crawlers see every link; closed, it is `inert` (out of
 * the tab order and the accessibility tree, which `aria-hidden` alone would
 * not do) and invisible. Plain `<div>`s on purpose: these are disclosures of
 * links, not an ARIA menu, so there is no `role="menu"` and Tab moves through
 * the links in DOM order.
 */
export function NavPanel({
  menu,
  open,
  renderLink = defaultRenderSiteNavLink,
  badges,
  social,
  onNavigate,
  motion = 'open',
  handoff = false,
  className,
  ...panelProps
}: NavPanelProps) {
  const columns = menu.columns ?? [];
  const mega = isMegaMenu(menu);
  const rowProps = { renderLink, badges, onNavigate };
  const socialRow = menu.showSocial && social ? social : null;

  return (
    <div
      inert={!open}
      data-state={open ? 'open' : 'closed'}
      {...panelProps}
      className={cn(
        'absolute top-full z-[60]',
        // Between two mega menus the surface is handed over in one frame (same
        // place, same size, same colour) and only the content moves; a fade
        // here would let the page show through both for its whole length.
        mega && (open ? motion !== 'open' : handoff) ? 'transition-none' : 'transition-opacity duration-150',
        mega
          ? 'left-0 right-0 border-b border-ods-border bg-ods-card shadow-xl'
          : 'left-0 mt-[var(--spacing-system-xxs)] min-w-[260px] rounded-lg border border-ods-border bg-ods-card p-[var(--spacing-system-xsf)] shadow-xl',
        open ? 'visible opacity-100' : 'pointer-events-none invisible opacity-0',
        className,
      )}
    >
      {mega ? (
        // ONE height for every mega menu, so moving between menus (and a
        // card's cover loading) never resizes the panel under the pointer.
        <div
          data-motion={open ? motion : undefined}
          className="nav-panel-content flex h-[400px] max-h-[calc(100svh-var(--top-nav-height,72px))] flex-col gap-[var(--spacing-system-mf)] overflow-y-auto px-[var(--spacing-system-lf)] pb-[var(--spacing-system-xlf)] pt-8"
        >
          <div className="flex min-h-0 flex-1 gap-[var(--spacing-system-xlf)]">
            {columns.map(group => (
              <Column key={group.id} group={group} wide rowProps={rowProps} />
            ))}
            {!!menu.features?.length && (
              // One row of cards, as many as the bar's width holds: a card that
              // would wrap lands on a zero-height row, where its cell clips it.
              <div className="grid min-w-0 flex-[3] auto-rows-[0px] grid-cols-[repeat(auto-fit,minmax(240px,1fr))] grid-rows-[minmax(0,1fr)] gap-x-[var(--spacing-system-mf)]">
                {menu.features.map(feature => (
                  <div key={feature.id} className="min-h-0 min-w-0 overflow-hidden">
                    <CaseStudyCard
                      size="menu"
                      study={feature.study}
                      href={feature.href}
                      mediaMounted={open}
                      onNavigate={onNavigate}
                      className="h-full"
                    />
                  </div>
                ))}
              </div>
            )}
            {!!menu.sideLinks?.length && (
              <div className="flex w-[260px] shrink-0 flex-col gap-0.5 border-l border-ods-border pl-8 pt-5">
                {menu.sideTitle && <div className={HEADING_CLASS}>{menu.sideTitle}</div>}
                {menu.sideLinks.map(link => (
                  <NavItemRow
                    key={link.id}
                    link={link}
                    variant="side"
                    {...rowProps}
                    badge={link.badgeKey ? badges?.[link.badgeKey] : undefined}
                  />
                ))}
              </div>
            )}
          </div>
          {socialRow && (
            <div className="border-t border-ods-border px-[var(--spacing-system-sf)] pt-[var(--spacing-system-mf)]">
              {socialRow}
            </div>
          )}
        </div>
      ) : (
        <>
          {columns.map(group => (
            <Column key={group.id} group={group} wide={false} rowProps={rowProps} />
          ))}
          {socialRow && (
            <div className="mt-[var(--spacing-system-xsf)] border-t border-ods-border px-[var(--spacing-system-sf)] pt-[var(--spacing-system-sf)]">
              {socialRow}
            </div>
          )}
        </>
      )}
    </div>
  );
}
