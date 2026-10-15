import type React from 'react';
import type { CaseStudyCardData } from './case-study';

/**
 * Base navigation item interface used across all navigation components
 */
export interface NavigationItem {
  id: string;
  label: string;
  href?: string;
  icon?: React.ReactNode;
  badge?: React.ReactNode | number | string;
  isActive?: boolean;
  children?: NavigationItem[];
  onClick?: () => void;
  element?: React.ReactNode; // For completely custom navigation items
}

/**
 * The site navigation model: ONE serializable description of a platform's
 * header, mega menus, mobile menu and footer. Plain data only (no functions, no
 * React elements), so a server resolver can build it and hand it to the client
 * components (`SiteHeader`, `MobileNavSheet`, `SiteFooter`), which only render.
 *
 * A link is declared once and referenced from every surface, so one change to
 * the model changes the header, the mobile menu and the footer together.
 */
export interface NavLink {
  id: string;
  /** The label shown in menus and the footer. */
  label: string;
  /** Internal path, internal path with `#anchor`, or absolute URL. */
  href: string;
  /** One line shown under the label in mega menus and the mobile sheet. */
  description?: string;
  /** An `EntityIcon` glyph name. */
  iconName?: string;
  /**
   * A server-configured icon (an agent's avatar: a packaged mark by name, or an
   * uploaded image), in `EntityIcon`'s own shape. Drawn round, and it wins over
   * `iconName`.
   */
  icon?: { name?: string | null; url?: string | null; props?: Record<string, unknown> | null };
  /** "Chocolatey · Homebrew · WinGet"; rendered as "Built on ...". */
  builtOn?: string;
  /** Filled by the resolver, for labels such as "All {count} customer stories". */
  count?: number;
  /** Names a live counter the host supplies at render (`badges` prop). */
  badgeKey?: string;
  /** Set by the resolver, never by a config: the link leaves this site. */
  external?: boolean;
}

export interface NavGroup {
  id: string;
  title?: string;
  links: NavLink[];
}

/**
 * A featured customer story shown as a card beside a menu's columns: the
 * record itself, drawn by the shared case study card.
 */
export interface NavFeature {
  id: string;
  href: string;
  study: CaseStudyCardData;
}

export interface NavMenu {
  id: string;
  label: string;
  /** A menu with only `href` is a plain link. */
  href?: string;
  iconName?: string;
  /** Path prefixes that mark this menu as the current section. */
  match?: string[];
  /** One column is a list; more than one makes a mega menu. */
  columns?: NavGroup[];
  /** Featured cards shown beside the columns. */
  features?: NavFeature[];
  /** The side list of a mega menu. */
  sideLinks?: NavLink[];
  sideTitle?: string;
  /** Show the brand's social links under the menu's links. */
  showSocial?: boolean;
}

export type SiteNavPrimaryCta = 'trial' | 'waitlist' | 'none' | { label: string; href: string };

export interface SiteNav {
  menus: NavMenu[];
  /**
   * The mobile sheet's groups, when they differ from `menus` (a column promoted
   * to its own group). Omitted: the sheet uses `menus`.
   */
  mobileMenus?: NavMenu[];
  footerColumns: NavGroup[];
  signIn?: NavLink;
  primaryCta: SiteNavPrimaryCta;
  closingBand?: { heading: string; subheading: string; secondary?: NavLink };
  legal: { company: string; notes: string[]; links: NavLink[] };
  brand: { name: string; tagline: string; social: NavLink[]; statusUrl?: string };
}

/**
 * Configuration for the sliding sidebar component
 */
export interface SlidingSidebarConfig {
  items: NavigationItem[];
  footer?: React.ReactNode;
  isOpen: boolean;
  onClose: () => void;
  position?: 'left' | 'right';
  className?: string;
}

/**
 * Configuration for the navigation sidebar component
 */
