'use client';

import * as SelectPrimitive from '@radix-ui/react-select';
import { ChevronDown, ChevronUp } from 'lucide-react';
import {
  type ComponentPropsWithoutRef,
  type ComponentRef,
  type ElementRef,
  forwardRef,
  type ReactNode,
  useEffect,
  useRef,
  useState,
} from 'react';
import { useIsomorphicLayoutEffect } from '../../hooks/ui/use-isomorphic-layout-effect';
import { useViewportCollisionPadding, withViewportPadding } from '../../hooks/ui/use-viewport-collision-padding';
import { cn } from '../../utils/cn';
import { Chevron02DownIcon } from '../icons-v2-generated/arrows/chevron-02-down-icon';
import { CheckIcon } from '../icons-v2-generated/signs-and-symbols/check-icon';
import { FieldValueSkeleton } from './field-value-skeleton';
import { FieldWrapper } from './field-wrapper';
import { useLoadingScope } from './loading-scope';
import { usePortalContainer } from './portal-container';

const Select = SelectPrimitive.Root;

const SelectGroup = SelectPrimitive.Group;

const SelectValue = SelectPrimitive.Value;

const SelectTrigger = forwardRef<
  ComponentRef<typeof SelectPrimitive.Trigger>,
  ComponentPropsWithoutRef<typeof SelectPrimitive.Trigger> & {
    invalid?: boolean;
    label?: string;
    /** Label scale forwarded to FieldWrapper ('large' = text-h4 for designs with body-scale field titles) */
    labelVariant?: 'default' | 'large';
    error?: string;
  }
>((allProps, ref) => {
  const { className, children, invalid, label, labelVariant, error, ...props } = allProps;
  // Wired for a message even while `error` is undefined — see `FieldWrapper.errorSlot`.
  const errorSlot = 'error' in allProps;
  const isInvalid = invalid || !!error;
  // ONE switch: in a page's loading state the trigger draws its box, its label and chevron for real, and its value
  // (or placeholder) as a bar.
  const inScope = useLoadingScope();

  const trigger = (
    <SelectPrimitive.Trigger
      ref={ref}
      data-invalid={isInvalid || undefined}
      className={cn(
        // Layout & spacing - match Input
        // text-left resets the <button> UA default text-align:center, which the
        // SelectValue span inherits and would otherwise center short values,
        // reading as spurious left indentation on the selected value.
        'flex h-11 w-full items-center justify-between gap-2 rounded-[6px] border px-3 text-left outline-none md:h-12',
        // Typography - match Input exactly
        'text-h4',
        // Theme palette - match Input exactly
        'border-ods-border bg-ods-card text-ods-text-primary data-[placeholder]:text-ods-text-secondary',
        'enabled:hover:border-ods-border-hover enabled:hover:bg-ods-bg-hover enabled:active:border-ods-border-active enabled:active:bg-ods-bg-active',
        !isInvalid && 'data-[state=open]:border-ods-accent data-[state=open]:hover:border-ods-accent',
        'group',
        // Disabled - match Input exactly: value greys out, placeholder dims
        // further. The `data-[placeholder]` rule above is a class+attribute
        // selector, so the disabled placeholder rule stacks `:disabled` on top
        // of it to win on specificity rather than on source order.
        'disabled:!cursor-not-allowed disabled:bg-ods-bg',
        'disabled:text-ods-text-disabled disabled:data-[placeholder]:text-ods-border',
        // The chevron sets its own colour — grey it with the value.
        '[&_svg]:disabled:text-ods-text-disabled',
        'cursor-pointer transition-colors duration-200',
        '[&>span]:line-clamp-1',
        isInvalid &&
          'border-ods-error enabled:hover:border-ods-error enabled:active:border-ods-error data-[state=open]:border-ods-error',
        className,
      )}
      {...props}
    >
      {inScope ? <FieldValueSkeleton /> : children}
      <SelectPrimitive.Icon asChild>
        <Chevron02DownIcon
          className={cn(
            'shrink-0 text-ods-text-secondary transition-all duration-200 group-data-[state=open]:rotate-180',
            isInvalid ? 'text-ods-error' : 'group-data-[state=open]:text-ods-accent',
          )}
          size={24}
        />
      </SelectPrimitive.Icon>
    </SelectPrimitive.Trigger>
  );

  return (
    <FieldWrapper label={label} labelVariant={labelVariant} error={error} errorSlot={errorSlot}>
      {trigger}
    </FieldWrapper>
  );
});
SelectTrigger.displayName = SelectPrimitive.Trigger.displayName;

