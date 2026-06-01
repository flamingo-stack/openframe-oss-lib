"use client"

import * as React from "react"
import * as DialogPrimitive from "@radix-ui/react-dialog"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "../../utils/cn"
import {
  DrawerBody,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  type DrawerSide,
} from "../ui/drawer"
import { useAppLayoutDrawerContainer } from "./app-layout"

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

const DrawerOpenContext = React.createContext<boolean>(false)

interface AppLayoutDrawerRootProps
  extends React.ComponentPropsWithoutRef<typeof DialogPrimitive.Root> {}

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
  const [internalOpen, setInternalOpen] = React.useState(defaultOpen ?? false)
  const isControlled = openProp !== undefined
  const open = isControlled ? (openProp as boolean) : internalOpen

  const handleOpenChange = React.useCallback(
    (next: boolean) => {
      if (!isControlled) setInternalOpen(next)
      onOpenChange?.(next)
    },
    [isControlled, onOpenChange],
  )

  return (
    <DrawerOpenContext.Provider value={open}>
      <DialogPrimitive.Root
        {...rest}
        open={open}
        onOpenChange={handleOpenChange}
        modal={modal}
      >
        {children}
      </DialogPrimitive.Root>
    </DrawerOpenContext.Provider>
  )
}
AppLayoutDrawerRoot.displayName = "AppLayoutDrawer"

const AppLayoutDrawerTrigger = DialogPrimitive.Trigger
const AppLayoutDrawerClose = DialogPrimitive.Close

const appLayoutDrawerVariants = cva(
  "absolute z-[45] flex outline-none focus:outline-none focus-visible:outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:duration-300 data-[state=open]:duration-300",
  {
    variants: {
      side: {
        right:
          "inset-y-0 right-0 items-center data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right",
        left:
          "inset-y-0 left-0 items-center data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left",
        top:
          "inset-x-0 top-0 justify-center data-[state=closed]:slide-out-to-top data-[state=open]:slide-in-from-top",
        bottom:
          "inset-x-0 bottom-0 justify-center data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom",
      },
      flush: {
        false: "",
        true: "",
      },
    },
    compoundVariants: [
      { side: "right", flush: false, class: "pr-4 py-4" },
      { side: "left", flush: false, class: "pl-4 py-4" },
      { side: "top", flush: false, class: "pt-4 px-4" },
      { side: "bottom", flush: false, class: "pb-4 px-4" },
      // flush=true: keep wrapper padding on desktop (uniform 16px gap so the
      // panel floats), drop on mobile for full-bleed — matches base Drawer.
      { side: "right", flush: true, class: "md:pr-4 md:py-4" },
      { side: "left", flush: true, class: "md:pl-4 md:py-4" },
      { side: "top", flush: true, class: "md:pt-4 md:px-4" },
      { side: "bottom", flush: true, class: "md:pb-4 md:px-4" },
    ],
    defaultVariants: {
      side: "right",
      flush: false,
    },
  },
)

const appLayoutDrawerPanelVariants = cva(
  "relative flex flex-col overflow-hidden bg-ods-card outline-none focus:outline-none focus-visible:outline-none",
  {
    variants: {
      side: {
        right: "h-full",
        left: "h-full",
        top: "w-full",
        bottom: "w-full",
      },
      flush: {
        false: "gap-4 rounded-md border border-ods-border p-4",
        true: "",
      },
    },
    compoundVariants: [
      { side: "right", flush: true, class: "md:rounded-md md:border md:border-ods-border" },
      { side: "left", flush: true, class: "md:rounded-md md:border md:border-ods-border" },
      { side: "top", flush: true, class: "md:rounded-md md:border md:border-ods-border" },
      { side: "bottom", flush: true, class: "md:rounded-md md:border md:border-ods-border" },
    ],
    defaultVariants: {
      side: "right",
      flush: false,
    },
  },
)

const HORIZONTAL_SIDES: ReadonlySet<DrawerSide> = new Set(["left", "right"])

function clamp(value: number, min: number, max: number): number {
  if (max < min) return min
  return Math.min(max, Math.max(min, value))
}

interface UseContainedResizableSizeArgs {
  enabled: boolean
  isHorizontal: boolean
  minSize: number
  maxSize: number
  defaultSize: number
  storageKey?: string
  container: HTMLElement | null
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
  const [available, setAvailable] = React.useState(0)

