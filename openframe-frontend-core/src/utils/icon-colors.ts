import type { CSSProperties } from 'react';

/**
 * The colours of a mark that is drawn in more than one. An icon of the set
 * takes one `color`; a multi-colour mark (the OpenFrame logo, the OpenMSP
 * bubbles) draws its other parts from `--icon-secondary` and
 * `--icon-tertiary`, each with the brand's own default. This sets them on one
 * icon: `<OpenframeLogoIcon style={iconColors({ secondary: 'currentColor' })} />`.
 */
export function iconColors(colors: { secondary?: string; tertiary?: string }): CSSProperties {
  const style: Record<string, string> = {};
  if (colors.secondary) style['--icon-secondary'] = colors.secondary;
  if (colors.tertiary) style['--icon-tertiary'] = colors.tertiary;
  return style as CSSProperties;
}
