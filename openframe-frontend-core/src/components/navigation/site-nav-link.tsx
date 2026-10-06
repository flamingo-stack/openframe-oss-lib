import type React from 'react';
import Link from '../../embed-shims/next-link';
import type { NavLink } from '../../types/navigation';

/**
 * How a host renders one navigation link (Next `Link`, a unified-navigation
 * anchor). Every site navigation component takes one; omitted, links go
 * through {@link defaultRenderSiteNavLink}.
 */
export type SiteNavLinkRenderer = (props: {
  link: Pick<NavLink, 'href' | 'external'>;
  className?: string;
  children: React.ReactNode;
  onClick?: (e: React.MouseEvent) => void;
  'aria-current'?: 'page';
  'aria-label'?: string;
}) => React.ReactNode;

/**
 * The default link: the library's `Link` shim (a plain `<a>`, or the host's
 * registered router link, so internal links soft-navigate), and a new-tab
 * `<a>` for a link that leaves the site.
 */
export const defaultRenderSiteNavLink: SiteNavLinkRenderer = ({ link, children, ...rest }) =>
  link.external ? (
    <a href={link.href} target="_blank" rel="noopener noreferrer" {...rest}>
      {children}
    </a>
  ) : (
    <Link href={link.href} {...rest}>
      {children}
    </Link>
  );

/** A link's label, with its `{count}` token filled from `link.count`. */
export function navLinkLabel(link: Pick<NavLink, 'label' | 'count'>): string {
  return link.count === undefined ? link.label : link.label.replace('{count}', String(link.count));
}

/** Focus ring shared by every navigation link and trigger. */
export const NAV_FOCUS_CLASS = 'outline-none focus-visible:ring-2 focus-visible:ring-ods-accent';
