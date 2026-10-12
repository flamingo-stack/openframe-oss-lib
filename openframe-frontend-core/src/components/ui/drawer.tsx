'use client';

import * as DialogPrimitive from '@radix-ui/react-dialog';
import { cva, type VariantProps } from 'class-variance-authority';
import { X } from 'lucide-react';
import {
  type CSSProperties,
  type ComponentPropsWithoutRef,
  type ComponentRef,
  type HTMLAttributes,
  type ReactNode,
  forwardRef,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';

import { ViewportBreakpoints } from '../../hooks/ui/use-content-breakpoint';
import { useHeaderHeight } from '../../hooks/ui/use-header-height';
import { type PanelDefaultSize, useResizablePanelSize } from '../../hooks/ui/use-resizable-panel-size';
import { cn } from '../../utils/cn';
import { PanelResizeHandle } from './panel-resize-handle';

/** Unified overlay backdrop — dimmed, no blur. Single source of truth for
 *  every full-screen backdrop (Drawer, AppLayoutDrawer, MobileBurgerMenu,
 *  TimeTracker popover) so all panels dim the page identically. */
const OVERLAY_BACKDROP_CLASS = 'bg-ods-overlay';

const Drawer = DialogPrimitive.Root;

const DrawerTrigger = DialogPrimitive.Trigger;

const DrawerClose = DialogPrimitive.Close;

const DrawerPortal = DialogPrimitive.Portal;

const DrawerOverlay = forwardRef<
  ComponentRef<typeof DialogPrimitive.Overlay>,
  ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      'fixed inset-0 z-[9997] outline-none focus:outline-none focus-visible:outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
      OVERLAY_BACKDROP_CLASS,
      className,
    )}
    {...props}
  />
));
DrawerOverlay.displayName = 'DrawerOverlay';

const drawerVariants = cva(
  'fixed z-[9998] flex outline-none focus:outline-none focus-visible:outline-none data-[state=closed]:duration-300 data-[state=open]:duration-300 data-[state=open]:animate-in data-[state=closed]:animate-out',
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
      { side: 'right', flush: false, class: 'py-4 pr-4' },
      { side: 'left', flush: false, class: 'py-4 pl-4' },
      { side: 'top', flush: false, class: 'px-4 pt-4' },
      { side: 'bottom', flush: false, class: 'px-4 pb-4' },
      // flush=true → same wrapper padding as default on desktop so the
      // panel floats with a uniform 16px gap; on mobile (< md) the
      // padding is dropped so the panel can be full-bleed.
      // `flush` controls panel chrome (rounded/border/inner-padding),
      // NOT wrapper positioning — those concerns are independent.
      { side: 'right', flush: true, class: 'md:py-4 md:pr-4' },
      { side: 'left', flush: true, class: 'md:py-4 md:pl-4' },
      { side: 'top', flush: true, class: 'md:px-4 md:pt-4' },
      { side: 'bottom', flush: true, class: 'md:px-4 md:pb-4' },
    ],
    defaultVariants: {
      side: 'right',
      flush: false,
    },
  },
);

const drawerPanelVariants = cva(
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
      /** Panel size along the axis the drawer slides on. `default` leaves it to
       *  the content (or `resizable`); `wide` is the admin detail panel, 90% of
       *  the viewport. Set the size here, never with a width class. */
      size: {
        default: '',
        wide: '',
      },
    },
    compoundVariants: [
      { side: 'right', size: 'wide', class: 'w-[90vw]' },
      { side: 'left', size: 'wide', class: 'w-[90vw]' },
      { side: 'top', size: 'wide', class: 'h-[90vh]' },
      { side: 'bottom', size: 'wide', class: 'h-[90vh]' },
      // flush=true → drops inner padding/gap so the consumer fully owns
      // internal layout, BUT preserves the card chrome (rounded + border)
      // on desktop so the panel still reads as an elevated card.
      // On mobile the panel is full-bleed → no rounded/border there.
      { side: 'right', flush: true, class: 'md:rounded-md md:border md:border-ods-border' },
      { side: 'left', flush: true, class: 'md:rounded-md md:border md:border-ods-border' },
      { side: 'top', flush: true, class: 'md:rounded-md md:border md:border-ods-border' },
      { side: 'bottom', flush: true, class: 'md:rounded-md md:border md:border-ods-border' },
    ],
    defaultVariants: {
      side: 'right',
      flush: false,
      size: 'default',
    },
  },
);

