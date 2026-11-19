/**
 * An icon NAME (a database `icon_name`) as an icon a SERVER can draw: the component the chat would draw for it, loaded
 * here rather than on demand in the browser, with the colours its name states. For a server that renders an icon as an
 * image (an MCP host's `icons`, an email), so the picture is the chat's own. The name rules are `iconRefOfName`'s.
 *
 * No React import and no client module: the icon modules are plain function components.
 */
import type { ComponentType } from 'react';
import type { IconRef } from '../components/chat/utils/icon-loading';
import { iconRefOfName } from '../components/chat/utils/icon-refs';
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
