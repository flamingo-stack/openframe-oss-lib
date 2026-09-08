import relayPlugin from 'eslint-plugin-relay';

/**
 * Relay layer. Spread it *after* `next` or `react`, it is additive only.
 *
 *   export default defineConfig([...next, ...relay])
 *
 * `eslint-plugin-relay` ships no flat config: `relayPlugin.configs['ts-recommended']`
 * is a bare `{ rules }` object with no `plugins` key, so the plugin has to be
 * registered here by hand. Verified against 2.1.0 — if a future version adds a
 * real flat export, this block can shrink, but spreading `.rules` keeps working
 * either way.
 *
 * `graphql-syntax` duplicates what relay-compiler already validates at build
 * time. The rules that earn this plugin its place are the three below, which
 * need to correlate a `graphql` tagged template with how the component
 * actually consumes it — something no compiler pass and no Rust-based linter
 * currently does.
 */
export const relay = [
  {
    name: 'flamingo/relay',
    files: ['**/*.{js,jsx,ts,tsx}'],
    plugins: { relay: relayPlugin },
    rules: {
      ...relayPlugin.configs['ts-recommended'].rules,

      // Promoted from the plugin's own `warn`: an over-fetched field is a real
      // payload cost, and a fragment spread that lives away from its consumer
      // is how Relay codebases rot.
      'relay/unused-fields': 'error',
      'relay/must-colocate-fragment-spreads': 'error',
      'relay/hook-required-argument': 'error',
    },
  },
];

export default relay;
