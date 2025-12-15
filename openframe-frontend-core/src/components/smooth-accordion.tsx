import * as React from 'react';
import * as AccordionPrimitive from '@radix-ui/react-accordion';
import { ChevronButton } from './ui/chevron-button';
import { cn } from "../utils/cn";

// --- SmoothAccordion -----------------------------------------------------------------
// Wrapper that re-exports AccordionPrimitive.Root for convenience
export const SmoothAccordion = AccordionPrimitive.Root;

// --- SmoothAccordionItem --------------------------------------------------------------
export const SmoothAccordionItem = React.forwardRef<
  React.ElementRef<typeof AccordionPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof AccordionPrimitive.Item>
>(({ className, ...props }, ref) => (
  <AccordionPrimitive.Item
    ref={ref}
    className={cn('border-0', className)}
    {...props}
  />
));
SmoothAccordionItem.displayName = 'SmoothAccordionItem';

// --- SmoothAccordionTrigger -----------------------------------------------------------
interface SmoothAccordionTriggerProps
  extends React.ComponentPropsWithoutRef<typeof AccordionPrimitive.Trigger> {
  label: React.ReactNode;
  className?: string;
}

export const SmoothAccordionTrigger = React.forwardRef<
  HTMLButtonElement,
  SmoothAccordionTriggerProps
>(({ label, className, ...props }, ref) => (
  <AccordionPrimitive.Header className="flex">
    <AccordionPrimitive.Trigger
      ref={ref}
      className={cn(
        'group flex w-full items-center justify-between px-6 md:px-8 py-6 text-left hover:no-underline focus:outline-none transition-colors duration-200 ease-in-out',
        className,
      )}
      {...props}
    >
      <span className="font-['DM_Sans'] font-bold text-[18px] leading-6 text-ods-text-primary">
        {label}
      </span>
      <ChevronButton
        size="md"
        isExpanded={false}
        backgroundColor="transparent"
        borderColor="#3A3A3A"
        className="transition-transform duration-300 ease-in-out group-data-[state=open]:rotate-180"
      />
    </AccordionPrimitive.Trigger>
  </AccordionPrimitive.Header>
));
SmoothAccordionTrigger.displayName = 'SmoothAccordionTrigger';

// --- SmoothAccordionContent -----------------------------------------------------------
// Uses dynamic height measurement with ResizeObserver for ultra-smooth animation.
export const SmoothAccordionContent = React.forwardRef<
  HTMLDivElement,
  React.ComponentPropsWithoutRef<typeof AccordionPrimitive.Content>
>(({ className, children, ...props }, ref) => {
  const [maxHeight, setMaxHeight] = React.useState<number>(0);
  const contentInnerRef = React.useRef<HTMLDivElement | null>(null);

  const composedRef = (node: HTMLDivElement) => {
    // Allow Radix to receive ref as well
    if (typeof ref === 'function') ref(node);
    else if (ref) (ref as React.MutableRefObject<HTMLDivElement | null>).current = node;
    contentInnerRef.current = node;
  };

  const updateHeight = React.useCallback(() => {
    if (contentInnerRef.current) {
      setMaxHeight(contentInnerRef.current.scrollHeight);
    }
  }, []);

  React.useEffect(() => {
    updateHeight();
  }, [updateHeight, children]);

  // ResizeObserver for dynamic content
  React.useEffect(() => {
    if (!contentInnerRef.current) return;
    const ro = new ResizeObserver(updateHeight);
    ro.observe(contentInnerRef.current);
    return () => ro.disconnect();
  }, [updateHeight]);

  const isOpen = (props as any)["data-state"] === "open";

  return (
    <AccordionPrimitive.Content
      ref={composedRef}
      // Radix provides data-state attribute for open/closed
      className={cn('overflow-hidden', className)}
      style={{
        transition: 'max-height 0.35s ease-in-out, opacity 0.35s ease-in-out',
        maxHeight: isOpen ? `${maxHeight}px` : '0px',
        opacity: isOpen ? 1 : 0,
      }}
      {...props}
      onTransitionEnd={() => {
        // After closing, reset maxHeight to avoid lingering space
        if (!isOpen) {
          setMaxHeight(0);
        }
      }}
    >
      <div
        // inner wrapper used for measurement
        style={{
          opacity: 1,
          paddingBottom: '0.75rem', // keep default styling to match existing
        }}
      >
        {children}
      </div>
    </AccordionPrimitive.Content>
  );
});
SmoothAccordionContent.displayName = 'SmoothAccordionContent'; 