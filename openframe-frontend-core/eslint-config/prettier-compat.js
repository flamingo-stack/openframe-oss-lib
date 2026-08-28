import configPrettier from 'eslint-config-prettier/flat';

/**
 * Turns off every ESLint rule that could disagree with the formatter.
 *
 * §2.3: formatting is not the linter's job. Spread this **last**, after every
 * other layer — its whole job is to win.
 *
 * Checked on 2026-08-24 with `npx eslint-config-prettier <file>`: the current
 * stack (eslint-config-next + typescript-eslint + the layers here) contains no
 * conflicting rule, so today this changes nothing. It is here as a structural
 * guarantee, not a fix: the next `eslint-config-next` release can add a
 * stylistic rule without asking, and the failure mode — formatter and linter
 * fighting over the same line on every save — is exactly the pain this whole
 * migration exists to end.
 */
export const prettierCompat = [{ ...configPrettier, name: 'flamingo/prettier-compat' }];

export default prettierCompat;
