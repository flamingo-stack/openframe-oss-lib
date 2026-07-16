"use client"

import * as React from "react"
import * as DialogPrimitive from "@radix-ui/react-dialog"
import { cva, type VariantProps } from "class-variance-authority"
import { X } from "lucide-react"

import { cn } from "../../utils/cn"
import { useHeaderHeight } from "../../hooks/ui/use-header-height"

/** Unified overlay backdrop — dimmed, no blur. Single source of truth for
 *  every full-screen backdrop (Drawer, AppLayoutDrawer, MobileBurgerMenu,
 *  TimeTracker popover) so all panels dim the page identically. */
const OVERLAY_BACKDROP_CLASS = "bg-black/50"

const Drawer = DialogPrimitive.Root

const DrawerTrigger = DialogPrimitive.Trigger

const DrawerClose = DialogPrimitive.Close

const DrawerPortal = DialogPrimitive.Portal

const DrawerOverlay = React.forwardRef<
  React.ComponentRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      "fixed inset-0 z-[9997] outline-none focus:outline-none focus-visible:outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
      OVERLAY_BACKDROP_CLASS,
      className
    )}
    {...props}
  />
))
DrawerOverlay.displayName = "DrawerOverlay"

const drawerVariants = cva(
  "fixed z-[9998] flex outline-none focus:outline-none focus-visible:outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:duration-300 data-[state=open]:duration-300",
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
      // flush=true → same wrapper padding as default on desktop so the
      // panel floats with a uniform 16px gap; on mobile (< md) the
      // padding is dropped so the panel can be full-bleed.
      // `flush` controls panel chrome (rounded/border/inner-padding),
      // NOT wrapper positioning — those concerns are independent.
      { side: "right", flush: true, class: "md:pr-4 md:py-4" },
      { side: "left", flush: true, class: "md:pl-4 md:py-4" },
      { side: "top", flush: true, class: "md:pt-4 md:px-4" },
      { side: "bottom", flush: true, class: "md:pb-4 md:px-4" },
    ],
    defaultVariants: {
      side: "right",
      flush: false,
    },
  }
)

const drawerPanelVariants = cva(
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
      // flush=true → drops inner padding/gap so the consumer fully owns
      // internal layout, BUT preserves the card chrome (rounded + border)
      // on desktop so the panel still reads as an elevated card.
      // On mobile the panel is full-bleed → no rounded/border there.
      { side: "right", flush: true, class: "md:rounded-md md:border md:border-ods-border" },
      { side: "left", flush: true, class: "md:rounded-md md:border md:border-ods-border" },
      { side: "top", flush: true, class: "md:rounded-md md:border md:border-ods-border" },
      { side: "bottom", flush: true, class: "md:rounded-md md:border md:border-ods-border" },
    ],
    defaultVariants: {
      side: "right",
      flush: false,
    },
  }
)

type DrawerSide = "right" | "left" | "top" | "bottom"

const HORIZONTAL_SIDES: ReadonlySet<DrawerSide> = new Set(["left", "right"])

function clamp(value: number, min: number, max: number): number {
  if (max < min) return min
  return Math.min(max, Math.max(min, value))
}

function viewportSize(isHorizontal: boolean): number {
  if (typeof window === "undefined") return 0
  return isHorizontal ? window.innerWidth : window.innerHeight
}

interface UseResizableSizeArgs {
  enabled: boolean
  isHorizontal: boolean
  minSize: number
  maxSize: number
  defaultSize: number
  storageKey?: string
}

