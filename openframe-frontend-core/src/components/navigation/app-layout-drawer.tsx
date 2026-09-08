'use client';

import * as DialogPrimitive from '@radix-ui/react-dialog';
import { cva, type VariantProps } from 'class-variance-authority';
import {
  type CSSProperties,
  type ComponentPropsWithoutRef,
  type ComponentRef,
  type KeyboardEvent,
  type PointerEvent,
  createContext,
  forwardRef,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';

import { cn } from '../../utils/cn';
import { clamp } from '../../utils/common';
import {
  DrawerBody,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  OVERLAY_BACKDROP_CLASS,
  type DrawerSide,
} from '../ui/drawer';
import {
  type AppLayoutDrawerHandle,
  useAppLayoutDrawerContainer,
  useAppLayoutDrawerCoordination,
} from './app-layout-context';

/**
 * AppLayoutDrawer is a Drawer variant that renders **inside** AppLayout's main
 * content area instead of as a viewport-level overlay. Header and sidebar stay
 * visible and interactive while it is open.
 *
 * Implementation differs from the standard Drawer in three ways:
 *   1. `DialogPrimitive.Portal` targets the AppLayout container (provided via
 *      React Context) rather than `document.body`.
 *   2. Positioning is `absolute` (clipped to the container) instead of `fixed`.
 *   3. The Dialog is non-modal (`modal={false}`) — outside content is not
 *      inert, so header/sidebar interactions still work while the drawer is open.
 *
 * Caveat of non-modal mode: Radix's built-in `DialogPrimitive.Overlay` returns
 * null (see @radix-ui/react-dialog source). We render our own overlay div as a
 * sibling of `DialogPrimitive.Content` in the portal so it (a) provides the
 * standard dim backdrop and (b) catches pointer events over the main area —
 * otherwise clicks pass through to underlying buttons, causing a close-and-
 * reopen flicker when the click target is also a trigger.
 *
 * Everything else (visual chrome, slide animation, resize handle, sub-components)
 * matches the standard Drawer. Sub-components (header/title/body/footer) are
 * re-exported aliases of the originals so styling stays in lockstep.
 */

const DrawerOpenContext = createContext<boolean>(false);

interface AppLayoutDrawerRootProps extends ComponentPropsWithoutRef<typeof DialogPrimitive.Root> {}

const AppLayoutDrawerRoot = ({
  open: openProp,
  defaultOpen,
  onOpenChange,
  modal = false,
  children,
  ...rest
}: AppLayoutDrawerRootProps) => {
  // Shadow Dialog.Root's open state so descendants (specifically the overlay
  // rendered inside Content) can drive their own `data-state` for animations.
  // Radix doesn't expose its internal open state via a public context.
  const [internalOpen, setInternalOpen] = useState(defaultOpen ?? false);
  const isControlled = openProp !== undefined;
  const open = isControlled ? openProp : internalOpen;

  const handleOpenChange = useCallback(
    (next: boolean) => {
      if (!isControlled) setInternalOpen(next);
      onOpenChange?.(next);
    },
    [isControlled, onOpenChange],
  );

  // Coordinate with AppLayout's other in-layout panels and the mobile burger
  // menu: opening this drawer closes them, and opening any of them closes
  // this drawer via the registered close handle. The handle identity must stay
  // stable across renders — the same object is registered AND passed as `self`
  // so the coordinator can skip it when closing the rest — so it is built once
  // by `useState`'s lazy initialiser and reads the current open state through
  // latest-refs.
  const coordination = useAppLayoutDrawerCoordination();
  // Refreshed in an unconditional effect, not the render body: `close()` is
  // only ever invoked by the coordinator in response to ANOTHER panel opening,
  // which is always past a commit, and a render attempt React discards must
  // not be able to leave the handle pointing at a callback that never ran.
  const openRef = useRef(open);
  const handleOpenChangeRef = useRef(handleOpenChange);
  useEffect(() => {
    openRef.current = open;
    handleOpenChangeRef.current = handleOpenChange;
  });

  const [selfHandle] = useState<AppLayoutDrawerHandle>(() => ({
    close: () => {
      if (openRef.current) handleOpenChangeRef.current(false);
    },
  }));

  useEffect(() => {
    if (open) coordination?.notifyDrawerDidOpen(selfHandle);
  }, [open, coordination, selfHandle]);

  useEffect(() => coordination?.registerDrawer(selfHandle), [coordination, selfHandle]);

  return (
    <DrawerOpenContext.Provider value={open}>
      <DialogPrimitive.Root {...rest} open={open} onOpenChange={handleOpenChange} modal={modal}>
        {children}
      </DialogPrimitive.Root>
    </DrawerOpenContext.Provider>
  );
};
AppLayoutDrawerRoot.displayName = 'AppLayoutDrawer';

const AppLayoutDrawerTrigger = DialogPrimitive.Trigger;
const AppLayoutDrawerClose = DialogPrimitive.Close;

// z-[103] (overlay z-[102]) — above MobileBurgerMenu (backdrop z-[100],
// panel z-[101]) so an in-layout drawer opened over the mobile menu is not
// covered by it. The drawer is absolutely positioned inside the main-area
// container, so header/sidebar are unaffected regardless of z.
const appLayoutDrawerVariants = cva(
  'absolute z-[103] flex outline-none focus:outline-none focus-visible:outline-none data-[state=closed]:duration-300 data-[state=open]:duration-300 data-[state=open]:animate-in data-[state=closed]:animate-out',
  {
    variants: {
      side: {
        right:
          'inset-y-0 right-0 items-center data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right',
        left: 'inset-y-0 left-0 items-center data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left',
        top: 'inset-x-0 top-0 justify-center data-[state=closed]:slide-out-to-top data-[state=open]:slide-in-from-top',
        bottom:
          'inset-x-0 bottom-0 justify-center data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom',
      },
      flush: {
        false: '',
        true: '',
      },
    },
    compoundVariants: [
      { side: 'right', flush: false, class: 'py-[var(--spacing-system-m)] pr-[var(--spacing-system-m)]' },
      { side: 'left', flush: false, class: 'py-[var(--spacing-system-m)] pl-[var(--spacing-system-m)]' },
      { side: 'top', flush: false, class: 'px-[var(--spacing-system-m)] pt-[var(--spacing-system-m)]' },
      { side: 'bottom', flush: false, class: 'px-[var(--spacing-system-m)] pb-[var(--spacing-system-m)]' },
      { side: 'right', flush: true, class: 'md:py-[var(--spacing-system-m)] md:pr-[var(--spacing-system-m)]' },
      { side: 'left', flush: true, class: 'md:py-[var(--spacing-system-m)] md:pl-[var(--spacing-system-m)]' },
      { side: 'top', flush: true, class: 'md:px-[var(--spacing-system-m)] md:pt-[var(--spacing-system-m)]' },
      { side: 'bottom', flush: true, class: 'md:px-[var(--spacing-system-m)] md:pb-[var(--spacing-system-m)]' },
    ],
    defaultVariants: {
      side: 'right',
      flush: false,
    },
  },
);

const appLayoutDrawerPanelVariants = cva(
  'relative flex flex-col overflow-hidden bg-ods-card outline-none focus:outline-none focus-visible:outline-none',
  {
    variants: {
      side: {
        right: 'h-full',
        left: 'h-full',
        top: 'w-full',
        bottom: 'w-full',
      },
      flush: {
        false: 'gap-4 rounded-md border border-ods-border p-4',
        true: '',
      },
    },
    compoundVariants: [
      { side: 'right', flush: true, class: 'md:rounded-md md:border md:border-ods-border' },
      { side: 'left', flush: true, class: 'md:rounded-md md:border md:border-ods-border' },
      { side: 'top', flush: true, class: 'md:rounded-md md:border md:border-ods-border' },
      { side: 'bottom', flush: true, class: 'md:rounded-md md:border md:border-ods-border' },
    ],
    defaultVariants: {
      side: 'right',
      flush: false,
    },
  },
);

const HORIZONTAL_SIDES: ReadonlySet<DrawerSide> = new Set(['left', 'right']);

/**
 * Persist mode (`forceMount`) keeps the panel mounted across close, so the
 * `slide-out-*` / `fade-out` exit animations run and then — because
 * `tailwindcss-animate`'s `.animate-out` does NOT set `animation-fill-mode:
 * forwards` — the panel/overlay snap back to their resting frame (on-screen,
 * opacity 1). The element ends up fully visible again, which reads as "the
 * drawer won't close" (and dims the whole content area via the backdrop).
 *
 * Pinning `fill-mode: forwards` for the closed state holds the exit animation's
 * final frame (off-screen / transparent) after it ends. It can't be replaced by
 * a static resting transform/opacity: that would override the animation's
 * `from` value (= current computed style) and collapse the animation to a no-op.
 *
 * Not applied without persist — Radix unmounts `Content` after the animation,
 * so there's nothing to snap back.
 */
const PERSIST_CLOSED_HOLD = 'data-[state=closed]:fill-mode-forwards';

interface UseContainedResizableSizeArgs {
  enabled: boolean;
  isHorizontal: boolean;
  minSize: number;
  maxSize: number;
  defaultSize: number;
  storageKey?: string;
  container: HTMLElement | null;
}

function useContainedResizableSize({
  enabled,
  isHorizontal,
  minSize,
  maxSize,
  defaultSize,
  storageKey,
  container,
}: UseContainedResizableSizeArgs) {
  const [available, setAvailable] = useState(0);

  useEffect(() => {
    if (!enabled || !container) return undefined;
    const update = () => {
      setAvailable(isHorizontal ? container.clientWidth : container.clientHeight);
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(container);
    return () => ro.disconnect();
  }, [enabled, container, isHorizontal]);

  const clampToContainer = useCallback(
    (value: number) => {
      // Reserve 40px (the `system-m` outside-edge padding from the wrapper
      // plus a matching gap on the inside edge) so the panel sits symmetrically
      // inside the container. This also keeps the resize grip on-screen at
      // maximum extent.
      const effectiveMax = available > 0 ? Math.min(maxSize, available - 40) : maxSize;
      return clamp(value, minSize, Math.max(minSize, effectiveMax));
    },
    [available, minSize, maxSize],
  );

  const readInitial = useCallback(() => {
    if (!enabled) return defaultSize;
    if (typeof window === 'undefined') return defaultSize;
    if (!storageKey) return defaultSize;
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (!raw) return defaultSize;
      const parsed = parseFloat(raw);
      if (!Number.isFinite(parsed)) return defaultSize;
      return parsed;
    } catch {
      return defaultSize;
    }
  }, [enabled, storageKey, defaultSize]);

  const [rawSize, setSizeRaw] = useState<number>(readInitial);

  // Re-clamp the stored size whenever the container resizes so a previously
  // saved size never overflows after the user shrinks the viewport.
  //
  // Clamped where it is READ rather than written back into state from an
  // effect: `available` is already state (the ResizeObserver above owns it), so
  // the container shrinking re-renders regardless — and deriving here means the
  // panel is never painted overflowing its container for the frame between the
  // resize and the corrective commit. Keeping the raw value also means widening
  // the viewport again restores the size the user actually chose, instead of
  // leaving it permanently trimmed to the narrowest width ever seen.
  const size = enabled ? clampToContainer(rawSize) : rawSize;

  const setSize = useCallback((next: number) => setSizeRaw(clampToContainer(next)), [clampToContainer]);

  useEffect(() => {
    if (!enabled || !storageKey || typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(storageKey, String(Math.round(size)));
    } catch {
      // ignore quota / disabled-storage
    }
  }, [enabled, size, storageKey]);

  return { size, setSize };
}

interface AppLayoutDrawerResizeHandleProps {
  side: DrawerSide;
  size: number;
  minSize: number;
  maxSize: number;
  onSize: (next: number) => void;
  ariaLabel?: string;
}

function AppLayoutDrawerResizeHandle({
  side,
  size,
  minSize,
  maxSize,
  onSize,
  ariaLabel,
}: AppLayoutDrawerResizeHandleProps) {
  const isHorizontal = HORIZONTAL_SIDES.has(side);
  const startRef = useRef<{ x: number; y: number; size: number } | null>(null);

  const direction = side === 'right' || side === 'bottom' ? -1 : 1;

  const handlePointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    e.preventDefault();
    startRef.current = { x: e.clientX, y: e.clientY, size };
    e.currentTarget.setPointerCapture(e.pointerId);
    document.body.style.cursor = isHorizontal ? 'col-resize' : 'row-resize';
    document.body.style.userSelect = 'none';
  };

  const handlePointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const start = startRef.current;
    if (!start) return;
    const delta = isHorizontal ? e.clientX - start.x : e.clientY - start.y;
    onSize(start.size + delta * direction);
  };

  const endDrag = (e: PointerEvent<HTMLDivElement>) => {
    if (!startRef.current) return;
    startRef.current = null;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // ignore — pointer may already be released
    }
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const step = e.shiftKey ? 40 : 16;
    if (isHorizontal) {
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        onSize(size + step * (side === 'right' ? 1 : -1));
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        onSize(size + step * (side === 'right' ? -1 : 1));
      }
    } else {
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        onSize(size + step * (side === 'bottom' ? 1 : -1));
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        onSize(size + step * (side === 'bottom' ? -1 : 1));
      }
    }
    if (e.key === 'Home') {
      e.preventDefault();
      onSize(minSize);
    } else if (e.key === 'End') {
      e.preventDefault();
      onSize(maxSize);
    }
  };

  const trackPosition =
    side === 'right'
      ? 'right-full top-4 bottom-4 w-6 items-center justify-end pr-1'
      : side === 'left'
        ? 'left-full top-4 bottom-4 w-6 items-center justify-start pl-1'
        : side === 'bottom'
          ? 'bottom-full left-4 right-4 h-6 justify-center items-end pb-1'
          : 'top-full left-4 right-4 h-6 justify-center items-start pt-1';

  const cursorClass = isHorizontal ? 'cursor-col-resize' : 'cursor-row-resize';
  const gripClass = isHorizontal ? 'h-10 w-1' : 'w-10 h-1';

  return (
    <div
      role="separator"
      tabIndex={0}
      aria-orientation={isHorizontal ? 'vertical' : 'horizontal'}
      aria-valuenow={Math.round(size)}
      aria-valuemin={minSize}
      aria-valuemax={maxSize}
      aria-label={ariaLabel ?? (isHorizontal ? 'Resize panel width' : 'Resize panel height')}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onKeyDown={handleKeyDown}
      className={cn(
        'group absolute z-20 flex touch-none select-none',
        'outline-none ring-0 focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0',
        trackPosition,
        cursorClass,
      )}
    >
      <div aria-hidden className={cn('rounded-full bg-ods-border', gripClass)} />
    </div>
  );
}

