'use client';

import { useEffect, useState, type ComponentType, type ElementType, type ReactNode } from 'react';

/**
 * Framer Motion runtime resolved lazily for the opt-in row-reorder animation.
 * `motionDiv` is `motion.div`; `LayoutGroup` coordinates the FLIP.
 */
export interface TableMotionRuntime {
  // Structural component types only — the base table must never statically
  // reference framer-motion's own types (that would pull the module into the
  // default bundle's type graph and, with it, the import).
  motionDiv: ElementType;
  LayoutGroup: ComponentType<{ id?: string; children?: ReactNode }>;
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
  const [runtime, setRuntime] = useState<TableMotionRuntime | null>(null);

  useEffect(() => {
    if (!enabled || runtime) return undefined;
    let active = true;
    import('framer-motion')
      .then(m => {
        if (active) setRuntime({ motionDiv: m.motion.div, LayoutGroup: m.LayoutGroup });
      })
      .catch(() => {
        // Chunk-load failure → keep `runtime` null so the table degrades to
        // plain (non-animated) rows, instead of surfacing an unhandled
        // promise rejection / global chunk-load error.
      });
    return () => {
      active = false;
    };
  }, [enabled, runtime]);

  return enabled ? runtime : null;
}
