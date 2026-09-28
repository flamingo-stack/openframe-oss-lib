import * as AccordionPrimitive from '@radix-ui/react-accordion';
import {
  type ComponentPropsWithoutRef,
  type ElementRef,
  type ReactNode,
  forwardRef,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import { cn } from '../utils/cn';
import { ChevronButton } from './ui/chevron-button';

// --- SmoothAccordion -----------------------------------------------------------------
// Wrapper that re-exports AccordionPrimitive.Root for convenience
export const SmoothAccordion = AccordionPrimitive.Root;

// --- SmoothAccordionItem --------------------------------------------------------------
export const SmoothAccordionItem = forwardRef<
  ElementRef<typeof AccordionPrimitive.Item>,
  ComponentPropsWithoutRef<typeof AccordionPrimitive.Item>
>(({ className, ...props }, ref) => (
  <AccordionPrimitive.Item ref={ref} className={cn('border-0', className)} {...props} />
));
SmoothAccordionItem.displayName = 'SmoothAccordionItem';

// --- SmoothAccordionTrigger -----------------------------------------------------------
interface SmoothAccordionTriggerProps extends ComponentPropsWithoutRef<typeof AccordionPrimitive.Trigger> {
  label: ReactNode;
  className?: string;
}

export const SmoothAccordionTrigger = forwardRef<HTMLButtonElement, SmoothAccordionTriggerProps>(
  ({ label, className, ...props }, ref) => (
    <AccordionPrimitive.Header className="flex">
      <AccordionPrimitive.Trigger
        ref={ref}
        className={cn(
          'group flex w-full items-center justify-between px-6 py-6 text-left transition-colors duration-200 ease-in-out hover:no-underline focus:outline-none md:px-8',
          className,
        )}
        {...props}
      >
        <span className="text-ods-text-primary text-h3">{label}</span>
        <ChevronButton
          size="md"
          isExpanded={false}
          backgroundColor="transparent"
          borderColor="var(--color-border-default)"
          className="transition-transform duration-300 ease-in-out group-data-[state=open]:rotate-180"
        />
      </AccordionPrimitive.Trigger>
    </AccordionPrimitive.Header>
  ),
);
SmoothAccordionTrigger.displayName = 'SmoothAccordionTrigger';

// --- SmoothAccordionContent -----------------------------------------------------------
// Uses dynamic height measurement with ResizeObserver for ultra-smooth animation.
export const SmoothAccordionContent = forwardRef<
  HTMLDivElement,
  // `data-state` is injected by Radix at render time, not declared on
  // `Content`'s own props — declare the one attribute this component reads.
  ComponentPropsWithoutRef<typeof AccordionPrimitive.Content> & { 'data-state'?: 'open' | 'closed' }
>(({ className, children, ...props }, ref) => {
  const [maxHeight, setMaxHeight] = useState<number>(0);
  const contentInnerRef = useRef<HTMLDivElement | null>(null);

  const composedRef = (node: HTMLDivElement) => {
    // Allow Radix to receive ref as well
    if (typeof ref === 'function') ref(node);
    else if (ref) ref.current = node;
    contentInnerRef.current = node;
  };

  const updateHeight = useCallback(() => {
    if (contentInnerRef.current) {
      setMaxHeight(contentInnerRef.current.scrollHeight);
    }
  }, []);

  useEffect(() => {
    updateHeight();
  }, [updateHeight, children]);

  // ResizeObserver for dynamic content
  useEffect(() => {
    if (!contentInnerRef.current) return undefined;
    const ro = new ResizeObserver(updateHeight);
    ro.observe(contentInnerRef.current);
    return () => ro.disconnect();
  }, [updateHeight]);

  const isOpen = props['data-state'] === 'open';

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