export interface AppLayoutDrawerContentProps
  extends
    Omit<ComponentPropsWithoutRef<typeof DialogPrimitive.Content>, 'style'>,
    VariantProps<typeof appLayoutDrawerVariants> {
  flush?: boolean;
  resizable?: boolean;
  minSize?: number;
  maxSize?: number;
  defaultSize?: number;
  storageKey?: string;
  /** Pixel breakpoint below which `resizable` is disabled and inline size is
   *  not applied (so the panel can render full-area on mobile). Defaults to
   *  800 — the library's Tailwind `md` breakpoint, so the JS mobile switch
   *  and the `md:` panel styles flip together. */
  mobileBreakpoint?: number;
  overlayClassName?: string;
  resizeAriaLabel?: string;
  style?: CSSProperties;
  panelStyle?: CSSProperties;
  panelClassName?: string;
  /** Override the portal container. Defaults to AppLayout's main-area container
   *  (from context). Pass `null` to opt out of portaling. */
  container?: HTMLElement | null;
  /** Keep the panel mounted across close so its subtree state survives an
   *  open → close → open cycle (no remount, no refetch, no flicker). Lazy:
   *  nothing renders until the first open; after that the panel stays mounted
   *  (Radix `forceMount`) and the slide animation runs off `data-state`.
   *  Default `false` — preserves the standard unmount-on-close behaviour for
   *  every other consumer. */
  keepMounted?: boolean;
  /** When `true` (default), clicks on the dim overlay over the main content
   *  area close the drawer. Clicks on AppLayout chrome (header, sidebar) NEVER
   *  close the drawer regardless of this flag — chrome interactions shouldn't
   *  accidentally dismiss a persistent panel. Pass `false` to make the drawer
   *  fully persistent (X button or Escape only). Consumer-provided
   *  `onInteractOutside` still runs first and can preventDefault to override. */
  dismissOnInteractOutside?: boolean;
  /** Debug helper — when `true`, on each open the component snapshots the
   *  scroll metrics (scrollLeft / scrollWidth / clientWidth / overflow-x) of
   *  every ancestor of the portal container, at mount, after RAF, +150ms,
   *  +350ms, and on close. Use to diagnose layout-shift on open: look for an
   *  ancestor that gains `scrollLeft > 0` or has `overflow-x: visible` while
   *  `scrollWidth > clientWidth`. Remove the prop once diagnosed. */
  debugLayoutShift?: boolean;
}