function useResizableSize({
  enabled,
  isHorizontal,
  minSize,
  maxSize,
  defaultSize,
  storageKey,
}: UseResizableSizeArgs) {
  const clampToViewport = React.useCallback(
    (value: number) => {
      const vp = viewportSize(isHorizontal)
      const effectiveMax = vp > 0 ? Math.min(maxSize, vp - 80) : maxSize
      return clamp(value, minSize, Math.max(minSize, effectiveMax))
    },
    [isHorizontal, minSize, maxSize],
  )

  const readInitial = React.useCallback(() => {
    if (!enabled) return defaultSize
    if (typeof window === "undefined") return defaultSize
    if (!storageKey) return clampToViewport(defaultSize)
    try {
      const raw = window.localStorage.getItem(storageKey)
      if (!raw) return clampToViewport(defaultSize)
      const parsed = parseFloat(raw)
      if (!Number.isFinite(parsed)) return clampToViewport(defaultSize)
      return clampToViewport(parsed)
    } catch {
      return clampToViewport(defaultSize)
    }
  }, [enabled, storageKey, defaultSize, clampToViewport])

  const [size, setSizeRaw] = React.useState<number>(readInitial)

  const setSize = React.useCallback(
    (next: number) => setSizeRaw(clampToViewport(next)),
    [clampToViewport],
  )

  React.useEffect(() => {
    if (!enabled || !storageKey || typeof window === "undefined") return
    try {
      window.localStorage.setItem(storageKey, String(Math.round(size)))
    } catch {
      // ignore quota / disabled-storage
    }
  }, [enabled, size, storageKey])

  React.useEffect(() => {
    if (!enabled || typeof window === "undefined") return
    const onResize = () => setSizeRaw((prev) => clampToViewport(prev))
    window.addEventListener("resize", onResize)
    return () => window.removeEventListener("resize", onResize)
  }, [enabled, clampToViewport])

  return { size, setSize }
}

interface DrawerResizeHandleProps {
  side: DrawerSide
  size: number
  minSize: number
  maxSize: number
  onSize: (next: number) => void
  ariaLabel?: string
}

function DrawerResizeHandle({
  side,
  size,
  minSize,
  maxSize,
  onSize,
  ariaLabel,
}: DrawerResizeHandleProps) {
  const isHorizontal = HORIZONTAL_SIDES.has(side)
  const startRef = React.useRef<{ x: number; y: number; size: number } | null>(
    null,
  )

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

  // Handle is rendered as a SIBLING of the panel (child of DialogPrimitive.Content)
  // so the panel can use `overflow-hidden` without clipping the handle.
  // Wrapper has `py-4 px-4` (or `md:py-4 md:px-4` for flush on desktop)
  // when the handle is visible — handle is desktop-only, where both flush
  // and non-flush wrappers carry that padding — so `top-4 bottom-4` (or
  // `left-4 right-4`) aligns the handle with the panel's bounds.
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
          "rounded-full bg-[var(--system-greys-soft-grey,#3A3A3A)]",
          gripClass,
        )}
      />
    </div>
  )
}

interface DrawerContentProps
  extends Omit<
      React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>,
      "style"
    >,
    VariantProps<typeof drawerVariants> {
  /** Remove outer wrapper padding and panel rounded/border/padding so the
   *  panel attaches flush to the viewport edge. Use for full-height side
   *  panels (e.g. the embedded chat). */
  flush?: boolean
  /** Enable the drag-to-resize handle on the inside-facing edge. Only
   *  active for `side="left"` / `side="right"` (or `top`/`bottom`) on
   *  non-mobile viewports. */
  resizable?: boolean
  /** Minimum allowed size (px) when resizable. */
  minSize?: number
  /** Maximum allowed size (px) when resizable. Also clamped by viewport. */
  maxSize?: number
  /** Initial size (px) when no localStorage entry exists. */
  defaultSize?: number
  /** localStorage key for persisting the size across sessions. */
  storageKey?: string
  /** Pixel breakpoint below which `resizable` is disabled and inline
   *  size is not applied (so consumer CSS can render full-viewport).
   *  Defaults to 800 — the library's Tailwind `md` breakpoint, so the JS
   *  mobile switch and the `md:` panel styles flip together. */
  mobileBreakpoint?: number
  /** Optional className applied to the overlay. */
  overlayClassName?: string
  /** Optional aria-label for the resize handle. */
  resizeAriaLabel?: string
  /** Inline style merged onto the outer animated wrapper (DialogPrimitive.Content).
   *  Use this for animation-end transform/animation resets so `position: fixed`
   *  descendants can escape the wrapper's containing block. */
  style?: React.CSSProperties
  /** Inline style merged onto the inner panel (next to the resize-driven size). */
  panelStyle?: React.CSSProperties
  /** Optional className applied to the inner panel. (Alias for `className`.) */
  panelClassName?: string
  /** Offset the drawer's top edge below the app header + announcement bar.
   *  Measured live via ResizeObserver so it tracks height changes. */
  offsetHeader?: boolean
}

const DrawerContent = React.forwardRef<
  React.ComponentRef<typeof DialogPrimitive.Content>,
  DrawerContentProps
