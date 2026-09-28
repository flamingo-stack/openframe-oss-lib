/**
 * ODS spacing tokens + the ONE Tailwind-step → token conversion table.
 *
 * The ODS preset deliberately ships NO Tailwind `spacing` scale, so `gap-lf` is
 * not a class — spacing is written in the ARBITRARY-VALUE form
 * `gap-[var(--spacing-system-lf)]`.
 *
 * THAT FORM MUST BE WRITTEN AS A LITERAL IN JSX. Tailwind generates CSS only
 * for class strings its scanner can find verbatim in source, so a class NAME
 * assembled at runtime (`` `gap-[var(--spacing-system-${token})]` ``) produces
 * no rule at all and the spacing silently disappears — the variable resolves
 * fine, but no declaration ever references it. This module therefore exports
 * the token DATA (for tooling and tests) and deliberately NO class builder.
 *
 * JSX-free leaf with its own `exports` subpath so the hub's ODS allowlist script
 * (a plain node/tsx script) can import the token pattern without React.
 */

/** Every `--spacing-system-*` token, in ascending order. */
export const ODS_SPACING_TOKENS = [
  'zero',
  'xxs',
  'xs',
  'xsf',
  's',
  'sf',
  'm',
  'mf',
  'l',
  'lf',
  'xl',
  'xlf',
  'xxl',
] as const;

export type OdsSpacingToken = (typeof ODS_SPACING_TOKENS)[number];

/** Matches a `--spacing-system-<token>` reference (used by the hub's allowlist script). */
export const ODS_SPACING_TOKEN_PATTERN = /--spacing-system-([a-z]+)/g;

/** Spacing properties the conversion covers (gap + every padding/margin edge). */
/**
 * Every spacing property ODS tokenizes. A runtime TUPLE, not just a union, so
 * a consumer that has to scan source for untokenized spacing reads the list
 * from here instead of re-spelling it.
 */
export const ODS_SPACING_PROPS = [
  'gap',
  'p',
  'px',
  'py',
  'pt',
  'pb',
  'pl',
  'pr',
  'm',
  'mx',
  'my',
  'mt',
  'mb',
  'ml',
  'mr',
  'space-x',
  'space-y',
] as const;

export type OdsSpacingProp = (typeof ODS_SPACING_PROPS)[number];

/**
 * THE conversion table: a Tailwind step whose pixel value has an EXACT ODS token.
 * Every entry is asserted against `ods-responsive-tokens.css` (4 x step px, and
 * fixed at every breakpoint) by this leaf's vitest. A step that is absent here
 * has no exact token and must be carried verbatim on a component's exported
 * "untokenized spacing" allowlist.
 */
export const TAILWIND_STEP_TO_ODS_TOKEN = {
  1: 'xxs',
  2: 'xsf',
  3: 'sf',
  4: 'mf',
  6: 'lf',
  10: 'xlf',
} as const satisfies Record<number, OdsSpacingToken>;

export type TailwindSpacingStep = keyof typeof TAILWIND_STEP_TO_ODS_TOKEN;
