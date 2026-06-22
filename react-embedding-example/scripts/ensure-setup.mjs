#!/usr/bin/env node
/**
 * One-shot bootstrap that fronts `npm run dev`. Each step is gated on a
 * concrete artifact, so warm runs are sub-100ms (a few `existsSync` calls)
 * and only the first launch — or one after blowing away node_modules /
 * .yalc / the lib's dist — pays the install cost.
 *
 * Why this exists: the embed used to consume the lib via `file:../openframe-frontend-core`,
 * which let it share the lib's own `node_modules` automatically. Switching
 * to yalc made every consumer responsible for installing the lib's
 * transitive deps locally — without this script, `npm run dev` failed with
 * `Could not resolve "lucide-react" / "@react-aria/utils" / …` on a fresh
 * clone or after a `node_modules` wipe.
 */
import { existsSync } from 'node:fs'
import { execSync } from 'node:child_process'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '..')
const libDir = resolve(root, '..', 'openframe-frontend-core')

function step(msg, cmd, cwd) {
  console.log(`[setup] ${msg}`)
  execSync(cmd, { cwd, stdio: 'inherit' })
}

// 1. Lib must have a built dist — Vite resolves `@flamingo-stack/openframe-frontend-core/components/...`
//    against it. `yalc:watch` keeps it fresh in steady state, but cold starts need a one-shot build.
if (!existsSync(join(libDir, 'dist', 'index.js'))) {
  if (!existsSync(join(libDir, 'node_modules'))) {
    step('lib deps missing — installing', 'npm install', libDir)
  }
  step('lib dist missing — building', 'npm run build', libDir)
}

// 2. Yalc snapshot present locally. `yalc publish` in the lib registers the package in the
//    user's global yalc registry; `yalc add` in the embed materializes `.yalc/` + edits package.json.
//    On warm runs both no-op (yalc detects no version change), so this is just safety net for
//    fresh clones that picked up the new `file:.yalc/...` dep from git but have no `.yalc/` yet.
if (!existsSync(join(root, '.yalc', '@flamingo-stack', 'openframe-frontend-core', 'package.json'))) {
  step('publishing lib to yalc store', 'yalc publish', libDir)
  step('adding lib snapshot to embed', 'yalc add @flamingo-stack/openframe-frontend-core', root)
}

// 3. Embed's own node_modules has the lib's transitive deps. We sentinel on a single dep
//    (`lucide-react`) because checking all 74 is overkill — if it's missing they almost certainly
//    all are (yalc add either ran install for everything or for nothing).
if (!existsSync(join(root, 'node_modules', 'lucide-react'))) {
  step('embed transitive deps missing — installing', 'npm install', root)
}
