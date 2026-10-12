'use client';

/**
 * Icons loaded BY NAME, when they are drawn.
 *
 * Wherever an icon is chosen by a string (a database `icon_name`, a platform, a
 * provider, a social link), the string names the icon and this module loads
 * that icon's own module on demand. Nothing here imports an icon: a table of
 * names is data, and a page fetches only the icons it draws.
 *
 * Two places hold icons:
 *   - the generated set (`icons-v2-generated`, ~1,800 icons), by export name;
 *   - lucide, by its kebab-case name.
 *
 * A leaf: the name tables (`icon-library`, `icon-registry`) and the components
 * that pick an icon by a value all read it. A client module (the icons hold
 * state while they load): server code states an icon as data and draws it with
 * `<NamedIcon>`, and never calls these functions itself.
 */

import { createElement, lazy, useEffect, useRef, useSyncExternalStore, type ComponentType, type SVGProps } from 'react';
import type { LoadedIconProps } from '../../icons-v2-generated/icon-loaders';
import { ICON_SET_NAMES, LUCIDE_ICON_NAMES } from '../../icons-v2-generated/icon-names';

/** Every icon loaded here is a component of the generated set's own props (`icons-v2-generated`). */
export type IconComponent = ComponentType<LoadedIconProps>;

/** The colours of a multi-colour mark: its `color`, and its other parts. */
export interface MarkColors {
  color?: string;
  secondaryColor?: string;
  tertiaryColor?: string;
}

/** What a loaded icon takes: the icon props plus whatever its `<svg>` accepts. */
type LoadedProps = LoadedIconProps &
  MarkColors &
  Omit<SVGProps<SVGSVGElement>, 'ref' | 'width' | 'height' | 'color' | 'children' | 'dangerouslySetInnerHTML'>;

type IconModule = { default: ComponentType<LoadedProps> };
type IconLoader = () => Promise<IconModule>;

/** The size an icon draws at when it is given none; its loading box matches it. */
const ICON_DEFAULT_SIZE = 24;

/** The icons already asked for, by key: one component each, so a name always draws the same one. */
const icons = new Map<string, IconComponent>();
/** The icon modules that have arrived, by key. */
const loadedIcons = new Map<string, ComponentType<LoadedProps>>();
/** The loads on their way, so an icon is asked for once. */
const iconLoads = new Map<string, Promise<void>>();
/** Who redraws when an icon's module arrives. */
const iconListeners = new Map<string, Set<() => void>>();

/** When an icon's load last failed, so a host that re-renders does not ask again at once. */
const iconFailures = new Map<string, number>();
/** How long a failed icon waits before it is asked for again, in ms. */
const ICON_RETRY_AFTER_MS = 30_000;

function loadIcon(key: string, loader: IconLoader): void {
  if (loadedIcons.has(key) || iconLoads.has(key)) return;
  const failedAt = iconFailures.get(key);
  if (failedAt !== undefined && Date.now() - failedAt < ICON_RETRY_AFTER_MS) return;
  iconLoads.set(
    key,
    loader()
      .then(module => {
        loadedIcons.set(key, module.default);
        iconFailures.delete(key);
        for (const listener of iconListeners.get(key) ?? []) listener();
      })
      // A failed load is asked for again, but not on every render of its host.
      .catch(() => {
        iconFailures.set(key, Date.now());
      })
      .finally(() => {
        iconLoads.delete(key);
      }),
  );
}

function subscribeToIcon(key: string) {
  return (listener: () => void) => {
    const listeners = iconListeners.get(key) ?? new Set();
    listeners.add(listener);
    iconListeners.set(key, listeners);
    return () => {
      listeners.delete(listener);
    };
  };
}

/** Leaves an `<svg>`'s markup as it is: what the server drew stays drawn. */
const KEEP_MARKUP = { __html: '' };

function sameProps(a: LoadedProps, b: LoadedProps): boolean {
  const keys = Object.keys(a) as (keyof LoadedProps)[];
  return keys.length === Object.keys(b).length && keys.every(key => Object.is(a[key], b[key]));
}

/**
 * The component of an icon whose module is loaded on demand, never with the page.
 *
 * It NEVER suspends in the browser. An icon inside a `<Suspense>` whose module
 * is on its way holds back the hydration of everything around it, and React
 * then throws the server's markup away and draws the page again (measured: the
 * home page's heading was drawn a second time seconds after it was first
 * shown). So:
 *   - on the server the icon is drawn in full: a streaming render waits for its
 *     module (no boundary of its own, so the markup is the icon alone and the
 *     browser adopts it as it is). A host that renders with the synchronous
 *     `renderToString` must have drawn the icon once before, or wrap it in its
 *     own `<Suspense>`;
 *   - in the browser, an icon the server drew keeps that `<svg>` as it is and
 *     loads nothing, until its props change;
 *   - an icon first drawn in the browser is an empty `<svg>` of its own size
 *     until its module arrives, so nothing around it moves.
 */
