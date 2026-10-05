'use client';

import { useCallback, useMemo, useState } from 'react';

import { clamp } from '../../utils/common';
import { createLocalStorageAdapter } from '../../utils/local-storage-adapter';

/**
 * The size of a drag-to-resize panel (`Drawer`, `AppLayoutDrawer`).
 *
 * Two values are kept apart, and only one of them is ever stored:
 *
 * - the size the user CHOSE (a drag or a key press on the handle), stored, and
 *   `null` until they choose one;
 * - the size RENDERED, derived on every render from the choice (or, without
 *   one, from `defaultSize`) and clamped to the room there is right now.
 *
 * The room changing never writes anything. A narrow window, docked dev tools or
 * a phone-sized emulation shrink the panel for as long as they last and the
 * chosen size comes back with the room. A panel nobody resized follows
 * `defaultSize`: given as a function of the room, it tracks the window, and a
 * changed default reaches everyone who never chose a size.
 *
 * The choice is stored as `{ size }` under `<storageKey>:chosen`, never under
 * `storageKey` itself. The previous implementation wrote a bare number there,
 * defaults and clamped sizes included, so that value cannot be told apart from
 * a real choice and is not read; and a page still running that implementation
 * (a tab left open across a deploy) keeps writing it, which must not replace
 * the choice.
 */

/** A fixed size in px, or one computed from the room along the resize axis
 *  (0 while the room is not measured, and on the server). */
export type PanelDefaultSize = number | ((available: number) => number);

const CHOSEN_SIZE_KEY_SUFFIX = ':chosen';

export interface UseResizablePanelSizeArgs {
  /** False leaves the panel at `defaultSize` and reads or writes nothing. */
  enabled: boolean;
  minSize: number;
  maxSize: number;
  /** Size while the user has chosen none. */
  defaultSize: PanelDefaultSize;
  /** Room along the resize axis, in px. 0 while it is not measured yet. */
  available: number;
  /** Px of `available` the panel never takes (the gap that keeps the handle on screen). */
  reserve: number;
  /** Base localStorage key for the chosen size. Omit to keep it for the mount only. */
  storageKey?: string;
}

interface StoredPanelSize {
  size: number;
}

function isStoredPanelSize(value: unknown): value is StoredPanelSize {
  if (typeof value !== 'object' || value === null) return false;
  const { size } = value as { size?: unknown };
  return typeof size === 'number' && Number.isFinite(size) && size > 0;
}

export function useResizablePanelSize({
  enabled,
  minSize,
  maxSize,
  defaultSize,
  available,
  reserve,
  storageKey,
}: UseResizablePanelSizeArgs) {
  const storage = useMemo(
    () =>
      enabled && storageKey
        ? createLocalStorageAdapter<StoredPanelSize>({
            key: `${storageKey}${CHOSEN_SIZE_KEY_SUFFIX}`,
            validate: isStoredPanelSize,
            logTag: `[panel-size:${storageKey}]`,
          })
        : null,
    [enabled, storageKey],
  );

  // The choice belongs to the storage it was read from. When that changes (a
  // drawer reused under another key, or resizing switched on after mount) it is
  // read again during render, so no frame shows the other key's size.
  const [held, setChosen] = useState(() => ({ storage, size: storage?.load()?.size ?? null }));
  const chosen = held.storage === storage ? held : { storage, size: storage?.load()?.size ?? null };
  if (chosen !== held) setChosen(chosen);
  const chosenSize = chosen.size;

  const clampSize = useCallback(
    (value: number) => {
      const ceiling = available > 0 ? Math.min(maxSize, available - reserve) : maxSize;
      return clamp(value, minSize, Math.max(minSize, ceiling));
    },
    [available, reserve, minSize, maxSize],
  );

  const fallbackSize = typeof defaultSize === 'function' ? defaultSize(available) : defaultSize;
  const size = enabled ? clampSize(chosenSize ?? fallbackSize) : fallbackSize;

  /** The user's choice. The only path that stores a size. */
  const setSize = useCallback(
    (next: number) => {
      const nextSize = Math.round(clampSize(next));
      setChosen({ storage, size: nextSize });
      storage?.save({ size: nextSize });
    },
    [clampSize, storage],
  );

  return { size, setSize, clampSize };
}
