#!/usr/bin/env node
/**
 * One-shot bootstrap that fronts `npm run dev`.
 *
 * FRESHNESS-GATED, not existence-gated (hardened 2026-08-01 after repeat
 * "does not provide an export named X" breakages): an existence check
 * happily serves a WEEKS-STALE `.yalc` snapshot after the lib gains new
 * exports — vite prebundles the stale copy and the app explodes at
 * runtime. Every gate below compares mtimes so `npm run dev` self-heals:
 *
 *   1. lib dist    — rebuilt when missing OR older than the newest file
 *                    in the lib's src/ (uncommitted edits included).
 *   2. .yalc snap  — re-published + re-added when missing OR older than
 *                    the lib dist it mirrors; the vite dep cache
 *                    (node_modules/.vite) is purged in the same breath
 *                    (belt-and-suspenders — `dev` also passes --force).
 *   3. embed deps  — unchanged sentinel (lucide-react) for the lib's
 *                    transitive deps.
 *
 * Warm-run cost: one recursive mtime scan of the lib's src/ (~200ms) +
 * a few statSync calls. Only a genuinely stale artifact pays more.
 *
 * Why this exists at all: the embed used to consume the lib via
 * `file:../openframe-frontend-core`, which shared the lib's node_modules
 * automatically. Switching to yalc made every consumer responsible for
 * installing the lib's transitive deps locally — without this script,
 * `npm run dev` failed with `Could not resolve "lucide-react" / …` on a
 * fresh clone or after a `node_modules` wipe.
 */
import { existsSync, readdirSync, rmSync, statSync } from 'node:fs'
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

/** Newest file mtime under a directory (recursive). Fast enough to run
 *  on every dev start; correctness beats shaving 200ms off cold starts. */
function newestMtimeMs(dir) {
  let newest = 0
  for (const entry of readdirSync(dir, { recursive: true, withFileTypes: true })) {
    if (!entry.isFile()) continue
    const m = statSync(join(entry.parentPath ?? entry.path, entry.name)).mtimeMs
    if (m > newest) newest = m
  }
  return newest
}

const mtimeOrZero = (p) => (existsSync(p) ? statSync(p).mtimeMs : 0)

// 1. Lib dist — Vite resolves `@flamingo-stack/openframe-frontend-core/components/...`
//    against it. Rebuild when missing OR stale vs the lib's src tree, so a
//    branch switch / fresh lib edit can never serve yesterday's bundle.
const distIndex = join(libDir, 'dist', 'index.js')
if (mtimeOrZero(distIndex) < newestMtimeMs(join(libDir, 'src'))) {
  if (!existsSync(join(libDir, 'node_modules'))) {
    step('lib deps missing — installing', 'npm install', libDir)
  }
  step('lib dist missing/stale — building', 'npm run build', libDir)
}

// 2. Yalc snapshot — refresh when missing OR older than the dist it mirrors.
//    `yalc publish` registers the lib in the user's global yalc store;
//    `yalc add` re-materializes `.yalc/` + the node_modules copy. On a
//    refresh, ALSO purge vite's prebundle cache: a prebundle of the
//    previous snapshot is exactly the "does not provide an export
//    named …" failure mode.
const snapDist = join(root, '.yalc', '@flamingo-stack', 'openframe-frontend-core', 'dist', 'index.js')
if (mtimeOrZero(snapDist) < mtimeOrZero(distIndex)) {
  step('yalc snapshot missing/stale — publishing lib', 'yalc publish', libDir)
  step('refreshing embed snapshot', 'yalc add @flamingo-stack/openframe-frontend-core', root)
  rmSync(join(root, 'node_modules', '.vite'), { recursive: true, force: true })
  console.log('[setup] purged vite dep cache (stale prebundle would miss new lib exports)')
}

// 3. Embed's own node_modules has the lib's transitive deps. We sentinel on a single dep
//    (`lucide-react`) because checking all 74 is overkill — if it's missing they almost certainly
//    all are (yalc add either ran install for everything or for nothing).
if (!existsSync(join(root, 'node_modules', 'lucide-react'))) {
  step('embed transitive deps missing — installing', 'npm install', root)
}
