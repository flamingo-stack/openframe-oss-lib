'use client';

import {
  useFloating,
  autoUpdate,
  offset,
  flip,
  shift,
  size,
  useDismiss,
  useRole,
  useInteractions,
  FloatingPortal,
  useHover,
  safePolygon,
  arrow,
} from '@floating-ui/react';
import { type ReactNode, useMemo, useState } from 'react';
import { cn } from '../../utils/cn';

interface FloatingTooltipProps {
  content: ReactNode;
  children: ReactNode;
  side?: 'top' | 'right' | 'bottom' | 'left';
  className?: string;
  delayDuration?: number;
  /** Disable the tooltip without unmounting the trigger wrapper. */
  disabled?: boolean;
  /**
   * Classes for the trigger wrapper — the element this component puts around
   * `children` to anchor the tooltip. That element becomes the flex/grid item in
   * the caller's layout, so anything the child needed there (`min-w-0`, `flex-1`)
   * must move onto it. Omit it and the wrapper carries no class, exactly as before.
   */
  triggerClassName?: string;
  /**
   * Trigger wrapper element. Default `'div'`. Use `'span'` where a block element
   * is invalid HTML — inside a `<p>`, a heading, or another `<span>`.
   */
  as?: 'div' | 'span';
}

// Parse colored text markup like [YELLOW]text[/YELLOW] into JSX
function parseColoredText(text: string): ReactNode {
  if (typeof text !== 'string') return text;

  const parts: ReactNode[] = [];
  let lastIndex = 0;

  // Regex to match [COLOR]text[/COLOR] patterns
  const colorRegex = /\[([A-Z]+)\](.*?)\[\/\1\]/g;
  let match;
  let keyIndex = 0;

  while ((match = colorRegex.exec(text)) !== null) {
    // Add text before the colored part
    if (match.index > lastIndex) {
      const beforeText = text.slice(lastIndex, match.index);
      parts.push(<span key={`text-${keyIndex++}`}>{beforeText}</span>);
    }

    // Add colored text
    const color = match[1].toLowerCase();
    const coloredText = match[2];

    // Map colors to ODS CSS classes using correct Tailwind class names
    const colorClass =
      color === 'yellow'
        ? 'text-ods-accent'
        : color === 'green'
          ? 'text-ods-success'
          : color === 'red'
            ? 'text-ods-error'
            : color === 'blue'
              ? 'text-ods-info'
              : color === 'pink'
                ? 'text-ods-accent'
                : color === 'cyan'
                  ? 'text-ods-info'
                  : 'text-ods-accent'; // Default to ODS accent

    parts.push(
      <span key={`color-${keyIndex++}`} className={cn('font-semibold', colorClass)}>
        {coloredText}
      </span>,
    );

    lastIndex = match.index + match[0].length;
  }

  // Add remaining text
  if (lastIndex < text.length) {
    const remainingText = text.slice(lastIndex);
    parts.push(<span key={`text-${keyIndex++}`}>{remainingText}</span>);
  }

  return parts.length > 0 ? <>{parts}</> : text;
}

