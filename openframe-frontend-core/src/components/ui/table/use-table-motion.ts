'use client'

import { useEffect, useState } from 'react'

/**
 * Framer Motion runtime resolved lazily for the opt-in row-reorder animation.
 * `motionDiv` is `motion.div`; `LayoutGroup` coordinates the FLIP.
 */
export interface TableMotionRuntime {
  // framer-motion component types are intentionally `any` here so the base table
  // never has to statically reference framer-motion (keeping it out of the
  // default bundle).
  motionDiv: any
  LayoutGroup: any
}

/**
 * Lazily loads `framer-motion` — via a dynamic `import()` so it lands in its own
 * chunk — ONLY when row-reorder animation is enabled. Consumers that never set
 * `animateRowReorder` never pull framer-motion into their bundle (the default
 * `Table`/`TableRow` path stays motion-free).
 *
 * Returns `null` until the module resolves (and always when `enabled` is false);
 * callers render plain DOM in the meantime, so the first paint is non-animated
 * and the FLIP kicks in once the chunk has loaded.
 */
export function useTableMotion(enabled: boolean): TableMotionRuntime | null {
  const [runtime, setRuntime] = useState<TableMotionRuntime | null>(null)

  useEffect(() => {
    if (!enabled || runtime) return
    let active = true
    import('framer-motion')
      .then((m) => {
        if (active) setRuntime({ motionDiv: m.motion.div, LayoutGroup: m.LayoutGroup })
      })
      .catch(() => {
        // Chunk-load failure → keep `runtime` null so the table degrades to
        // plain (non-animated) rows, instead of surfacing an unhandled
        // promise rejection / global chunk-load error.
      })
    return () => {
      active = false
    }
  }, [enabled, runtime])

  return enabled ? runtime : null
}