function loadedOnDemand(key: string, displayName: string, loader: IconLoader): IconComponent {
  const known = icons.get(key);
  if (known) return known;
  const ServerDrawn = lazy(loader) as ComponentType<LoadedProps>;
  const subscribe = subscribeToIcon(key);
  const loaded = () => loadedIcons.get(key);

  const OnDemandIcon = (props: LoadedProps) => {
    // The module's component when it has arrived (drawn through `createElement`: it is a loaded module, not a component made here).
    const arrived = useSyncExternalStore(subscribe, loaded, loaded);
    const svg = useRef<SVGSVGElement>(null);
    const drawnWith = useRef<LoadedProps | null>(null);
    useEffect(() => {
      if (arrived) return;
      const first = drawnWith.current === null;
      if (first) drawnWith.current = props;
      // The server's `<svg>` has its paths; one made here is empty and needs its module.
      const drawn = svg.current?.hasChildNodes() ?? false;
      if (!drawn || (!first && drawnWith.current !== null && !sameProps(drawnWith.current, props)))
        loadIcon(key, loader);
    });
    if (typeof window === 'undefined') return <ServerDrawn {...props} />;
    if (arrived) return createElement(arrived, props);
    // The colours are the loaded icon's props, never attributes of the placeholder `<svg>`.
    const { size, color: _color, secondaryColor: _secondaryColor, tertiaryColor: _tertiaryColor, ...rest } = props;
    return (
      <svg
        {...rest}
        ref={svg}
        width={size ?? ICON_DEFAULT_SIZE}
        height={size ?? ICON_DEFAULT_SIZE}
        suppressHydrationWarning
        dangerouslySetInnerHTML={KEEP_MARKUP}
      />
    );
  };
  OnDemandIcon.displayName = displayName;
  icons.set(key, OnDemandIcon as IconComponent);
  return OnDemandIcon as IconComponent;
}

// The two loader tables are NOT imported with this module. Bundled, they are the
// largest script a page would load (each `import()` is written out as the files it
// needs: about 340 KB for 3,300 icons), and a page whose icons the server drew
// never reads them. Whether a name exists is answered by `icon-names` (the names
// alone); a table is fetched the first time an icon is loaded by name.
type LoaderTable = Readonly<Record<string, IconLoader | undefined>>;

/** What a name draws when its table has lost it (a consumer's lucide older than the list of names): nothing. */
const NO_ICON: IconModule = { default: () => null };

function fromTable(table: () => Promise<LoaderTable>, name: string): IconLoader {
  return () => table().then(loaders => loaders[name]?.() ?? NO_ICON);
}

/**
 * A loader table, fetched once and shared by every icon that reads it. A fetch
 * that FAILS is forgotten, so the next icon asks again: kept, one dropped
 * request would fail every icon of that table until the page is reloaded (an
 * icon's own retry calls its loader again, which would get the same rejection).
 * Exported for its test.
 */
export function sharedTable(fetchTable: () => Promise<LoaderTable>): () => Promise<LoaderTable> {
  let table: Promise<LoaderTable> | undefined;
  return () => {
    if (!table) {
      const attempt = fetchTable();
      table = attempt;
      attempt.catch(() => {
        if (table === attempt) table = undefined;
      });
    }
    return table;
  };
}

const setLoaders = sharedTable(() =>
  import('../../icons-v2-generated/icon-loaders').then(module => module.ICON_LOADERS as LoaderTable),
);

const lucideLoaders = sharedTable(() =>
  import('lucide-react/dynamicIconImports').then(module => (module.default ?? module) as unknown as LoaderTable),
);

/** An icon of the generated set by its EXPORT name (`ChartPieIcon`), or `undefined` when the set has none by that name. */
export function iconFromSet(exportName: string): IconComponent | undefined {
  if (!ICON_SET_NAMES.has(exportName)) return undefined;
  return loadedOnDemand(`set:${exportName}`, exportName, fromTable(setLoaders, exportName));
}

/** An icon the generated set is known to hold, by its export name. A name the set lost fails where it is asked for. */
export function setIcon(exportName: string): IconComponent {
  const icon = iconFromSet(exportName);
  if (!icon) throw new Error(`icon-loading: the generated icon set has no "${exportName}"`);
  return icon;
}

/** A lucide icon by its kebab-case name (`message-circle`), or `undefined` when lucide has none by that name. */
export function lucideIcon(name: string): IconComponent | undefined {
  if (!LUCIDE_ICON_NAMES.has(name)) return undefined;
  return loadedOnDemand(`lucide:${name}`, `Lucide(${name})`, fromTable(lucideLoaders, name));
}

/**
 * An icon as a table of names states it: where it lives and, for a mark with
 * colours of its own, those colours. Plain data, so a table of these imports
 * nothing.
 */
