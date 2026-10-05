'use client';

import { useCallback, useMemo, useState } from 'react';

import { clamp } from '../../utils/common';
import { createLocalStorageAdapter } from '../../utils/local-storage-adapter';

/**
 * The size of a drag-to-resize panel (`Drawer`, `AppLayoutDrawer`).
 *
 * Two values are kept apart, and only one of them is ever stored:
 *
 * - the size the user CHOSE (a drag or a key press on the handle), stored under
 *   `storageKey` and `null` until they choose one;
 * - the size RENDERED, derived on every render from the choice (or, without
 *   one, from `defaultSize`) and clamped to the room there is right now.
 *
 * The room changing never writes anything. A narrow window, docked dev tools or
 * a phone-sized emulation shrink the panel for as long as they last and the
 * chosen size comes back with the room. A panel nobody resized follows
 * `defaultSize`, so a default that depends on the viewport keeps depending on
 * it, and a changed default reaches everyone who never chose a size.
 *
 * The stored value is `{ size }`. A bare number under the same key was written
 * by the previous implementation, which stored defaults and clamped sizes as if
 * they were choices; it cannot be told apart from a real choice, so it is
 * ignored.
 */
export interface UseResizablePanelSizeArgs {
  /** False leaves the panel at `defaultSize` and reads or writes nothing. */
  enabled: boolean;
  minSize: number;
  maxSize: number;
  /** Size while the user has chosen none. May change between renders. */
  defaultSize: number;
  /** Room along the resize axis, in px. 0 while it is not measured yet. */
  available: number;
  /** Px of `available` the panel never takes (the gap that keeps the handle on screen). */
  reserve: number;
  /** localStorage key for the chosen size. Omit to keep it for the mount only. */
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
      storageKey
        ? createLocalStorageAdapter<StoredPanelSize>({
            key: storageKey,
            validate: isStoredPanelSize,
            logTag: `[panel-size:${storageKey}]`,
          })
        : null,
    [storageKey],
  );

  const [chosenSize, setChosenSize] = useState<number | null>(() => (enabled ? (storage?.load()?.size ?? null) : null));

  const clampSize = useCallback(
    (value: number) => {
      const ceiling = available > 0 ? Math.min(maxSize, available - reserve) : maxSize;
      return clamp(value, minSize, Math.max(minSize, ceiling));
    },
    [available, reserve, minSize, maxSize],
  );

  const size = enabled ? clampSize(chosenSize ?? defaultSize) : defaultSize;

  /** The user's choice. The only path that stores a size. */
  const setSize = useCallback(
    (next: number) => {
      const chosen = Math.round(clampSize(next));
      setChosenSize(chosen);
      storage?.save({ size: chosen });
    },
    [clampSize, storage],
  );

  return { size, setSize, clampSize };
}