  React.useEffect(() => {
    if (!enabled || !container) return
    const update = () => {
      setAvailable(isHorizontal ? container.clientWidth : container.clientHeight)
    }
    update()
    const ro = new ResizeObserver(update)
    ro.observe(container)
    return () => ro.disconnect()
  }, [enabled, container, isHorizontal])

  const clampToContainer = React.useCallback(
    (value: number) => {
      // Reserve 32px (16px outside-edge padding from the wrapper + 16px
      // matching gap on the inside edge) so the panel sits symmetrically
      // inside the container. This also keeps the resize grip on-screen at
      // maximum extent.
      const effectiveMax = available > 0 ? Math.min(maxSize, available - 32) : maxSize
      return clamp(value, minSize, Math.max(minSize, effectiveMax))
    },
    [available, minSize, maxSize],
  )

  const readInitial = React.useCallback(() => {
    if (!enabled) return defaultSize
    if (typeof window === "undefined") return defaultSize
    if (!storageKey) return defaultSize
    try {
      const raw = window.localStorage.getItem(storageKey)
      if (!raw) return defaultSize
      const parsed = parseFloat(raw)
      if (!Number.isFinite(parsed)) return defaultSize
      return parsed
    } catch {
      return defaultSize
    }
  }, [enabled, storageKey, defaultSize])

  const [size, setSizeRaw] = React.useState<number>(readInitial)

  const setSize = React.useCallback(
    (next: number) => setSizeRaw(clampToContainer(next)),
    [clampToContainer],
  )

  React.useEffect(() => {
    if (!enabled || !storageKey || typeof window === "undefined") return
    try {
      window.localStorage.setItem(storageKey, String(Math.round(size)))
    } catch {
      // ignore quota / disabled-storage
    }
  }, [enabled, size, storageKey])

  // Re-clamp the stored size whenever the container resizes so a previously
  // saved size never overflows after the user shrinks the viewport.
  React.useEffect(() => {
    if (!enabled) return
    setSizeRaw((prev) => clampToContainer(prev))
  }, [enabled, clampToContainer])

  return { size, setSize }
}

interface AppLayoutDrawerResizeHandleProps {
  side: DrawerSide
  size: number
  minSize: number
  maxSize: number
  onSize: (next: number) => void
  ariaLabel?: string
}

function AppLayoutDrawerResizeHandle({
  side,
  size,
  minSize,
  maxSize,
  onSize,
  ariaLabel,
}: AppLayoutDrawerResizeHandleProps) {
  const isHorizontal = HORIZONTAL_SIDES.has(side)
  const startRef = React.useRef<{ x: number; y: number; size: number } | null>(null)

  const direction = side === "right" || side === "bottom" ? -1 : 1

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 && e.pointerType === "mouse") return
    e.preventDefault()
    startRef.current = { x: e.clientX, y: e.clientY, size }
    e.currentTarget.setPointerCapture(e.pointerId)
    document.body.style.cursor = isHorizontal ? "col-resize" : "row-resize"
    document.body.style.userSelect = "none"
  }

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const start = startRef.current
    if (!start) return
    const delta = isHorizontal ? e.clientX - start.x : e.clientY - start.y
    onSize(start.size + delta * direction)
  }

  const endDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!startRef.current) return
    startRef.current = null
    try {
      e.currentTarget.releasePointerCapture(e.pointerId)
    } catch {
      // ignore — pointer may already be released
    }
    document.body.style.cursor = ""
    document.body.style.userSelect = ""
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const step = e.shiftKey ? 40 : 16
    if (isHorizontal) {
      if (e.key === "ArrowLeft") {
        e.preventDefault()
        onSize(size + step * (side === "right" ? 1 : -1))
      } else if (e.key === "ArrowRight") {
        e.preventDefault()
        onSize(size + step * (side === "right" ? -1 : 1))
      }
    } else {
      if (e.key === "ArrowUp") {
        e.preventDefault()
        onSize(size + step * (side === "bottom" ? 1 : -1))
      } else if (e.key === "ArrowDown") {
        e.preventDefault()
        onSize(size + step * (side === "bottom" ? -1 : 1))
      }
    }
    if (e.key === "Home") {
      e.preventDefault()
      onSize(minSize)
    } else if (e.key === "End") {
      e.preventDefault()
      onSize(maxSize)
    }
  }

  const trackPosition =
    side === "right"
      ? "right-full top-4 bottom-4 w-3 items-center justify-end pr-1"
      : side === "left"
        ? "left-full top-4 bottom-4 w-3 items-center justify-start pl-1"
        : side === "bottom"
          ? "bottom-full left-4 right-4 h-3 justify-center items-end pb-1"
          : "top-full left-4 right-4 h-3 justify-center items-start pt-1"

  const cursorClass = isHorizontal ? "cursor-col-resize" : "cursor-row-resize"
  const gripClass = isHorizontal ? "h-10 w-1" : "w-10 h-1"

  return (
    <div
      role="separator"
      tabIndex={0}
      aria-orientation={isHorizontal ? "vertical" : "horizontal"}
      aria-valuenow={Math.round(size)}
      aria-valuemin={minSize}
      aria-valuemax={maxSize}
      aria-label={
        ariaLabel ?? (isHorizontal ? "Resize panel width" : "Resize panel height")
      }
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onKeyDown={handleKeyDown}
      className={cn(
        "group absolute z-20 flex select-none touch-none",
        "outline-none ring-0 focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0",
        trackPosition,
        cursorClass,
      )}
    >
      <div
        aria-hidden
        className={cn(
          "rounded-full bg-ods-border",
          gripClass,
        )}
      />
    </div>
  )
}

