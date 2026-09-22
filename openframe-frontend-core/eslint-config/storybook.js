import storybookPlugin from 'eslint-plugin-storybook';

/**
 * Storybook layer for the component library. Additive, spread after `react`.
 *
 * The plugin's flat entry is `configs['flat/recommended']`; the unprefixed
 * `configs.recommended` is still the legacy eslintrc shape and silently does
 * nothing in a flat config.
 */
export const storybook = [
  ...storybookPlugin.configs['flat/recommended'],

  {
    name: 'flamingo/storybook',
    files: ['**/*.stories.{js,jsx,ts,tsx}', '**/.storybook/**/*.{js,jsx,ts,tsx}'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      'unused-imports/no-unused-vars': 'off',

      // Stories are fixtures, not shipped UI: the `<img>` in a story is a stand-in
      // for whatever the consumer will pass (a picsum placeholder, a GitHub avatar),
      // and `next/image` would need per-host `remotePatterns` for each of them.
      '@next/next/no-img-element': 'off',
    },
  },
];

export default storybook;
