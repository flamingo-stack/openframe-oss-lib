'use client';

import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useEffect, useState, type ReactNode } from 'react';
import { cn } from '../../utils/cn';

export interface NotificationStackItem {
  key: string;
  node: ReactNode;
}

export interface NotificationStackProps {
  /** What has arrived so far, OLDEST FIRST. The newest is drawn on top. */
  items: readonly NotificationStackItem[];
  /** How many are shown whole when a new one has just arrived. Default 3. */
  maxExpanded?: number;
  /** How long they all stay whole after an arrival before the oldest starts to fold. Default 1800. */
  lingerMs?: number;
  /** The pause between one fold and the next: they go one at a time, never together. Default 900. */
  foldEveryMs?: number;
  className?: string;
}

/** The most card edges drawn for the folded pile: past two a pile only reads as "more". */
const MAX_PILE_EDGES = 2;

// Gentle on purpose: a notification eases into place and the ones under it
// drift down with it. Soft springs with no overshoot; nothing snaps or bounces.
const ARRIVE = { type: 'spring', stiffness: 150, damping: 26, mass: 1 } as const;
const PUSH = { type: 'spring', stiffness: 130, damping: 26, mass: 1 } as const;
const FOLD = { type: 'spring', stiffness: 140, damping: 28, mass: 1 } as const;

/**
 * Notifications as a phone keeps them: the most recent on top, the list
 * starting where its host puts it (the lock screen: right under the clock). A
 * new one DROPS IN FROM ABOVE into the top place and PUSHES the ones still
 * whole DOWN. They stay
 * whole for a moment (`lingerMs`, long enough to see that one more joined
 * them), then fold away ONE AT A TIME, oldest first (`foldEveryMs` apart):
 * each slips behind the ones above it and leaves its edge under the newest,
 * until only the newest is whole on a pile of edges. Nothing that arrived is
 * taken away, and the eye follows every one of them.
 *
 * The caller passes only what has arrived, oldest first; each `node` is the
 * notification itself (`NotificationTile`). Under reduced motion the stack
 * changes in place, with no travel.
 */
export function NotificationStack({
  items,
  maxExpanded = 3,
  lingerMs = 1800,
  foldEveryMs = 900,
  className,
}: NotificationStackProps) {
  const reducedMotion = useReducedMotion();
  const count = items.length;
  const opened = Math.min(maxExpanded, count);

  // How many are whole now. A new arrival joins the ones still whole (the ones
  // already folded stay folded); a list that restarts opens afresh. State
  // derived from the prop during render, React's own pattern for it.
  const [seenCount, setSeenCount] = useState(count);
  const [whole, setWhole] = useState(opened);
  const [justArrived, setJustArrived] = useState(false);
  if (seenCount !== count) {
    setSeenCount(count);
    setWhole(count > seenCount ? Math.min(opened, whole + (count - seenCount)) : opened);
    setJustArrived(true);
  }

  // Fold the oldest whole one: the first after the linger, each next one a beat later.
  useEffect(() => {
    if (whole <= 1) return undefined;
    const timer = setTimeout(
      () => {
        setWhole(current => current - 1);
        setJustArrived(false);
      },
      justArrived ? lingerMs : foldEveryMs,
    );
    return () => clearTimeout(timer);
  }, [whole, justArrived, lingerMs, foldEveryMs]);

  const shown = items.slice(-Math.max(1, Math.min(whole, count))).reverse();
  const folded = Math.min(MAX_PILE_EDGES, Math.max(0, count - shown.length));
  const still = { duration: 0 };

  return (
    <div className={cn('flex w-full flex-col gap-1.5 pb-2.5', className)}>
      <AnimatePresence initial={false} mode="popLayout">
        {shown.map((item, index) => (
          <motion.div
            key={item.key}
            layout={reducedMotion ? false : 'position'}
            // It drops in from above, into the top place.
            initial={{ opacity: 0, y: reducedMotion ? 0 : -20, scale: reducedMotion ? 1 : 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1, transition: reducedMotion ? still : ARRIVE }}
            // Folding: it slips up behind the one above it.
            exit={{
              opacity: 0,
              y: reducedMotion ? 0 : -28,
              scale: reducedMotion ? 1 : 0.94,
              transition: reducedMotion ? still : FOLD,
            }}
            // The push: how the ones already there make room.
            transition={reducedMotion ? still : PUSH}
            // `isolate`: the pile's edges sit behind the notification, never behind the screen.
            className="relative isolate min-w-0"
          >
            {/* The pile: one edge per folded notification, under the last whole one. */}
            {index === shown.length - 1 && (
              <AnimatePresence initial={false}>
                {Array.from({ length: folded }, (_, edge) => (
                  <motion.span
                    key={edge}
                    aria-hidden
                    initial={{ opacity: 0, y: 0 }}
                    animate={{ opacity: 1 - (edge + 1) * 0.3, y: (edge + 1) * 6 }}
                    exit={{ opacity: 0, y: 0 }}
                    transition={reducedMotion ? still : FOLD}
                    className="absolute inset-0 rounded-2xl border border-ods-border bg-ods-card"
                    style={{ scaleX: 1 - (edge + 1) * 0.06, zIndex: -1 - edge }}
                  />
                ))}
              </AnimatePresence>
            )}
            {item.node}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
