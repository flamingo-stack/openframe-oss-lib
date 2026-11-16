'use client';

import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';

/** A page's Back, as `PageLayout` / `TitleBlock` take it (`backButton`). */
export interface ColumnBack {
  label?: string;
  onClick: () => void;
}

type RegisterColumnBack = (back: ColumnBack) => () => void;

interface SlotValue {
  register: RegisterColumnBack;
  enabled: boolean;
  /** `enabled` as the slot first rendered: what the server's HTML was drawn with. */
  initialEnabled: boolean;
}

const SlotContext = createContext<SlotValue | null>(null);
const CurrentContext = createContext<ColumnBack | null>(null);

/**
 * A work-area column whose header draws the page's Back (`AppColumnHeader` `leading`).
 * While `enabled`, a `TitleBlock` below it hands its `backButton` here instead of drawing
 * it above the title, so the page has one Back at every width: in the header, where a
 * narrow column (under `content-md`) would otherwise hide it. The host reads it with
 * `useColumnBack()`.
 *
 * Always render it, toggling `enabled`: wrapping and unwrapping the subtree would remount
 * the page.
 */
export function ColumnBackSlot({ enabled = true, children }: { enabled?: boolean; children: ReactNode }) {
  const [entries, setEntries] = useState<ReadonlyArray<{ id: number; back: ColumnBack }>>([]);
  const [initialEnabled] = useState(enabled);
  const nextId = useRef(0);
  const register = useCallback<RegisterColumnBack>(back => {
    const id = nextId.current++;
    setEntries(current => [...current, { id, back }]);
    return () => setEntries(current => current.filter(entry => entry.id !== id));
  }, []);
  const slot = useMemo<SlotValue>(() => ({ register, enabled, initialEnabled }), [register, enabled, initialEnabled]);
  // The last one registered: the page on screen (an earlier one is leaving).
  const current = enabled ? (entries[entries.length - 1]?.back ?? null) : null;
  return (
    <SlotContext.Provider value={slot}>
      <CurrentContext.Provider value={current}>{children}</CurrentContext.Provider>
    </SlotContext.Provider>
  );
}

/** The page's Back handed to the enclosing `ColumnBackSlot`, or `null` (none, or no slot). */
export function useColumnBack(): ColumnBack | null {
  return useContext(CurrentContext);
}

/**
 * For window chrome opened from inside a column (a modal, a drawer): a page title in it
 * keeps its own Back. Context crosses a portal.
 */
export function ColumnBackSlotReset({ children }: { children: ReactNode }) {
  return <SlotContext.Provider value={null}>{children}</SlotContext.Provider>;
}

const noSubscription = () => () => undefined;

/**
 * `TitleBlock`'s side: inside an enabled slot, registers `back` there and answers `true`
 * (the caller draws none); otherwise `false`. The entry is registered once per label and
 * calls the latest `onClick`, so a caller passing a new function each render does not
 * re-register on every render.
 *
 * While hydrating it answers as the server drew the page (the slot's first `enabled`): the
 * host may turn the slot off before a page under a later Suspense boundary hydrates (a
 * phone, the compact layout, known only once the window is read), and markup that differs
 * from the server's would throw the boundary away. React renders again with the current
 * value right after.
 */
export function useHandColumnBack(back: ColumnBack | undefined): boolean {
  const slot = useContext(SlotContext);
  const enabled = useSyncExternalStore(
    noSubscription,
    () => slot?.enabled ?? false,
    () => slot?.initialEnabled ?? false,
  );
  const register = slot?.register;
  const latest = useRef(back);
  useEffect(() => {
    latest.current = back;
  });
  const hasBack = back !== undefined;
  const label = back?.label;
  const entry = useMemo<ColumnBack>(() => ({ label, onClick: () => latest.current?.onClick() }), [label]);
  useEffect(() => {
    if (!register || !enabled || !hasBack) return undefined;
    return register(entry);
  }, [register, enabled, hasBack, entry]);
  return enabled && hasBack;
}