type DrawerSide = 'right' | 'left' | 'top' | 'bottom';

const HORIZONTAL_SIDES: ReadonlySet<DrawerSide> = new Set(['left', 'right']);

const subscribeToResize = (onChange: () => void) => {
  window.addEventListener('resize', onChange);
  return () => window.removeEventListener('resize', onChange);
};
const subscribeToNothing = () => () => {};
const noExtent = () => 0;

/** The viewport's extent along the resize axis, in px. 0 on the server and
 *  while `enabled` is false, when nothing listens for resizes at all. A change
 *  on the other axis (a phone's URL bar collapsing) re-renders nothing. */
function useViewportExtent(enabled: boolean, isHorizontal: boolean): number {
  return useSyncExternalStore(
    enabled ? subscribeToResize : subscribeToNothing,
    enabled ? (isHorizontal ? () => window.innerWidth : () => window.innerHeight) : noExtent,
    noExtent,
  );
}

interface DrawerContentBaseProps
  extends Omit<ComponentPropsWithoutRef<typeof DialogPrimitive.Content>, 'style'>, VariantProps<typeof drawerVariants> {
  /** Remove outer wrapper padding and panel rounded/border/padding so the
   *  panel attaches flush to the viewport edge. Use for full-height side
   *  panels (e.g. the embedded chat). */
  flush?: boolean;
  /** Minimum allowed size (px) when resizable. */
  minSize?: number;
  /** Maximum allowed size (px) when resizable. Also clamped by viewport. */
  maxSize?: number;
  /** Size (px) while the user has not resized the panel. Never stored. Pass a
   *  function of the viewport's extent (0 on the server) for a default that
   *  tracks the window. */
  defaultSize?: PanelDefaultSize;
  /** localStorage key for the size the user chose with the handle. Only that
   *  choice is stored; see `useResizablePanelSize`. */
  storageKey?: string;
  /** Pixel breakpoint below which `resizable` is disabled and inline
   *  size is not applied (so consumer CSS can render full-viewport).
   *  Defaults to 800 — the library's Tailwind `md` breakpoint, so the JS
   *  mobile switch and the `md:` panel styles flip together. */
  mobileBreakpoint?: number;
  /** Optional className applied to the overlay. */
  overlayClassName?: string;
  /** Optional aria-label for the resize handle. */
  resizeAriaLabel?: string;
  /** Inline style merged onto the outer animated wrapper (DialogPrimitive.Content).
   *  Use this for animation-end transform/animation resets so `position: fixed`
   *  descendants can escape the wrapper's containing block. */
  style?: CSSProperties;
  /** Inline style merged onto the inner panel (next to the resize-driven size). */
  panelStyle?: CSSProperties;
  /** Optional className applied to the inner panel. (Alias for `className`.) */
  panelClassName?: string;
  /** Offset the drawer's top edge below the app header + announcement bar.
   *  Measured live via ResizeObserver so it tracks height changes. */
  offsetHeader?: boolean;
}

/**
 * The panel's size has ONE owner: a `size` preset OR the drag-to-resize handle.
 * A resizable panel sizes itself inline, which would silently override `wide`,
 * so the two cannot be combined (a type error, not a runtime surprise).
 */
type DrawerContentSizing =
  | {
      /** Panel size preset (`wide` = 90% of the viewport). Use it instead of a
       *  width/height class. */
      size?: 'default' | 'wide';
      resizable?: false;
    }
  | {
      size?: 'default';
      /** Enable the drag-to-resize handle on the inside-facing edge. Only
       *  active for `side="left"` / `side="right"` (or `top`/`bottom`) on
       *  non-mobile viewports. The handle owns the size, so no `size` preset. */
      resizable: true;
    };

type DrawerContentProps = DrawerContentBaseProps & DrawerContentSizing;

