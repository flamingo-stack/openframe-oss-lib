# Shared ESLint + Prettier config

The lint half of `@flamingo-stack/openframe-frontend-core`. One base rule set for every Flamingo
frontend; each repo adds only what is genuinely local to it.

Plain ESM, shipped as source — tsup never touches this directory, and `tsconfig.json` only includes
`src/**/*`, so nothing here is built or type-checked.

## Install

The toolchain rides along with the core library, which every frontend already depends on. Each repo
needs one devDependency of its own:

```bash
npm i -D eslint@^9.39.0
```

ESLint stays on **9.x deliberately** — see [Why not ESLint 10](#why-not-eslint-10).

## Use

```js
// eslint.config.mjs
import { defineConfig, globalIgnores } from 'eslint/config'
import next from '@flamingo-stack/openframe-frontend-core/eslint-config/next'

export default defineConfig([
  ...next,
  globalIgnores(['my/local/generated/**']),
  {
    name: 'my-app/local',
    files: ['**/*.{ts,tsx}'],
    rules: { /* only what is specific to this repo */ },
  },
])
```

```json
{ "scripts": { "lint": "eslint .", "lint:fix": "eslint . --fix" } }
```

## Layers

| Import | Contents | Use in |
|---|---|---|
| `.../eslint-config` | `base` only | — (the default export) |
| `.../eslint-config/base` | JS + TS recommended, import sorting, unused-import autofix, shared ignores | any JS/TS package |
| `.../eslint-config/next` | `base` + `eslint-config-next` (React, hooks v7, jsx-a11y, import, `@next/next`) | Next apps, and this library |
| `.../eslint-config/react` | `base` + `react-hooks` v7 alone | React without Next (Vite, Tauri) |
| `.../eslint-config/relay` | `eslint-plugin-relay`, additive | repos with `graphql` tagged templates |
| `.../eslint-config/storybook` | `eslint-plugin-storybook`, additive | repos with stories |
| `.../eslint-config/type-checked` | floating promises, misused await, TS-aware `dot-notation` | opt-in, prefer CI over the editor |
| `.../eslint-config/ignores` | the shared ignore globs as a plain array | composing your own `globalIgnores` |
| `.../eslint-config/prettier` | the Prettier preset (Tailwind class sorting included) | `prettier.config.mjs` |

`next` and `react` are alternatives, never both. `relay` and `storybook` are additive — spread them
after whichever base layer you picked.

## Severity policy

`error` means **autofixable**: `eslint --fix` and the editor's `source.fixAll.eslint` clear it, so it
can never accumulate and blocking CI on it costs nobody anything. `warn` means a human has to decide
(a real `any` to narrow, a dependency array to think about).

The exception is the `react-hooks` v7 correctness family — `error` while not autofixable, because
those rules fire on code that already misbehaves at runtime.

Two rules are deliberately **absent** from the base and belong in a repo's local config if wanted:

- `no-console` — the frontends hold ~4 000 `console` call sites and treat them as a logging channel.
- `@typescript-eslint/naming-convention` — Biome's equivalent produced 1 715 findings in
  multi-platform-hub alone and was never enforced.

## Why not ESLint 10

ESLint 10 is out, and `eslint@9` is marked deprecated on npm. It still does not work here:

```
TypeError: Error while loading rule 'react/display-name':
  contextOrFilename.getFilename is not a function
    at .../eslint-plugin-react/lib/util/version.js:31
```

`eslint-config-next@16.3.2` depends on `eslint-plugin-react@^7.37.0`, whose latest release (7.37.5)
declares `eslint: ^3 || … || ^9.7` and still calls context methods ESLint 10 removed. The failure is
at rule-load time, so it takes the whole run down rather than degrading. Revisit when
`eslint-plugin-react` ships an ESLint 10-compatible release; the peer range here is the gate.

## Adding a rule

Put it in `base.js` only if it should hold for **every** Flamingo frontend. Anything that is true of
one repo (a `no-restricted-imports` path, a design-system rule, a backlog downgrade) belongs in that
repo's `eslint.config.mjs`.

When adding a rule to a layer that spreads a third-party preset, remember the ordering trap
documented on `judgementCalls` in `base.js`: `eslint-config-next/typescript` re-declares the
`typescript-eslint/recommended` rules at `error`, so any severity this package softens has to be
re-applied in a correction block *after* the preset.

Run the entry-point check after editing:

```bash
npm run lint:config-smoke
```