>(
  (
    {
      side = "right",
      flush = false,
      resizable = false,
      minSize = 320,
      maxSize = 1280,
      defaultSize,
      storageKey,
      mobileBreakpoint = 800,
      overlayClassName,
      resizeAriaLabel,
      className,
      style,
      panelStyle,
      panelClassName,
      offsetHeader = false,
      children,
      ...props
    },
    ref,
  ) => {
    const resolvedSide: DrawerSide = side ?? "right"
    const isHorizontal = HORIZONTAL_SIDES.has(resolvedSide)
    const initialSize = defaultSize ?? (isHorizontal ? 560 : 480)

    const headerHeight = useHeaderHeight()

    const [isMobile, setIsMobile] = React.useState(false)
    React.useEffect(() => {
      if (typeof window === "undefined") return
      const mq = window.matchMedia(`(max-width: ${mobileBreakpoint - 1}px)`)
      const update = () => setIsMobile(mq.matches)
      update()
      mq.addEventListener("change", update)
      return () => mq.removeEventListener("change", update)
    }, [mobileBreakpoint])

    const { size, setSize } = useResizableSize({
      enabled: resizable,
      isHorizontal,
      minSize,
      maxSize,
      defaultSize: initialSize,
      storageKey,
    })

    const applyInlineSize = resizable && !isMobile
    const sizeStyle: React.CSSProperties = applyInlineSize
      ? isHorizontal
        ? { width: size }
        : { height: size }
      : {}

    return (
      <DrawerPortal>
        <DrawerOverlay className={overlayClassName} />
        <DialogPrimitive.Content
          ref={ref}
          className={cn(drawerVariants({ side, flush }))}
          style={{ ...(offsetHeader ? { top: headerHeight } : {}), ...style }}
          {...props}
        >
          {/* Resize handle is a sibling of the panel — outside the panel's
              `overflow-hidden` so the drag track stays visible while the
              panel cleanly clips children to its rounded corners. */}
          {applyInlineSize ? (
            <DrawerResizeHandle
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
              drawerPanelVariants({ side, flush }),
              className,
              panelClassName,
            )}
            style={{ ...sizeStyle, ...panelStyle }}
          >
            {children}
          </div>
        </DialogPrimitive.Content>
      </DrawerPortal>
    )
  },
)
DrawerContent.displayName = "DrawerContent"

const DrawerHeader = ({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn("flex flex-col gap-4", className)}
    {...props}
  >
    {children}
  </div>
)
DrawerHeader.displayName = "DrawerHeader"

interface DrawerTitleProps
  extends React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title> {
  /** Optional header actions rendered between the title and the close button. */
  actions?: React.ReactNode
  /** Hide the close (X) button. */
  hideClose?: boolean
}

const DrawerTitle = React.forwardRef<
  React.ComponentRef<typeof DialogPrimitive.Title>,
  DrawerTitleProps
>(({ className, children, actions, hideClose, ...props }, ref) => (
  <div className="flex items-start gap-4">
    <DialogPrimitive.Title
      ref={ref}
      className={cn(
        "min-w-0 flex-1 break-words font-sans text-lg font-bold leading-6 tracking-[-0.36px] text-ods-text-primary",
        className
      )}
      {...props}
    >
      {children}
    </DialogPrimitive.Title>
    {actions}
    {!hideClose && (
      <DialogPrimitive.Close className="shrink-0 rounded-sm text-ods-text-secondary transition-colors hover:text-ods-text-primary outline-none ring-0 focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0">
        <X className="size-6" />
        <span className="sr-only">Close</span>
      </DialogPrimitive.Close>
    )}
  </div>
))
DrawerTitle.displayName = "DrawerTitle"

const DrawerDescription = React.forwardRef<
  React.ComponentRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn(
      "min-w-0 break-words font-sans text-sm font-medium leading-5 text-ods-text-secondary",
      className
    )}
    {...props}
  />
))
DrawerDescription.displayName = "DrawerDescription"

const DrawerBody = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn("flex flex-1 flex-col gap-4 overflow-y-auto", className)}
    {...props}
  />
)
DrawerBody.displayName = "DrawerBody"

const DrawerFooter = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn("mt-auto flex flex-col gap-2", className)}
    {...props}
  />
)
DrawerFooter.displayName = "DrawerFooter"

export {
  OVERLAY_BACKDROP_CLASS,
  Drawer,
  DrawerTrigger,
  DrawerClose,
  DrawerPortal,
  DrawerOverlay,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
  DrawerBody,
  DrawerFooter,
}

export type { DrawerContentProps, DrawerSide, DrawerTitleProps }