const SelectScrollUpButton = forwardRef<
  ComponentRef<typeof SelectPrimitive.ScrollUpButton>,
  ComponentPropsWithoutRef<typeof SelectPrimitive.ScrollUpButton>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.ScrollUpButton
    ref={ref}
    className={cn('flex cursor-default items-center justify-center py-1', className)}
    {...props}
  >
    <ChevronUp className="h-4 w-4" />
  </SelectPrimitive.ScrollUpButton>
));
SelectScrollUpButton.displayName = SelectPrimitive.ScrollUpButton.displayName;

const SelectScrollDownButton = forwardRef<
  ComponentRef<typeof SelectPrimitive.ScrollDownButton>,
  ComponentPropsWithoutRef<typeof SelectPrimitive.ScrollDownButton>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.ScrollDownButton
    ref={ref}
    className={cn('flex cursor-default items-center justify-center py-1', className)}
    {...props}
  >
    <ChevronDown className="h-4 w-4" />
  </SelectPrimitive.ScrollDownButton>
));
SelectScrollDownButton.displayName = SelectPrimitive.ScrollDownButton.displayName;

interface ScrollEdges {
  readonly up: boolean;
  readonly down: boolean;
}

const NO_EDGES: ScrollEdges = { up: false, down: false };

/** Which ends of the list still have rows past them, kept current on scroll and whenever the list or its rows resize. */
function useScrollEdges(viewport: HTMLElement | null): ScrollEdges {
  const [edges, setEdges] = useState<ScrollEdges>(NO_EDGES);
  useIsomorphicLayoutEffect(() => {
    if (!viewport) return undefined;
    const measure = () => {
      const max = viewport.scrollHeight - viewport.clientHeight;
      const up = viewport.scrollTop > 0;
      // `ceil`: a zoomed page reports fractional scroll positions, and the end must still read as the end.
      const down = Math.ceil(viewport.scrollTop) < max;
      setEdges(previous => (previous.up === up && previous.down === down ? previous : { up, down }));
    };
    measure();
    viewport.addEventListener('scroll', measure, { passive: true });
    const resize = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
    resize?.observe(viewport);
    // Rows that arrive or leave change the scroll height without resizing the (capped) viewport.
    const rows = new MutationObserver(measure);
    rows.observe(viewport, { childList: true, subtree: true });
    return () => {
      viewport.removeEventListener('scroll', measure);
      resize?.disconnect();
      rows.disconnect();
    };
  }, [viewport]);
  return edges;
}

/** Auto-scroll period while the pointer rests on an arrow, as Radix's own arrows do. */
const AUTO_SCROLL_MS = 50;

/**
 * A scroll arrow drawn OVER the list's edge, never in its flow. Radix's own arrows took a row of their own: each time
 * one appeared or went, every row moved by its height against the scroll, and on mounting Radix scrolled the focused
 * row back into view, which pulled a list the user had just scrolled back to that row. These come and go with the
 * scroll position and move nothing. `z-10` because Radix positions the viewport (`position: relative`), which would
 * otherwise paint its rows over the up arrow; `bg-inherit` takes the list's background, so a row under an arrow stays
 * hidden behind it. Decorative for assistive tech: the list scrolls by keyboard on its own.
 */