const DrawerContent = forwardRef<ComponentRef<typeof DialogPrimitive.Content>, DrawerContentProps>(
  (
    {
      side = 'right',
      flush = false,
      size = 'default',
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
    const resolvedSide: DrawerSide = side ?? 'right';
    const isHorizontal = HORIZONTAL_SIDES.has(resolvedSide);
    const headerHeight = useHeaderHeight();

    const [isMobile, setIsMobile] = useState(false);
    useEffect(() => {
      if (typeof window === 'undefined') return undefined;
      const mq = window.matchMedia(`(max-width: ${mobileBreakpoint - 1}px)`);
      const update = () => setIsMobile(mq.matches);
      update();
      mq.addEventListener('change', update);
      return () => mq.removeEventListener('change', update);
    }, [mobileBreakpoint]);

    // The panel keeps 80px of the viewport free so the page behind it, and the
    // resize handle, stay reachable.
    const available = useViewportExtent(resizable, isHorizontal);
    const panelRef = useRef<HTMLDivElement>(null);
    const {
      size: resizedSize,
      setSize,
      clampSize,
    } = useResizablePanelSize({
      enabled: resizable,
      minSize,
      maxSize,
      defaultSize: defaultSize ?? (isHorizontal ? 560 : 480),
      available,
      reserve: 80,
      storageKey,
    });

    const applyInlineSize = resizable && !isMobile;
    const sizeStyle: CSSProperties = applyInlineSize
      ? isHorizontal
        ? { width: resizedSize }
        : { height: resizedSize }
      : {};

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
            <PanelResizeHandle
              variant="overlay"
              side={resolvedSide}
              size={resizedSize}
              minSize={minSize}
              maxSize={maxSize}
              onSize={setSize}
              clampSize={clampSize}
              panelRef={panelRef}
              ariaLabel={resizeAriaLabel}
            />
          ) : null}
          <div
            ref={panelRef}
            className={cn(drawerPanelVariants({ side, flush, size }), className, panelClassName)}
            style={{ ...sizeStyle, ...panelStyle }}
          >
            <ViewportBreakpoints>{children}</ViewportBreakpoints>
          </div>
        </DialogPrimitive.Content>
      </DrawerPortal>
    );
  },
);
DrawerContent.displayName = 'DrawerContent';

const DrawerHeader = ({ className, children, ...props }: HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('flex flex-col gap-4', className)} {...props}>
    {children}
  </div>
);
DrawerHeader.displayName = 'DrawerHeader';

interface DrawerTitleProps extends ComponentPropsWithoutRef<typeof DialogPrimitive.Title> {
  /** Optional header actions rendered between the title and the close button. */
  actions?: ReactNode;
  /** Hide the close (X) button. */
  hideClose?: boolean;
}

const DrawerTitle = forwardRef<ComponentRef<typeof DialogPrimitive.Title>, DrawerTitleProps>(
  ({ className, children, actions, hideClose, ...props }, ref) => (
    <div className="flex items-start gap-4">
      <DialogPrimitive.Title
        ref={ref}
        className={cn('min-w-0 flex-1 break-words text-ods-text-primary text-h3', className)}
        {...props}
      >
        {children}
      </DialogPrimitive.Title>
      {actions}
      {!hideClose && (
        <DialogPrimitive.Close className="shrink-0 rounded-sm text-ods-text-secondary outline-none ring-0 transition-colors hover:text-ods-text-primary focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0">
          <X className="size-6" />
          <span className="sr-only">Close</span>
        </DialogPrimitive.Close>
      )}
    </div>
  ),
);
DrawerTitle.displayName = 'DrawerTitle';

const DrawerDescription = forwardRef<
  ComponentRef<typeof DialogPrimitive.Description>,
  ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn('min-w-0 break-words text-ods-text-secondary text-h6', className)}
    {...props}
  />
));
DrawerDescription.displayName = 'DrawerDescription';

const DrawerBody = ({ className, ...props }: HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('flex flex-1 flex-col gap-4 overflow-y-auto', className)} {...props} />
);
DrawerBody.displayName = 'DrawerBody';

const DrawerFooter = ({ className, ...props }: HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('mt-auto flex flex-col gap-2', className)} {...props} />
);
DrawerFooter.displayName = 'DrawerFooter';

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
};

export type { DrawerContentProps, DrawerSide, DrawerTitleProps };
