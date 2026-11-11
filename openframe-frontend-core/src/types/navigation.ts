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
  brand: {
    name: string;
    tagline: string;
    social: NavLink[];
    /** The site's own RSS feeds (`iconName: 'rss'`). Drawn at the end of the FOOTER's social row only, never in the header. */
    feeds?: NavLink[];
    statusUrl?: string;
  };
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
 * `NavigationSidebarConfig.resizable`: the user drags the expanded sidebar's
 * right edge on desktop (`lg` and up). The 56px rail is not resizable, nor are
 * the tablet overlay and the burger menu; the overlay opens to the chosen width.
 */
export interface NavigationSidebarResizeConfig {
  /**
   * Narrowest expanded width, in px. Raised to 141px when lower: the rows read
   * 140px and up as expanded (`@[140px]/of-nav-sidebar`).
   */
  minWidth: number;
  /** Widest expanded width, in px. Also kept to the room there is (`minContentWidth`). */
  maxWidth: number;
  /**
   * Px of the row the content beside the sidebar always keeps, so a wide sidebar
   * cannot crowd the page out of a narrow desktop window. Default 720, the lib's
   * `content-md` breakpoint.
   */
  minContentWidth?: number;
  /**
   * `localStorage` key for the width the user chose: `{ size }` under
   * `<storageKey>:chosen` (see `useResizablePanelSize`). Only a drag or a key
   * press on the handle writes it, never the default or a clamped width; a double
   * click removes it. Omit to keep the choice for the mount only. A host that seeds
   * `NAVIGATION_SIDEBAR_WIDTH_VAR` before first paint reads the same entry.
   */
  storageKey?: string;
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
   * switch. `'sectioned'` draws every entry with `children` as a section of its
   * own, divided by the border: a 32px category row (grey, with a fold chevron)
   * over 40px rows with 14px labels; every section open until the user folds it
   * (`groupsStorageKey` keeps the folds), the active entry's section unfolding.
   */
  variant?: 'flat' | 'grouped' | 'sectioned';
  /**
   * The current location, pathname plus query string (`/monitoring?tab=policies`).
   * Lets the sidebar resolve the active entry itself — through `match`, or an
   * entry's own `path` — for entries that do not set `isActive`. Without it only
   * `isActive` marks an entry, as before.
   */
  currentPath?: string;
  /**
   * Host content right below the navigation tree (the chat history), in the
   * flow at its full height: the sidebar body scrolls the tree and the section
   * as one, so the section must not scroll on its own.
   * A node is hidden in the collapsed rail (it stays mounted); a function is
   * called with the sidebar's own `minimized` state and decides for itself.
   * Rendered in the mobile burger menu too, with `minimized: false`.
   */
  sectionSlot?: NavigationSidebarSlot;
  /**
   * The border and spacing between the tree (and the top slot) and `sectionSlot`.
   * Default true; `false` puts the section right under them (the three-column
   * shell's chat list under "Start Work").
   */
  sectionDivider?: boolean;
  /**
   * `sectionSlot` takes the body's spare height (the slot's own root should grow into
   * it, `flex-1`), so what the section centres — an empty chat list — sits in the
   * middle of the sidebar rather than under its caption. Default false: the section is
   * as tall as its content. The three-column shell's chats sidebar sets it.
   */
  sectionFill?: boolean;
  /**
   * The expanded sidebar's width in px (grouped and sectioned variants; default 224). Applied
   * to the desktop sidebar, the tablet overlay and its push slot, and written to
   * `NAVIGATION_SIDEBAR_WIDTH_VAR` while expanded — so a host's pre-paint seed
   * must write the same number (`'<expandedWidth>px'`, or `'56px'` when the
   * stored preference is minimized). The 56px rail does not change. A width at
   * or below 140px is raised to 141px: the rows switch to their expanded layout
   * at 140px. The flat variant ignores it; the mobile burger menu keeps its own
   * width.
   */
  expandedWidth?: number;
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
  /**
   * A reveal command: every CHANGE of this number (not its first value) shows
   * the expanded sidebar at the current width — on tablet it opens the overlay
   * (even when `collapsed` is already `false`, where a change of `collapsed`
   * cannot), on desktop it expands a collapsed sidebar through
   * `onCollapsedChange(false)` (controlled) or the stored preference
   * (uncontrolled). Below md it does nothing: there the sidebar is the burger
   * menu (`AppLayout` `mobileMenuOpen`). E.g. ⌘K bumps it before focusing the
   * chat search in `sectionSlot`.
   */
  revealSignal?: number;
  /**
   * The tablet form at desktop widths too: the rail in the flow, and the toggle (or a
   * reveal) opens the expanded sidebar OVER the content, with the scrim, closing on
   * Escape, a click outside or a pick — as between md and lg. For a host that keeps
   * the content beside the sidebars at a minimum width (a narrow window, a wide
   * sidebar beside it). The desktop preference (`collapsed`, the stored one) is kept,
   * untouched, and back in force once this turns off. While it is on, a change of
   * `currentPath` closes the overlay too. `'drawer'`: the same from md up, and no rail
   * either — closed, the sidebar takes no room and shows nothing; `revealSignal` opens
   * it (a host's own top bar button). Default `false`.
   */
  overlay?: boolean | 'drawer';
  /**
   * The desktop form from md up, not only from lg: no tablet form between md and lg (the
   * rail it starts on, the overlay it opens, the scrim). The sidebar stays in the flow
   * with the desktop preference (`collapsed`, the stored one), so it collapses only when
   * the user (or the host) collapses it. For a host that lets its content scroll sideways
   * rather than fold its sidebars on a narrower window. `overlay` still wins where it is
   * set. Default `false`.
   */
  desktopFromMd?: boolean;
  /**
   * A dismiss command: every CHANGE of this number (not its first value) closes the
   * overlay (tablet, `overlay`), e.g. when a pick inside a slot (a chat in the history)
   * has done what the user opened the sidebar for. The desktop preference is untouched.
   */
  dismissSignal?: number;
  /**
   * Let the user resize the expanded sidebar on desktop: a drag handle astride
   * its right edge (the grip the Mingo chat drawer had), arrow keys, Home and
   * End on it, a double click back to the default. The default stays
   * `expandedWidth` (grouped) or 224px (flat); both variants. Omitted: the fixed
   * widths, as before.
   */
  resizable?: NavigationSidebarResizeConfig;
  /**
   * The window edge the sidebar stands on. `'right'`: its border is on its
   * left, the tablet overlay opens from the right edge, the resize handle sits
   * on its left edge and the toggle's chevron is mirrored. It keeps its desktop
   * width in its own custom property (`NAVIGATION_SIDEBAR_END_WIDTH_VAR`), so a
   * left and a right sidebar never share a pre-paint seed. Default `'left'`.
   */
  side?: 'left' | 'right';
  /**
   * The sidebar's ground. `'card'` (default): `bg-ods-card` and the default border.
   * `'panel'`: the three-column shell's panel (ODS v2 `backgrounds/panel`), its
   * borders and dividers `borders/subtle` on a left sidebar, the default border
   * on a right one (as the Figma shell draws them).
   */
  surface?: 'card' | 'panel';
  /**
   * The footer slot's own inset (8px across, 4px down). Default true; `false`
   * hands the whole 56px band to the slot (a footer laid out as one row).
   */
  footerInset?: boolean;
  /** The logo row at the top. Default true; `false` starts the sidebar with its rows. */
  header?: boolean;
  /**
   * The collapse toggle at the bottom. `'row'` (default): the "Hide Menu" row.
   * `'icon'`: a 56px footer with a 32px sidebar icon button (left-aligned, centred
   * in the rail).
   * `'none'`: no toggle; the host draws its own (e.g. in `footerSlot`) and
   * drives `collapsed` / `onCollapsedChange`.
   */
  toggle?: 'row' | 'icon' | 'none';
  /**
   * Grouped variant: how many groups may be open. `'single'` (default): one at
   * a time, the active entry's. `'multi'`: each group opens and folds on its
   * own, the group of the active entry opens when the page changes, and the
   * open set is kept under `groupsStorageKey`.
   */
  groupMode?: 'single' | 'multi';
  /** `localStorage` key for the open groups of `groupMode: 'multi'`. Omit to keep them for the mount only. */
  groupsStorageKey?: string;
}

/** What a slot render function is told about the place it is drawn in. */
export interface NavigationSidebarSlotState {
  minimized: boolean;
  /**
   * `true` in the mobile burger menu. The menu stays mounted at every width
   * (hidden from md up), so content that must exist once — a popover over state
   * its sidebar copy shares — renders only where this is `false`.
   */
  inDrawer: boolean;
  /**
   * The sidebar's own collapse toggle, for a host that draws its own collapse
   * control in the slot (`toggle: 'none'`): on desktop it flips the preference
   * (`onCollapsedChange`), on tablet and with `overlay` it opens or closes the
   * overlay instead. Absent in the burger menu, which has nothing to collapse.
   */
  toggle?: () => void;
}

/**
 * A sidebar slot: a node, or a render function of the sidebar's own state (the
 * host cannot derive `minimized` — it comes from a persisted preference, the
 * tablet breakpoint and any open overlay).
 */
export type NavigationSidebarSlot = React.ReactNode | ((state: NavigationSidebarSlotState) => React.ReactNode);

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
   * ignores them. A parent's click only opens and folds the group, so a parent
   * needs no `path`.
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
