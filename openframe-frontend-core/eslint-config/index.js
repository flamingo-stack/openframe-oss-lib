/**
 * `@flamingo-stack/openframe-frontend-core/eslint-config` = the
 * framework-independent base only.
 *
 * Deliberately not a barrel over every layer: `./next` imports
 * `eslint-config-next`, which loads its parser out of `next/dist/...` at module
 * evaluation time. Re-exporting it here would make a plain
 * `import config from '@flamingo-stack/openframe-frontend-core/eslint-config'` throw in any project
 * that does not have Next installed — the Tauri chat clients, for one.
 *
 * Every other layer is a subpath import:
 *
 *   @flamingo-stack/openframe-frontend-core/eslint-config/next
 *   @flamingo-stack/openframe-frontend-core/eslint-config/react
 *   @flamingo-stack/openframe-frontend-core/eslint-config/relay
 *   @flamingo-stack/openframe-frontend-core/eslint-config/storybook
 *   @flamingo-stack/openframe-frontend-core/eslint-config/type-checked
 *   @flamingo-stack/openframe-frontend-core/eslint-config/ignores
 *   @flamingo-stack/openframe-frontend-core/eslint-config/prettier
 */
export { base, base as default } from './base.js';
export { ignores } from './ignores.js';