export interface AppLayoutDrawerContentProps
  extends Omit<
      React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>,
      "style"
    >,
    VariantProps<typeof appLayoutDrawerVariants> {
  flush?: boolean
  resizable?: boolean
  minSize?: number
  maxSize?: number
  defaultSize?: number
  storageKey?: string
  /** Pixel breakpoint below which `resizable` is disabled and inline size is
   *  not applied (so the panel can render full-area on mobile). */
  mobileBreakpoint?: number
  overlayClassName?: string
  resizeAriaLabel?: string
  style?: React.CSSProperties
  panelStyle?: React.CSSProperties
  panelClassName?: string
  /** Override the portal container. Defaults to AppLayout's main-area container
   *  (from context). Pass `null` to opt out of portaling. */
  container?: HTMLElement | null
  /** When `true` (default), clicks on the dim overlay over the main content
   *  area close the drawer. Clicks on AppLayout chrome (header, sidebar) NEVER
   *  close the drawer regardless of this flag — chrome interactions shouldn't
   *  accidentally dismiss a persistent panel. Pass `false` to make the drawer
   *  fully persistent (X button or Escape only). Consumer-provided
   *  `onInteractOutside` still runs first and can preventDefault to override. */
  dismissOnInteractOutside?: boolean
  /** Debug helper — when `true`, on each open the component snapshots the
   *  scroll metrics (scrollLeft / scrollWidth / clientWidth / overflow-x) of
   *  every ancestor of the portal container, at mount, after RAF, +150ms,
   *  +350ms, and on close. Use to diagnose layout-shift on open: look for an
   *  ancestor that gains `scrollLeft > 0` or has `overflow-x: visible` while
   *  `scrollWidth > clientWidth`. Remove the prop once diagnosed. */
  debugLayoutShift?: boolean
}

const AppLayoutDrawerContent = React.forwardRef<
  React.ComponentRef<typeof DialogPrimitive.Content>,
  AppLayoutDrawerContentProps