function SelectScrollArrow({ direction, viewport }: { direction: 'up' | 'down'; viewport: HTMLElement | null }) {
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const stop = () => {
    if (timer.current === null) return;
    clearInterval(timer.current);
    timer.current = null;
  };
  const start = () => {
    if (timer.current !== null || !viewport) return;
    timer.current = setInterval(() => {
      const step = viewport.querySelector<HTMLElement>('[role="option"]')?.offsetHeight ?? 0;
      viewport.scrollBy(0, direction === 'up' ? -step : step);
    }, AUTO_SCROLL_MS);
  };
  useEffect(() => stop, []);
  return (
    <div
      aria-hidden
      data-select-scroll-arrow={direction}
      className={cn(
        'absolute inset-x-0 z-10 flex h-6 cursor-default items-center justify-center bg-inherit',
        direction === 'up' ? 'top-0' : 'bottom-0',
      )}
      onPointerDown={start}
      onPointerMove={start}
      onPointerLeave={stop}
    >
      {direction === 'up' ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
    </div>
  );
}

const SelectContent = forwardRef<
  ComponentRef<typeof SelectPrimitive.Content>,
  ComponentPropsWithoutRef<typeof SelectPrimitive.Content>
>(({ className, children, position = 'popper', collisionPadding, ...props }, ref) => {
  const container = usePortalContainer();
  const viewportPadding = useViewportCollisionPadding();
  const [viewport, setViewport] = useState<HTMLDivElement | null>(null);
  const edges = useScrollEdges(viewport);
  return (
    <SelectPrimitive.Portal container={container ?? undefined}>
      <SelectPrimitive.Content
        ref={ref}
        className={cn(
          // 24rem of ROWS: the 2px are the 1px border on each side, which border-box takes out of the height. Without
          // them a list of exactly 24rem (eight desktop rows) overflowed by 2px and grew scroll arrows over its last row.
          'relative z-[9999] max-h-[min(calc(24rem+2px),var(--radix-select-content-available-height,24rem))] overflow-hidden rounded-[4px] border border-ods-border bg-ods-card text-ods-text-primary',
          'data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2',
          className,
        )}
        position={position}
        // The gap as an offset Radix knows, not a translate: a translated list passed the collision padding by it.
        sideOffset={position === 'popper' ? 4 : undefined}
        // The mobile shell's status bar and keyboard are the viewport's edges (useViewportCollisionPadding).
        collisionPadding={withViewportPadding(collisionPadding, viewportPadding)}
        style={{
          width: 'var(--radix-select-trigger-width)',
          minWidth: 'var(--radix-select-trigger-width)',
        }}
        {...props}
      >
        {/* The scroll padding is the arrows' height: a row reached by keyboard is scrolled clear of an arrow, not under it. */}
        <SelectPrimitive.Viewport ref={setViewport} className="w-full scroll-py-6">
          {children}
        </SelectPrimitive.Viewport>
        {edges.up && <SelectScrollArrow direction="up" viewport={viewport} />}
        {edges.down && <SelectScrollArrow direction="down" viewport={viewport} />}
      </SelectPrimitive.Content>
    </SelectPrimitive.Portal>
  );
});
SelectContent.displayName = SelectPrimitive.Content.displayName;

const SelectLabel = forwardRef<
  ElementRef<typeof SelectPrimitive.Label>,
  ComponentPropsWithoutRef<typeof SelectPrimitive.Label>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.Label ref={ref} className={cn('py-1.5 pl-8 pr-2 font-semibold text-h6', className)} {...props} />
));
SelectLabel.displayName = SelectPrimitive.Label.displayName;

const SelectItem = forwardRef<
  ComponentRef<typeof SelectPrimitive.Item>,
  ComponentPropsWithoutRef<typeof SelectPrimitive.Item> & {
    /**
     * A second, secondary-coloured line under the label. The row grows to
     * fit it and both lines wrap, so a sentence longer than the list is read
     * in full instead of being clipped at the edge. It sits outside
     * `ItemText`, so the closed trigger mirrors the label alone and typeahead
     * matches the label alone.
     */
    description?: ReactNode;
  }
>(({ className, children, description, ...props }, ref) => (
  <SelectPrimitive.Item
    ref={ref}
    className={cn(
      'flex w-full cursor-pointer select-none items-center justify-between gap-2 border-b border-ods-border px-4 last:border-b-0',
      // Typography - match trigger
      'text-h4',
      description == null
        ? 'h-11 whitespace-nowrap md:h-12'
        : 'min-h-11 whitespace-normal py-[var(--spacing-system-xs)] md:min-h-12',
      // Hover state with visible background change
      'outline-none hover:bg-ods-bg-hover data-[highlighted]:bg-ods-bg-surface',
      'data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
      'transition-colors duration-150',
      className,
    )}
    {...props}
  >
    {description == null ? (
      <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
    ) : (
      // min-w-0 lets the column shrink below its longest line, which is what
      // makes the lines wrap instead of pushing past the list's edge.
      <span className="flex min-w-0 flex-col text-left">
        <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
        <span className="text-ods-text-secondary text-h6">{description}</span>
      </span>
    )}
    <SelectPrimitive.ItemIndicator className="shrink-0">
      <CheckIcon className="text-ods-accent" size={20} />
    </SelectPrimitive.ItemIndicator>
  </SelectPrimitive.Item>
));
SelectItem.displayName = SelectPrimitive.Item.displayName;

const SelectSeparator = forwardRef<
  ComponentRef<typeof SelectPrimitive.Separator>,
  ComponentPropsWithoutRef<typeof SelectPrimitive.Separator>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.Separator ref={ref} className={cn('-mx-1 my-1 h-px bg-ods-border', className)} {...props} />
));
SelectSeparator.displayName = SelectPrimitive.Separator.displayName;

export {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectScrollDownButton,
  SelectScrollUpButton,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
};