const AppLayoutDrawerContent = forwardRef<ComponentRef<typeof DialogPrimitive.Content>, AppLayoutDrawerContentProps>(
  (
    {
      side = 'right',
      flush = false,
      resizable = false,
      minSize = 320,
      // No upper cap by default — the AppLayout container width is the natural
      // limit. Consumers can still pass an explicit `maxSize` to clamp tighter.
      maxSize = Number.POSITIVE_INFINITY,
      defaultSize,
      storageKey,
      mobileBreakpoint = 800,
      overlayClassName,
      resizeAriaLabel,
      className,
      style,
      panelStyle,
      panelClassName,
      container,
      dismissOnInteractOutside = true,
      onInteractOutside,
      debugLayoutShift = false,
      keepMounted = false,
      children,
      ...props
    },
    ref,
  ) => {
    const contextContainer = useAppLayoutDrawerContainer();
    const portalContainer = container !== undefined ? container : contextContainer;
    const open = useContext(DrawerOpenContext);

    // Persist mode: lazily mount on the first open, then never unmount. Radix
    // unmounts `Dialog.Content` on close by default, which would wipe the
    // panel's subtree state (and trigger a full refetch) on every reopen.
    // `forceMount` keeps it mounted; `hasOpened` defers that until the user
    // opens the panel at least once (no work, no exit-animation flash before
    // first open).
    // Seed from `open` so an initially-open (defaultOpen / controlled open=true)
    // drawer mounts on the first paint instead of flashing `null` for one frame.
    // Latched while rendering, not from an effect: the effect committed the
    // FIRST open with `persist` still false, so `forceMount` only arrived on
    // the render after — the exact one-frame `null` the seeding above exists to
    // avoid. Guarded on `hasOpened`, so the extra pass takes the early exit.
    const [hasOpened, setHasOpened] = useState<boolean>(Boolean(open));
    if (open && !hasOpened) setHasOpened(true);
    const persist = keepMounted && hasOpened;

    // Diagnostic: walk ancestors and snapshot horizontal-scroll metrics
    // around the open transition. See `debugLayoutShift` prop doc.
    useEffect(() => {
      if (!debugLayoutShift) return undefined;
      if (!open) return undefined;
      if (typeof window === 'undefined') return undefined;
      if (!portalContainer) return undefined;

      const collect = () => {
        const list: Element[] = [];
        let el: Element | null = portalContainer;
        while (el) {
          list.push(el);
          el = el.parentElement;
        }
        // Add documentElement explicitly in case ancestor chain stopped early.
        if (!list.includes(document.documentElement)) {
          list.push(document.documentElement);
        }
        return list;
      };

      const snapshot = (label: string) => {
        const data = collect().map((el, i) => {
          const cs = window.getComputedStyle(el);
          const overflows = el.scrollWidth > el.clientWidth;
          const cls = String((el as HTMLElement).className ?? '')
            .replace(/\s+/g, ' ')
            .slice(0, 60);
          return {
            depth: i,
            tag: el.tagName.toLowerCase() + ((el as HTMLElement).id ? '#' + (el as HTMLElement).id : ''),
            class: cls,
            'overflow-x': cs.overflowX,
            scrollLeft: el.scrollLeft,
            scrollWidth: el.scrollWidth,
            clientWidth: el.clientWidth,
            hOverflow: overflows ? '⚠️' : '',
          };
        });
        console.groupCollapsed(`[AppLayoutDrawer] ${label}`);
        console.table(data);
        console.groupEnd();
      };

      snapshot('open: t0 (mount)');
      const raf = requestAnimationFrame(() => snapshot('open: t≈16ms (RAF 1)'));
      const t150 = window.setTimeout(() => snapshot('open: t≈150ms (mid-anim)'), 150);
      const t350 = window.setTimeout(() => snapshot('open: t≈350ms (post-anim)'), 350);

      return () => {
        cancelAnimationFrame(raf);
        clearTimeout(t150);
        clearTimeout(t350);
        snapshot('close');
      };
    }, [open, portalContainer, debugLayoutShift]);

    const resolvedSide: DrawerSide = side ?? 'right';
    const isHorizontal = HORIZONTAL_SIDES.has(resolvedSide);
    const initialSize = defaultSize ?? (isHorizontal ? 560 : 480);

    const [isMobile, setIsMobile] = useState(false);
    useEffect(() => {
      if (typeof window === 'undefined') return undefined;
      const mq = window.matchMedia(`(max-width: ${mobileBreakpoint - 1}px)`);
      const update = () => setIsMobile(mq.matches);
      update();
      mq.addEventListener('change', update);
      return () => mq.removeEventListener('change', update);
    }, [mobileBreakpoint]);

    const { size, setSize } = useContainedResizableSize({
      enabled: resizable,
      isHorizontal,
      minSize,
      maxSize,
      defaultSize: initialSize,
      storageKey,
      container: portalContainer,
    });

    const applyInlineSize = resizable && !isMobile;
    const sizeStyle: CSSProperties = applyInlineSize ? (isHorizontal ? { width: size } : { height: size }) : {};

    // Persist mode, pre-first-open: render nothing so the panel mounts lazily.
    // (All hooks above run unconditionally — this early return is hooks-safe.)
    if (keepMounted && !hasOpened) return null;

    return (
      <DialogPrimitive.Portal container={portalContainer} forceMount={persist || undefined}>
        {/* Overlay rendered manually: Radix's DialogPrimitive.Overlay returns
            null in non-modal mode, so we render a plain div here. Setting
            `pointer-events-auto` ensures it catches clicks on the main area
            so they don't fall through to buttons underneath — that would
            otherwise fire both Radix's outside-close AND the button's
            own onClick, producing a close-then-reopen flicker. */}
        <div
          aria-hidden
          data-state={open ? 'open' : 'closed'}
          className={cn(
            'absolute inset-0 z-[102] outline-none data-[state=closed]:pointer-events-none data-[state=open]:pointer-events-auto data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
            OVERLAY_BACKDROP_CLASS,
            // Persist mode only: hold the fade-out's final (transparent) frame
            // so the backdrop doesn't snap back to opacity 1 and dim the whole
            // content area while the drawer is "closed" (see PERSIST_CLOSED_HOLD).
            persist && PERSIST_CLOSED_HOLD,
            overlayClassName,
          )}
        />
        <DialogPrimitive.Content
          ref={ref}
          forceMount={persist || undefined}
          // Persist mode: the panel stays mounted while closed (slid off-screen
          // by the exit animation). Make sure that off-screen content can't
          // catch clicks or be reached by tab/screen-reader.
          {...(persist && !open ? { inert: true as const, 'aria-hidden': true } : {})}
          className={cn(
            appLayoutDrawerVariants({ side, flush }),
            // Mobile: span the whole container and drop the outer gap so the
            // panel renders edge-to-edge full-screen. (`p-0` overrides the
            // variant's wrapper padding via tailwind-merge.)
            isMobile && 'inset-0 p-0',
            'data-[state=closed]:pointer-events-none',
            // Persist mode only: hold the slide-out's final (off-screen) frame
            // so the panel doesn't snap back into view (see PERSIST_CLOSED_HOLD).
            persist && PERSIST_CLOSED_HOLD,
          )}
          style={style}
          onInteractOutside={event => {
            onInteractOutside?.(event);
            if (event.defaultPrevented) return;
            // Chrome (header, sidebar) sits OUTSIDE the portal container.
            // Those clicks never dismiss — they navigate, etc. Only clicks
            // INSIDE the portal container (the overlay over main) can dismiss.
            const target = event.target as Node | null;
            const isInsideContainer = !!target && !!portalContainer?.contains(target);
            if (!isInsideContainer) {
              event.preventDefault();
              return;
            }
            if (!dismissOnInteractOutside) event.preventDefault();
          }}
          {...props}
        >
          {/* The resize grip sits just OUTSIDE the panel's inner edge
              (`right-full` etc.), so the wrapper's `translateX(100%)` close
              transform doesn't carry it off-screen — it stays as a ~12px sliver
              at the container edge. In persist mode it's also non-interactive
              while closed, so drop it entirely until the panel reopens. */}
          {applyInlineSize && (!persist || open) ? (
            <AppLayoutDrawerResizeHandle
              side={resolvedSide}
              size={size}
              minSize={minSize}
              maxSize={maxSize}
              onSize={setSize}
              ariaLabel={resizeAriaLabel}
            />
          ) : null}
          <div
            className={cn(
              appLayoutDrawerPanelVariants({ side, flush }),
              // Mobile: fill the container (the side already pins one axis) and
              // drop the card chrome so the panel is edge-to-edge full-screen.
              // Inner padding/gap is preserved so content isn't glued to the
              // edges. tailwind-merge lets these override the variant classes.
              isMobile && (isHorizontal ? 'w-full' : 'h-full'),
              isMobile && 'rounded-none border-0',
              className,
              panelClassName,
            )}
            style={{ ...sizeStyle, ...panelStyle }}
          >
            {children}
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    );
  },
);
AppLayoutDrawerContent.displayName = 'AppLayoutDrawerContent';

// Sub-components are visually identical to the base Drawer's — re-export as
// aliases so the namespace stays consistent for consumers.
const AppLayoutDrawerHeader = DrawerHeader;
const AppLayoutDrawerTitle = DrawerTitle;
const AppLayoutDrawerDescription = DrawerDescription;
const AppLayoutDrawerBody = DrawerBody;
const AppLayoutDrawerFooter = DrawerFooter;

export {
  AppLayoutDrawerRoot as AppLayoutDrawer,
  AppLayoutDrawerTrigger,
  AppLayoutDrawerClose,
  AppLayoutDrawerContent,
  AppLayoutDrawerHeader,
  AppLayoutDrawerTitle,
  AppLayoutDrawerDescription,
  AppLayoutDrawerBody,
  AppLayoutDrawerFooter,
};