export interface NavigationSidebarConfig {
  items: NavigationSidebarItem[];
  /**
   * Draw placeholder rows instead of `items`.
   *
   * For hosts whose navigation is not knowable at first paint — entries gated by
   * server-loaded feature flags, permissions, or tenant config. Such a host has no
   * good option without this: rendering the items it has yet means a nav that grows
   * and shifts as answers arrive, and guessing the gated ones wrong shows entries
   * that don't belong to the user (a flag that HIDES a legacy entry when enabled
   * makes "not answered yet" indistinguishable from "off").
   *
   * The rows reuse the real entry's geometry and the sidebar's own minimized state,
   * so the placeholder is correct in both the expanded and the minimized rail with
   * nothing to pass in — and the handoff to the real nav moves nothing.
   */
  loading?: boolean;
  /**
   * How many placeholder rows `loading` draws, per section. Defaults to 7 primary
   * and 2 secondary — the shape of a typical console nav. Pass the counts the host
   * expects so the placeholder and the loaded nav are the same height.
   */
  loadingRows?: { primary?: number; secondary?: number };
  /**
   * Host-owned content rendered above the primary navigation — an action that
   * belongs in the nav's position but is not a nav entry, such as the desktop
   * shell's "an update is ready" button.
   *
   * Kept out of `items` deliberately: an entry there is a row in the primary
   * `<nav>` landmark, styled as one and announced as one, and none of that is
   * true of an action that navigates nowhere. It also renders in every surface
   * that takes this config — the sidebar AND the mobile burger menu — so a host
   * passes it once and gets both.
   *
   * A render prop rather than a node because the two surfaces are different
   * widths and only this component knows which: the 56px rail has room for a
   * glyph and nothing else, while the burger menu is always full width. A host
   * cannot derive `minimized` itself — it is the sidebar's own state, resolved
   * from a persisted preference, the tablet breakpoint and any open overlay —
   * and a container query would have to be authored in the HOST's Tailwind
   * scan to emit anything.
   *
   * Rendered regardless of `loading`: it comes from host state that has nothing
   * to do with whether the nav entries have resolved.
   */
  topSlot?: (state: { minimized: boolean }) => React.ReactNode;
  minimized?: boolean;
  onNavigate?: (path: string) => void;
  onToggleMinimized?: () => void;
  className?: string;
  /**
   * How the entries are drawn. `'flat'` (the default) is the original sidebar:
   * every entry a 56px row, `children` ignored. `'grouped'` draws entries that
   * carry `children` as groups — the parent row, and while the group is open a
   * bordered card holding the parent and its children (one level only) — with
   * 44px rows and a label-only active pill. Only one group is open at a time:
   * the one holding the active entry. The mobile burger menu follows the same
   * switch.
   */
  variant?: 'flat' | 'grouped';
  /**
   * The current location, pathname plus query string (`/monitoring?tab=policies`).
   * Lets the sidebar resolve the active entry itself — through `match`, or an
   * entry's own `path` — for entries that do not set `isActive`. Without it only
   * `isActive` marks an entry, as before.
   */
  currentPath?: string;
  /**
   * What a click on a CLOSED group parent does (grouped variant). `'first-child'`
   * (default): open the group and navigate to its first child — through
   * `onNavigate`, so without one it only opens. `'expand'`: only open it. A click
   * on an OPEN parent always folds it; a closed parent whose group holds the
   * current page only re-opens. The mobile burger menu always expands: there a
   * navigation closes the menu over the children the user asked to see.
   */
  groupParentClick?: 'first-child' | 'expand';
  /**
   * Host content below the navigation tree that takes the remaining height and
   * scrolls on its own (the chat history), so the tree above it stays in view.
   * A node is hidden in the collapsed rail (it stays mounted); a function is
   * called with the sidebar's own `minimized` state and decides for itself.
   * Rendered in the mobile burger menu too, with `minimized: false`.
   */
  sectionSlot?: NavigationSidebarSlot;
  /**
   * Host content pinned above the "Hide Menu" toggle (the account row). A node
   * renders as-is in both widths; a function receives `minimized` and adapts
   * (e.g. `AccountPopover`'s `collapsed`). Rendered at the bottom of the mobile
   * burger menu too, with `minimized: false`.
   */
  footerSlot?: NavigationSidebarSlot;
  /**
   * Controlled desktop collapse. When set, it replaces the persisted preference
   * (`localStorage`): the host owns the value and seeds
   * `NAVIGATION_SIDEBAR_WIDTH_VAR` to match it before first paint. The tablet
   * overlay stays the sidebar's own transient state, but a CHANGE of this value
   * opens (`false`) or closes (`true`) it too, so a host can reveal the sidebar
   * from anywhere (⌘K) on every width. Omitted: uncontrolled, as before.
   */
  collapsed?: boolean;
  /**
   * Called with the next desktop collapse state when the user toggles it on
   * desktop (not for the tablet overlay). Pair with `collapsed`.
   */
  onCollapsedChange?: (collapsed: boolean) => void;
}

