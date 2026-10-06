'use client';

import type React from 'react';
import type { NavLink } from '../../types/navigation';
import { cn } from '../../utils/cn';
import { EntityIcon } from '../icon-display';
import { defaultRenderSiteNavLink, NAV_FOCUS_CLASS, navLinkLabel, type SiteNavLinkRenderer } from './site-nav-link';
import { UnreadCountBadge } from './unread-dot';

export type NavItemRowVariant = 'panel' | 'sheet' | 'side' | 'label';

export interface NavItemRowProps {
  link: NavLink;
  /**
   * - `panel` (default): a desktop menu row, 36px icon tile, label, description.
   * - `sheet`: the mobile sheet's row, 32px tile, at least 52px tall.
   * - `side`: a mega menu's side list, a small bare icon and the label.
   * - `label`: the label only (footer columns).
   */
  variant?: NavItemRowVariant;
  renderLink?: SiteNavLinkRenderer;
  /** The live counter for `link.badgeKey`; nothing renders at 0 or undefined. */
  badge?: number;
  /** Called on activation, so the menu or sheet holding the row can close. */
  onNavigate?: () => void;
  className?: string;
}

// Box and colour per variant; every text step is an ODS composite.
const ROW_CLASSES: Record<NavItemRowVariant, string> = {
  panel:
    'flex items-start gap-[var(--spacing-system-sf)] rounded-lg p-[var(--spacing-system-sf)] text-ods-text-primary transition-colors hover:bg-ods-bg-hover',
  sheet: 'flex min-h-[52px] items-center gap-[var(--spacing-system-sf)] py-1.5 text-ods-text-primary',
  side: 'flex items-center gap-[var(--spacing-system-xsf)] rounded-md px-[var(--spacing-system-sf)] py-2.5 text-ods-text-secondary transition-colors text-h6 hover:bg-ods-bg-hover hover:text-ods-text-primary',
  label:
    'inline-flex items-center gap-[var(--spacing-system-xsf)] text-ods-text-secondary transition-colors text-h6 hover:text-ods-text-primary',
};

function RowGlyph({ link, box, glyph }: { link: NavLink; box: string; glyph: number }) {
  // A server-configured icon (an agent's avatar) is drawn round and whole.
  if (link.icon) {
    return (
      <span
        aria-hidden="true"
        className={cn('flex shrink-0 items-center justify-center overflow-hidden rounded-full', box)}
      >
        <EntityIcon icon={link.icon} className="h-full w-full" />
      </span>
    );
  }
  if (!link.iconName) return null;
  return (
    <span
      aria-hidden="true"
      className={cn(
        'flex shrink-0 items-center justify-center rounded-lg border border-ods-border bg-ods-bg text-ods-text-primary',
        box,
      )}
    >
      <EntityIcon icon={{ name: link.iconName }} size={glyph} />
    </span>
  );
}

/**
 * One navigation row, shared by the desktop panels, the mobile sheet and the
 * footer columns: icon tile or agent avatar, label, description, the
 * "Built on ..." line and an optional live counter.
 */
export function NavItemRow({
  link,
  variant = 'panel',
  renderLink = defaultRenderSiteNavLink,
  badge,
  onNavigate,
  className,
}: NavItemRowProps) {
  const label = navLinkLabel(link);
  const counter = badge ? <UnreadCountBadge count={badge} className="static shrink-0" /> : null;
  // A row with one line of text centres it on its icon; with a description or
  // a "Built on" line the label stays level with the icon's top.
  const singleLine = !link.description && !link.builtOn;
  const rowClassName = cn(
    ROW_CLASSES[variant],
    variant === 'panel' && singleLine && 'items-center',
    NAV_FOCUS_CLASS,
    className,
  );
  const onClick = onNavigate ? () => onNavigate() : undefined;

  let children: React.ReactNode;
  if (variant === 'label') {
    children = (
      <>
        {label}
        {counter}
      </>
    );
  } else if (variant === 'side') {
    children = (
      <>
        {link.iconName && (
          <span aria-hidden="true" className="flex shrink-0">
            <EntityIcon icon={{ name: link.iconName }} size={18} />
          </span>
        )}
        <span className="min-w-0 flex-1">{label}</span>
        {counter}
      </>
    );
  } else {
    const sheet = variant === 'sheet';
    children = (
      <>
        <RowGlyph link={link} box={sheet ? 'h-8 w-8' : 'h-9 w-9'} glyph={sheet ? 18 : 20} />
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="flex items-center gap-[var(--spacing-system-xsf)] text-h6">
            <span className="min-w-0">{label}</span>
            {counter}
          </span>
          {link.description && <span className="text-ods-text-muted text-h6">{link.description}</span>}
          {link.builtOn && <span className="text-ods-text-muted text-h6">Built on {link.builtOn}</span>}
        </span>
      </>
    );
  }

  return <>{renderLink({ link, className: rowClassName, children, onClick })}</>;
}
