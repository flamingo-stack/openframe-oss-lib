import type { CSSProperties } from 'react';

/**
 * A surface tinted by an identity colour (an agent's): its border mixed from
 * the colour, a faint wash of it over the page surface and a glow of it in the
 * far corner. THE tint of every card and window that belongs to one agent, so
 * they read as that agent's at a glance and all read alike.
 *
 * `accent` is a CSS colour (the hex an agent's identity stores). The surface
 * under it should be the page surface (`bg-ods-bg`). Undefined gives no style,
 * so a surface with no agent keeps its own border and background.
 */
export function identityTint(accent: string | null | undefined): CSSProperties | undefined {
  if (!accent) return undefined;
  const wash = `color-mix(in srgb, ${accent} 2%, transparent)`;
  return {
    borderColor: `color-mix(in srgb, ${accent} 30%, transparent)`,
    backgroundImage: [
      `radial-gradient(120% 120% at 100% 100%, color-mix(in srgb, ${accent} 4%, transparent), transparent 70%)`,
      `linear-gradient(${wash}, ${wash})`,
    ].join(', '),
  };
}
