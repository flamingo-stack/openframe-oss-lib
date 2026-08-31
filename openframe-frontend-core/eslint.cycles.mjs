import { defineConfig, globalIgnores } from 'eslint/config';

import cycles from './eslint-config/cycles.js';
import base from './eslint.config.mjs';

/*
 * `import/no-cycle` as its own stage — see eslint-config/cycles.js for the rule
 * itself and the resolver it needs.
 *
 * ★ THIS CONFIG MUST SPREAD `...base`, exactly like eslint.types.mjs does.
 * Until 2026-08-25 it spread the cycles layer STANDALONE, and in that shape the
 * rule found nothing at all: zero cycles over the whole package, while a real
 * 3-hop cycle sat in `src/components/ui/service-card.tsx` the whole time
 * (it imported `OpenFrameLogo` from the ROOT barrel, which re-exports
 * `components/ui`, which re-exports service-card). Verified by running one file
 * through both shapes: standalone reports nothing, layered reports the cycle.
 * `import/no-unresolved` stayed silent in both, so resolution was never the
 * problem — the standalone layer simply does not give the plugin enough to
 * build the export graph. A green check that examines nothing is worse than no
 * check, which is the exact failure mode cycles.js warns about for the resolver.
 *
 * The working shape walks the whole import graph, which is why it is a separate
 * stage and not part of `lint` or `verify` — it runs in CI, where a slow check
 * is cheap and a missed cycle is not.
 */
export default defineConfig([
  globalIgnores(['src/components/icons-v2-generated/**']),
  ...base,
  ...cycles,
  {
    // The shared layer caps maxDepth at 3 on cost grounds (lint-spec §3.3).
    // Kept at 3 here: depth 3 is already the expensive end of what this package
    // can afford, and every cycle it actually had was 2-3 hops through a barrel.
    // Raise it if a deeper one is ever suspected, and re-measure the cost.
    name: 'openframe-frontend-core/cycles-depth',
    files: ['**/*.{js,jsx,mjs,cjs,ts,tsx,mts,cts}'],
    rules: { 'import/no-cycle': ['error', { maxDepth: 3, ignoreExternal: true }] },
  },
]);