export interface IconRef extends MarkColors {
  /** The generated set's export name (`OpenmspLogoIcon`). */
  set?: string;
  /** Lucide's kebab-case name (`megaphone`). */
  lucide?: string;
  /** The size it draws at when the caller gives none. */
  size?: number;
  /** Keep `color` whatever the caller passes: a platform's mark is never tinted by the slot it sits in. */
  ownColor?: boolean;
  /** One colour for every part of a multi-colour mark: the caller's, else the text colour. */
  oneColor?: boolean;
}

const refIcons = new Map<string, IconComponent | null>();

/** The component an {@link IconRef} names, or `null` when nothing holds that icon. One component per ref. */
export function iconOf(ref: IconRef): IconComponent | null {
  const key = JSON.stringify(ref);
  const known = refIcons.get(key);
  if (known !== undefined) return known;
  const icon =
    (ref.set ? iconFromSet(ref.set) : undefined) ?? (ref.lucide ? lucideIcon(ref.lucide) : undefined) ?? null;
  const { set: _set, lucide: _lucide, size, ownColor, oneColor, ...colors } = ref;
  const plain = size === undefined && !ownColor && !oneColor && Object.keys(colors).length === 0;
  let resolved: IconComponent | null = icon;
  if (icon && !plain) {
    const mark = icon as ComponentType<LoadedIconProps & MarkColors>;
    const partsOfItsOwn = Boolean(ownColor || oneColor || colors.secondaryColor || colors.tertiaryColor);
    const Mark: IconComponent = props => {
      const tint = oneColor ? (props.color ?? colors.color ?? 'currentColor') : undefined;
      return createElement(mark, {
        ...colors,
        // A mark with parts of its own takes its size, class and colour and nothing else: a stored `icon_props`
        // may name the parts of an older component, which are not attributes of an `<svg>`.
        ...(partsOfItsOwn ? { className: props.className } : props),
        size: props.size ?? size,
        color: tint ?? (ownColor ? colors.color : (props.color ?? colors.color)),
        ...(tint ? { secondaryColor: tint } : {}),
      });
    };
    Mark.displayName = `Mark(${ref.set ?? ref.lucide ?? ''})`;
    resolved = Mark;
  }
  refIcons.set(key, resolved);
  return resolved;
}

/** The component an {@link IconRef} names, for a table whose every entry must exist: a name nothing holds fails where it is asked for. */
export function requireIcon(ref: IconRef): IconComponent {
  const icon = iconOf(ref);
  if (!icon) throw new Error(`icon-loading: no icon named ${JSON.stringify(ref.set ?? ref.lucide)}`);
  return icon;
}

/** An icon drawn from its {@link IconRef}: how server code, which holds only the data, draws a named icon. */
export function NamedIcon({ icon, ...props }: { icon: IconRef } & LoadedIconProps) {
  // The icon's own component, loaded by its name (drawn through `createElement`: not a component made here).
  return createElement(requireIcon(icon), props);
}

// ── Platform marks, by convention ───────────────────────────────────────────
//
// A platform's mark is never listed anywhere. The platform is its name, and:
//   1. its mark is the set's `<name>-mark` icon, else its `<name>-logo`
//      (`tmcg` → `TmcgMarkIcon`, `openmsp` → `OpenmspLogoIcon`);
//   2. a platform with neither is drawn with the house mark, in its own accent;
//   3. every mark is drawn inside its platform's palette (`data-app-type`), so
//      the accent a mark's own colours name is that platform's accent wherever
//      the mark sits (a hub's mark is its hub's colour on any site).
// A new platform gets a mark by adding `<name>-mark.svg` to the set, or nothing.

/** The mark of a platform that has none of its own. */
const HOUSE_MARK: IconRef = { set: 'FlamingoMarkIcon', color: 'var(--color-accent-primary)' };

/** The scope "every platform". Not a platform: it is drawn as a globe. */
const EVERY_PLATFORM = 'universal';
const EVERY_PLATFORM_MARK: IconRef = { lucide: 'globe' };

/** `marketing-hub` → `MarketingHub`: a platform's name as the set spells it in an export. */
function setStem(platform: string): string {
  return platform
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join('');
}

/** The mark a platform is drawn with, as data, by the convention above. */
export function platformMarkRef(platform: string): IconRef {
  if (platform === EVERY_PLATFORM) return EVERY_PLATFORM_MARK;
  const stem = setStem(platform);
  for (const exportName of [`${stem}MarkIcon`, `${stem}LogoIcon`]) {
    if (ICON_SET_NAMES.has(exportName)) return { set: exportName };
  }
  return HOUSE_MARK;
}

/** A platform's mark, drawn in that platform's palette. THE way a platform is drawn as an icon. */
export function PlatformMark({ platform, ...props }: { platform: string } & LoadedIconProps) {
  const mark = requireIcon(platformMarkRef(platform)) as ComponentType<LoadedIconProps & { 'data-app-type': string }>;
  return createElement(mark, { ...props, 'data-app-type': platform });
}
