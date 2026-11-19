/**
 * An icon value (`EntityIconValue`: a library `name`, an uploaded `url`) shown where React does not draw it. ONE place,
 * beside `EntityIcon` (which draws the same value in React): every image of an icon, on every surface, comes from here.
 *
 *   - `entityIconImages(icon, iconsUrl)`: the value as MCP's standard `Icon`s (`src`, `mimeType`, `sizes`, `theme`). An
 *     upload is its own image; a library name is the host's icon endpoint (`EndpointsRuntime.iconsUrl`, the hub's
 *     `/api/icons`), `<iconsUrl>/<name>?theme=light|dark`, once per host theme.
 *   - `loadNamedIcon(name, …)`: what that endpoint draws, the chat's own icon for the name (`iconRefOfName`'s rules),
 *     loaded on a server with the colours its name states.
 *
 * No React import and no client module: the icon modules are plain function components.
 */
import type { ComponentType } from 'react';
import type { IconRef } from '../components/chat/utils/icon-loading';
import { iconRefOfName } from '../components/chat/utils/icon-refs';
import type { EntityIconValue } from '../components/icon-display';
import type { LoadedIconProps } from '../components/icons-v2-generated/icon-loaders';

/** What a loaded icon is drawn with: its size and colours (a mark with parts of its own takes more than one). */
export interface NamedIconProps extends LoadedIconProps {
  secondaryColor?: string;
  tertiaryColor?: string;
}

export interface LoadedNamedIcon {
  /** The icon's component (the generated set's). */
  Icon: ComponentType<NamedIconProps>;
  /** The props it is drawn with, for `color` the caller's: a colour the name states that is a CSS variable cannot be
   *  resolved outside a page, so it is replaced by `color`. */
  props: NamedIconProps;
}

/** The icon `iconName` draws, loaded, drawn in `color` at `size`; `null` when the name names no icon. */
export async function loadNamedIcon(
  iconName: string | null | undefined,
  { size, color }: { size: number; color: string },
): Promise<LoadedNamedIcon | null> {
  const ref = iconRefOfName(iconName);
  if (!ref?.set) return null;
  const { ICON_LOADERS } = await import('../components/icons-v2-generated/icon-loaders');
  const loader = ICON_LOADERS[ref.set];
  if (!loader) return null;
  const Icon = (await loader()).default as ComponentType<NamedIconProps>;
  return { Icon, props: propsOf(ref, size, color) };
}

/** A colour as an image can draw it: a CSS value (`var(...)`, `currentColor`) becomes the caller's colour. */
function concrete(value: string | undefined, color: string): string | undefined {
  if (value === undefined) return undefined;
  return value.startsWith('#') || value.startsWith('rgb') ? value : color;
}

function propsOf(ref: IconRef, size: number, color: string): NamedIconProps {
  if (ref.oneColor) return { size, color, secondaryColor: color };
  if (ref.ownColor) {
    return {
      size,
      color: concrete(ref.color, color),
      secondaryColor: concrete(ref.secondaryColor, color),
      tertiaryColor: concrete(ref.tertiaryColor, color),
    };
  }
  return { size, color };
}

/** The edge, in pixels, an icon endpoint draws a library icon at. */
export const NAMED_ICON_PIXELS = 96;

/** The host theme an icon image is drawn for: a dark glyph on a light surface, a light one on a dark surface. */
export type NamedIconTheme = 'light' | 'dark';

/** The theme an icon request asks for; anything else is `dark` (the chat's own surfaces are dark). */
export function namedIconTheme(value: string | null | undefined): NamedIconTheme {
  return value === 'light' ? 'light' : 'dark';
}

/** MCP's standard `Icon` (the `icons` of a tool, a prompt, a resource or a result). */
export interface StandardIcon {
  src: string;
  mimeType?: string;
  sizes?: string[];
  theme?: NamedIconTheme;
}

const IMAGE_TYPES: Readonly<Record<string, string>> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  svg: 'image/svg+xml',
  webp: 'image/webp',
  gif: 'image/gif',
};

/** Where the icon endpoint draws library icon `name` for `theme`. */
export function namedIconImageUrl(iconsUrl: string, name: string, theme: NamedIconTheme): string {
  return `${iconsUrl.replace(/\/+$/, '')}/${encodeURIComponent(name)}?theme=${theme}`;
}

/**
 * An icon value as images, MCP's standard `icons`: its upload as itself, else its library icon from `iconsUrl` once per
 * host theme, else none. `iconsUrl` must be absolute wherever the images leave the page (an MCP result).
 */
export function entityIconImages(icon: EntityIconValue | null | undefined, iconsUrl: string): StandardIcon[] {
  if (icon?.url) {
    const extension = (icon.url.split(/[?#]/)[0] ?? '').split('.').pop()?.toLowerCase() ?? '';
    const mimeType = IMAGE_TYPES[extension];
    return [{ src: icon.url, ...(mimeType ? { mimeType } : {}) }];
  }
  if (!icon?.name) return [];
  const sizes = [`${NAMED_ICON_PIXELS}x${NAMED_ICON_PIXELS}`];
  return (['light', 'dark'] as const).map(theme => ({
    src: namedIconImageUrl(iconsUrl, icon.name as string, theme),
    mimeType: 'image/png',
    sizes,
    theme,
  }));
}
