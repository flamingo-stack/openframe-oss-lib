import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

/**
 * Shared Prettier preset — the formatting half of the same contract.
 *
 * Every value below is chosen to reproduce the existing `biome.json` formatter
 * byte-for-byte, so switching engines is not also a restyling. Measured on
 * openframe-oss-frontend, the one repo that is currently 100 % Biome-clean:
 * with these settings and the Tailwind plugin disabled, 31 of 1 050 files
 * differ, and every one of those differences is inside a `graphql` tagged
 * template — Prettier formats embedded GraphQL, Biome leaves it alone. Set
 * `embeddedLanguageFormatting: 'off'` locally if you would rather not take
 * that churn.
 *
 * The plugin is resolved to an absolute path on purpose. Prettier resolves
 * plugin names relative to the *current working directory*, not to the config
 * file, so a bare "prettier-plugin-tailwindcss" string breaks the moment
 * anyone runs prettier from a subdirectory or through a pre-commit hook.
 *
 * Usage — `prettier.config.mjs`:
 *
 *   import config from '@flamingo-stack/openframe-frontend-core/eslint-config/prettier'
 *   export default { ...config, tailwindFunctions: [...config.tailwindFunctions, 'myLocalHelper'] }
 */
export const prettierConfig = {
  printWidth: 120,
  tabWidth: 2,
  useTabs: false,
  semi: true,
  singleQuote: true,
  jsxSingleQuote: false,
  quoteProps: 'as-needed',
  trailingComma: 'all',
  bracketSpacing: true,
  bracketSameLine: false,
  arrowParens: 'avoid',
  endOfLine: 'lf',

  plugins: [require.resolve('prettier-plugin-tailwindcss')],

  // Class-sorting has to know which call sites hold class strings. `cn` is the
  // shared `clsx`+`tailwind-merge` wrapper exported by openframe-frontend-core
  // and is used in ~560 files across the frontends.
  tailwindFunctions: ['cn', 'cva', 'clsx', 'twMerge'],

  // …and which JSX props do, beyond `className` itself. Harvested from the
  // three repos: these are the ones with more than a couple of call sites.
  tailwindAttributes: [
    'triggerClassName',
    'contentClassName',
    'backgroundClassName',
    'rowClassName',
    'valueClassName',
    'inputClassName',
    'labelClassName',
    'initialsClassName',
    'indicatorClassName',
    'iconClassName',
    'containerClassName',
    'mainClassName',
    'buttonClassName',
    'wrapperClassName',
    'shadowClassName',
  ],
};

export default prettierConfig;
