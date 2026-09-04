/**
 * ODS spacing tokens + the ONE Tailwind-step → token conversion table.
 *
 * The ODS preset deliberately ships NO Tailwind `spacing` scale, so `gap-lf` is
 * not a class — spacing is written in the ARBITRARY-VALUE form
 * `gap-[var(--spacing-system-lf)]`. `odsSpacingClass` is the only place that
 * form is spelled.
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
export type OdsSpacingProp =
  | 'gap'
  | 'p'
  | 'px'
  | 'py'
  | 'pt'
  | 'pb'
  | 'pl'
  | 'pr'
  | 'm'
  | 'mx'
  | 'my'
  | 'mt'
  | 'mb'
  | 'ml'
  | 'mr'
  | 'space-x'
  | 'space-y';

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

/**
 * The ODS spacing class for a prop + token, with an optional breakpoint prefix.
 * `odsSpacingClass('gap', 'lf')` → `gap-[var(--spacing-system-lf)]`
 * `odsSpacingClass('py', 'mf', 'md')` → `md:py-[var(--spacing-system-mf)]`
 */
export function odsSpacingClass(prop: OdsSpacingProp, token: OdsSpacingToken, prefix?: string): string {
  const base = `${prop}-[var(--spacing-system-${token})]`;
  return prefix ? `${prefix}:${base}` : base;
}

/** The ODS class for a Tailwind step that has an exact token. */
export function odsSpacingClassForStep(prop: OdsSpacingProp, step: TailwindSpacingStep, prefix?: string): string {
  return odsSpacingClass(prop, TAILWIND_STEP_TO_ODS_TOKEN[step], prefix);
}