/**
 * A sidebar slot: a node, or a render function of the sidebar's own state (the
 * host cannot derive `minimized` — it comes from a persisted preference, the
 * tablet breakpoint and any open overlay).
 */
export type NavigationSidebarSlot = React.ReactNode | ((state: { minimized: boolean }) => React.ReactNode);

/** The location a `NavigationSidebarItem.match` function is asked about. */
export interface NavigationSidebarLocation {
  /** Without its trailing slash (`/` stays `/`). */
  pathname: string;
  searchParams: URLSearchParams;
}

/**
 * One declarative match rule. `path` is a segment-aware prefix: `/scripts`
 * matches `/scripts` and `/scripts/details`, never `/scriptsx`.
 */
export interface NavigationSidebarMatchRule {
  path: string;
  /** Only the pathname itself, not the pages below it. */
  exact?: boolean;
  /**
   * Required query values: a string must be equal, `null` must be absent, an
   * array accepts any of its values (`{ tab: ['queries', null] }` = the queries
   * tab, or no tab at all).
   */
  query?: Record<string, string | null | ReadonlyArray<string | null>>;
}

/**
 * When an entry is the current page. A string is a rule written as a URL —
 * `'/monitoring?tab=policies'` = the `/monitoring` prefix with `tab=policies`.
 * Several rules match if any does. When several entries match, the most
 * specific rule wins (more path segments, then more query constraints), so
 * `/scripts` and `/scripts/schedules` need no `exclude`. A function is the host
 * deciding outright and outranks every rule.
 */
export type NavigationSidebarMatch =
  | string
  | NavigationSidebarMatchRule
  | ReadonlyArray<string | NavigationSidebarMatchRule>
  | ((location: NavigationSidebarLocation) => boolean);

/**
 * Navigation sidebar item interface
 */
export interface NavigationSidebarItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  path?: string;
  unreadCount?: number;
  /**
   * A stamp after the label — "Beta" on a module still behind a flag. One short
   * word, drawn as a chip beside the label in the expanded sidebar and the mobile
   * menu; the minimized rail carries it only in the row's tooltip and accessible
   * name. Cased as it should be read ("Beta"): the surfaces upper-case it
   * themselves, and the accessible name becomes "Devices (Beta)".
   */
  badge?: string;
  /**
   * The host's own answer to "is this the current page". When set (`true` or
   * `false`) it wins over `match`; leave it out to let `match` / `path` decide
   * against `NavigationSidebarConfig.currentPath`.
   */
  isActive?: boolean;
  /**
   * When this entry is the current page, checked against
   * `NavigationSidebarConfig.currentPath` for entries without `isActive`.
   * Omitted: the entry's own `path` (its query included) is the rule.
   */
  match?: NavigationSidebarMatch;
  onClick?: () => void;
  /**
   * The group's entries (grouped variant only; one level). The flat variant
   * ignores them. A parent's click opens the group (see
   * `NavigationSidebarConfig.groupParentClick`), so a parent needs no `path`.
   */
  children?: NavigationSidebarItem[];
  section?: 'primary' | 'secondary'; // To separate top and bottom sections
}

/**
 * User information for the unified sidebar
 */
export interface UnifiedSidebarUser {
  name?: string;
  email?: string;
  avatarUrl?: string | null;
  role?: string;
}