>(
  (
    {
      side = "right",
      flush = false,
      resizable = false,
      minSize = 320,
      // No upper cap by default — the AppLayout container width is the natural
      // limit. Consumers can still pass an explicit `maxSize` to clamp tighter.
      maxSize = Number.POSITIVE_INFINITY,
      defaultSize,
      storageKey,
      mobileBreakpoint = 768,
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
      children,
      ...props
    },
    ref,
  ) => {
    const contextContainer = useAppLayoutDrawerContainer()
    const portalContainer = container !== undefined ? container : contextContainer
    const open = React.useContext(DrawerOpenContext)

    // Diagnostic: walk ancestors and snapshot horizontal-scroll metrics
    // around the open transition. See `debugLayoutShift` prop doc.
    React.useEffect(() => {
      if (!debugLayoutShift) return
      if (!open) return
      if (typeof window === "undefined") return
      if (!portalContainer) return

      const collect = () => {
        const list: Element[] = []
        let el: Element | null = portalContainer
        while (el) {
          list.push(el)
          el = el.parentElement
        }
        // Add documentElement explicitly in case ancestor chain stopped early.
        if (!list.includes(document.documentElement)) {
          list.push(document.documentElement)
        }
        return list
      }

      const snapshot = (label: string) => {
        const data = collect().map((el, i) => {
          const cs = window.getComputedStyle(el)
          const overflows = el.scrollWidth > el.clientWidth
          const cls = String((el as HTMLElement).className ?? "")
            .replace(/\s+/g, " ")
            .slice(0, 60)
          return {
            depth: i,
            tag:
              el.tagName.toLowerCase() +
              ((el as HTMLElement).id ? "#" + (el as HTMLElement).id : ""),
            class: cls,
            "overflow-x": cs.overflowX,
            scrollLeft: el.scrollLeft,
            scrollWidth: el.scrollWidth,
            clientWidth: el.clientWidth,
            hOverflow: overflows ? "⚠️" : "",
          }
        })
        // eslint-disable-next-line no-console
        console.groupCollapsed(`[AppLayoutDrawer] ${label}`)
        // eslint-disable-next-line no-console
        console.table(data)
        // eslint-disable-next-line no-console
        console.groupEnd()
      }

      snapshot("open: t0 (mount)")
      const raf = requestAnimationFrame(() => snapshot("open: t≈16ms (RAF 1)"))
      const t150 = window.setTimeout(() => snapshot("open: t≈150ms (mid-anim)"), 150)
      const t350 = window.setTimeout(() => snapshot("open: t≈350ms (post-anim)"), 350)

      return () => {
        cancelAnimationFrame(raf)
        clearTimeout(t150)
        clearTimeout(t350)
        snapshot("close")
      }
    }, [open, portalContainer, debugLayoutShift])

    const resolvedSide: DrawerSide = side ?? "right"
    const isHorizontal = HORIZONTAL_SIDES.has(resolvedSide)
    const initialSize = defaultSize ?? (isHorizontal ? 560 : 480)

    const [isMobile, setIsMobile] = React.useState(false)
    React.useEffect(() => {
      if (typeof window === "undefined") return
      const mq = window.matchMedia(`(max-width: ${mobileBreakpoint - 1}px)`)
      const update = () => setIsMobile(mq.matches)
      update()
      mq.addEventListener("change", update)
      return () => mq.removeEventListener("change", update)
    }, [mobileBreakpoint])

    const { size, setSize } = useContainedResizableSize({
      enabled: resizable,
      isHorizontal,
      minSize,
      maxSize,
      defaultSize: initialSize,
      storageKey,
      container: portalContainer,
    })

    const applyInlineSize = resizable && !isMobile
    const sizeStyle: React.CSSProperties = applyInlineSize
      ? isHorizontal
        ? { width: size }
        : { height: size }
      : {}

    return (
      <DialogPrimitive.Portal container={portalContainer}>
        {/* Overlay rendered manually: Radix's DialogPrimitive.Overlay returns
            null in non-modal mode, so we render a plain div here. Setting
            `pointer-events-auto` ensures it catches clicks on the main area
            so they don't fall through to buttons underneath — that would
            otherwise fire both Radix's outside-close AND the button's
            own onClick, producing a close-then-reopen flicker. */}
        <div
          aria-hidden
          data-state={open ? "open" : "closed"}
          className={cn(
            "absolute inset-0 z-[40] bg-black/50 outline-none data-[state=open]:pointer-events-auto data-[state=closed]:pointer-events-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
            overlayClassName,
          )}
        />
        <DialogPrimitive.Content
          ref={ref}
          className={cn(appLayoutDrawerVariants({ side, flush }))}
          style={style}
          onInteractOutside={(event) => {
            onInteractOutside?.(event)
            if (event.defaultPrevented) return
            // Chrome (header, sidebar) sits OUTSIDE the portal container.
            // Those clicks never dismiss — they navigate, etc. Only clicks
            // INSIDE the portal container (the overlay over main) can dismiss.
            const target = event.target as Node | null
            const isInsideContainer =
              !!target && !!portalContainer?.contains(target)
            if (!isInsideContainer) {
              event.preventDefault()
              return
            }
            if (!dismissOnInteractOutside) event.preventDefault()
          }}
          {...props}
        >
          {applyInlineSize ? (
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
              className,
              panelClassName,
            )}
            style={{ ...sizeStyle, ...panelStyle }}
          >
            {children}
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    )
  },
)
AppLayoutDrawerContent.displayName = "AppLayoutDrawerContent"

// Sub-components are visually identical to the base Drawer's — re-export as
// aliases so the namespace stays consistent for consumers.
const AppLayoutDrawerHeader = DrawerHeader
const AppLayoutDrawerTitle = DrawerTitle
const AppLayoutDrawerDescription = DrawerDescription
const AppLayoutDrawerBody = DrawerBody
const AppLayoutDrawerFooter = DrawerFooter

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
}