export function FloatingTooltip({
  content,
  children,
  side = 'right',
  className,
  delayDuration = 0,
  disabled = false,
  triggerClassName,
  as: TriggerTag = 'div',
}: FloatingTooltipProps) {
  const [isOpen, setIsOpen] = useState(false);
  // The arrow node is STATE, not a ref: `arrow()`'s `element` accepts either,
  // and the ref form has to be read during render to build the middleware
  // array. State also makes the middleware re-run the moment the arrow mounts
  // instead of relying on the next positioning pass to notice it.
  const [arrowEl, setArrowEl] = useState<HTMLDivElement | null>(null);

  const { refs, floatingStyles, context, placement, middlewareData } = useFloating({
    open: isOpen,
    onOpenChange: setIsOpen,
    placement: side,
    middleware: [
      offset(12),
      flip({
        fallbackAxisSideDirection: 'start',
        crossAxis: false,
        padding: 8,
      }),
      shift({ padding: 8 }),
      // Cap the tooltip to the space left in the viewport so tall content
      // scrolls inside it instead of overflowing off-screen. Applied straight to
      // the floating node's style (no React state → no autoUpdate re-render loop);
      // the inner scroll wrapper below turns the cap into an actual scroll area.
      size({
        padding: 8,
        apply({ availableHeight, elements }) {
          const floatingEl = elements.floating;
          floatingEl.style.maxHeight = `${Math.max(64, availableHeight)}px`;
        },
      }),
      arrow({ element: arrowEl }),
    ],
    whileElementsMounted: autoUpdate,
  });

  const hover = useHover(context, {
    move: false,
    enabled: !disabled,
    delay: { open: delayDuration, close: 0 },
    handleClose: safePolygon(),
  });
  const dismiss = useDismiss(context);
  const role = useRole(context, { role: 'tooltip' });

  const { getReferenceProps, getFloatingProps } = useInteractions([hover, dismiss, role]);

  // Destructured once: reaching for `refs.setFloating` inside the JSX is a
  // property read on floating-ui's ref bag on every render, which the compiler
  // reads as touching a ref in render even though these are plain callback
  // setters being handed straight to React.
  const { setReference, setFloating } = refs;

  // Parse content if it's a string with color markup
  const parsedContent = useMemo(() => {
    if (typeof content === 'string') {
      return parseColoredText(content);
    }
    return content;
  }, [content]);

  // Calculate arrow position
  const { x: arrowX, y: arrowY } = middlewareData.arrow ?? {};

  const staticSide = {
    top: 'bottom',
    right: 'left',
    bottom: 'top',
    left: 'right',
  }[placement.split('-')[0]];

  return (
    <>
      <TriggerTag ref={setReference} className={triggerClassName} {...getReferenceProps()}>
        {children}
      </TriggerTag>
      <FloatingPortal>
        {isOpen && (
          <div
            ref={setFloating}
            style={{
              ...floatingStyles,
              zIndex: 2147483647,
            }}
            {...getFloatingProps()}
            className={cn(
              // ODS Design System tooltip styling. `flex flex-col` + `overflow-hidden`
              // let the inner wrapper own the scroll while the rounded corners clip it.
              'flex max-w-xs flex-col overflow-hidden rounded-md',
              'border border-ods-border bg-ods-card',
              // ODS shadows for proper elevation
              'shadow-[var(--shadow-md)]',
              className,
            )}
          >
            {/* Scroll wrapper — `min-h-0` lets it shrink below content height inside
                the max-height cap set by the `size` middleware, so tall content scrolls. */}
            <div className="min-h-0 overflow-y-auto whitespace-pre-line px-3 py-2.5 text-ods-text-primary text-h6">
              {parsedContent}
            </div>
            {/* Arrow element */}
            <div
              ref={setArrowEl}
              style={{
                left: arrowX != null ? `${arrowX}px` : '',
                top: arrowY != null ? `${arrowY}px` : '',
                ...(staticSide && { [staticSide]: '-4px' }),
              }}
              className={cn('absolute h-2 w-2 rotate-45', 'border-ods-border bg-ods-card', {
                'border-b border-r': staticSide === 'left',
                'border-r border-t': staticSide === 'bottom',
                // `right` and `top` were separate keys spelling the same two
                // classes in different order ('border-l border-b' vs
                // 'border-b border-l'); sorting collapsed them into a duplicate
                // key, which would have dropped the `right` branch entirely.
                // Merged to keep the emitted CSS identical to before.
                // NOTE: that both sides ever wanted the same border pair looks
                // like a latent bug — worth a designer's eye. (2026-08-24)
                'border-b border-l': staticSide === 'right' || staticSide === 'top',
              })}
            />
          </div>
        )}
      </FloatingPortal>
    </>
  );
}
