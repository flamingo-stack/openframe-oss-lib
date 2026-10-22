'use client';

import * as TabsPrimitive from '@radix-ui/react-tabs';
import { type ComponentPropsWithoutRef, type ElementRef, forwardRef } from 'react';

import { cn } from '../../utils/cn';
import { TextLineSkeleton } from '../loading/unified-skeleton';
import { useLoadingScope } from './loading-scope';

/**
 * @deprecated Use `TabNavigation` from `components/ui/tab-navigation` — the
 * single canonical tab component (ODS tokens, URL-sync, overflow scroll
 * shadows). This Radix-based `Tabs` set (a duplicate of `components/tabs.tsx`)
 * styles itself with legacy shadcn tokens (`bg-muted`, `text-foreground`,
 * `ring-ring`) that don't exist in ODS and is kept only for un-migrated call
 * sites. Do not use in new code — EXCEPT `variant="admin-rail"`, the sanctioned
 * ODS underline-tab styling for admin config surfaces (see {@link TabsList}).
 */
const Tabs = TabsPrimitive.Root;

export type TabsVariant = 'default' | 'admin-rail';

const TABS_LIST_BASE = 'inline-flex h-10 items-center justify-center rounded-md bg-muted p-1 text-muted-foreground';

/**
 * The admin underline-tab styling, baked in as a variant so call sites never
 * stack these classes themselves: transparent list on a bordered, scrollable
 * rail; accent underline on the active trigger; secondary → primary text on
 * hover. Set `variant="admin-rail"` on BOTH `TabsList` and each `TabsTrigger`.
 */
const tabsListVariantClasses: Record<TabsVariant, string> = {
  default: TABS_LIST_BASE,
  // Applied ON TOP of the base (cn resolves the conflicts) so the variant
  // renders exactly what admin call sites produced by stacking these classes.
  'admin-rail': cn(TABS_LIST_BASE, 'inline-flex h-auto justify-start rounded-none bg-transparent p-0'),
};

const TABS_TRIGGER_BASE =
  'inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-h6 ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm';

const tabsTriggerVariantClasses: Record<TabsVariant, string> = {
  default: TABS_TRIGGER_BASE,
  'admin-rail': cn(
    TABS_TRIGGER_BASE,
    'rounded-none border-b-2 border-transparent',
    'data-[state=active]:border-ods-accent data-[state=active]:bg-transparent',
    'whitespace-nowrap px-[var(--spacing-system-l)] py-[var(--spacing-system-sf)] text-h4',
    'text-ods-text-secondary data-[state=active]:text-ods-text-primary',
    'transition-colors hover:text-ods-text-primary',
    // Disabled tabs stay visible but inert.
    'disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:text-ods-text-secondary',
  ),
};

/** The bordered rail `admin-rail` lists sit on, scrollable when tabs overflow. */
const ADMIN_RAIL_WRAPPER_CLASS = 'w-full border-b border-ods-border overflow-x-auto';

interface TabsListProps extends ComponentPropsWithoutRef<typeof TabsPrimitive.List> {
  /**
   * `admin-rail` renders the ODS underline-tab list AND wraps it in the
   * bordered, horizontally-scrollable rail — no extra wrapper div needed at
   * the call site.
   */
  variant?: TabsVariant;
}

/** @deprecated for `variant="default"` — use `TabNavigation`. `variant="admin-rail"` is the sanctioned admin tabs styling. See {@link Tabs}. */
const TabsList = forwardRef<ElementRef<typeof TabsPrimitive.List>, TabsListProps>(
  ({ className, variant = 'default', ...props }, ref) => {
    const list = <TabsPrimitive.List ref={ref} className={cn(tabsListVariantClasses[variant], className)} {...props} />;
    if (variant === 'admin-rail') {
      return <div className={ADMIN_RAIL_WRAPPER_CLASS}>{list}</div>;
    }
    return list;
  },
);
TabsList.displayName = TabsPrimitive.List.displayName;

interface TabsTriggerProps extends ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger> {
  /** Match the `variant` set on the surrounding `TabsList`. */
  variant?: TabsVariant;
}

/** @deprecated for `variant="default"` — use `TabNavigation`. `variant="admin-rail"` is the sanctioned admin tabs styling. See {@link Tabs}. */
const TabsTrigger = forwardRef<ElementRef<typeof TabsPrimitive.Trigger>, TabsTriggerProps>(
  ({ className, variant = 'default', ...props }, ref) => {
    // In a loading scope the tab is its skeleton: the trigger's own box; a tab named by a string (a tab name the page
    // states) keeps its name, any other label is a bar.
    if (useLoadingScope()) {
      const label = typeof props.children === 'string' && props.children !== '' ? props.children : undefined;
      return <TabsTriggerSkeleton variant={variant} label={label} className={className} />;
    }
    return <TabsPrimitive.Trigger ref={ref} className={cn(tabsTriggerVariantClasses[variant], className)} {...props} />;
  },
);
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName;

/** The label's type step per variant: the step its trigger's classes set. */
const TRIGGER_LABEL_TYPE: Record<TabsVariant, 'h4' | 'h6'> = { default: 'h6', 'admin-rail': 'h4' };

/**
 * A tab while it is read: the trigger's own box (padding, border, type step). `label` is a tab name the page states,
 * drawn as it is; without one the label is a bar.
 */
function TabsTriggerSkeleton({
  variant = 'default',
  label,
  className,
}: {
  variant?: TabsVariant;
  label?: string;
  className?: string;
}) {
  return (
    <div aria-hidden className={cn(tabsTriggerVariantClasses[variant], className)}>
      {label ?? <TextLineSkeleton type={TRIGGER_LABEL_TYPE[variant]} className="w-20" />}
    </div>
  );
}

/**
 * A tab list whose tabs are not known until a read: the list's own frame (the bordered rail for `admin-rail`) and
 * `count` trigger skeletons.
 */
function TabsListSkeleton({
  variant = 'default',
  count,
  labels,
  className,
}: {
  variant?: TabsVariant;
  /** How many tabs, when their names are read. */
  count?: number;
  /** The tabs' names, when the page states them (drawn as they are). */
  labels?: string[];
  className?: string;
}) {
  const tabs: Array<string | undefined> = labels ?? Array.from({ length: count ?? 0 }, () => undefined);
  const list = (
    <div aria-hidden className={cn(tabsListVariantClasses[variant], className)}>
      {tabs.map((label, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: skeleton tabs never reorder
        <TabsTriggerSkeleton key={i} variant={variant} label={label} />
      ))}
    </div>
  );
  return variant === 'admin-rail' ? <div className={ADMIN_RAIL_WRAPPER_CLASS}>{list}</div> : list;
}

/** @deprecated Use `TabNavigation` from `components/ui/tab-navigation`. See {@link Tabs}. */
const TabsContent = forwardRef<
  ElementRef<typeof TabsPrimitive.Content>,
  ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={cn(
      'mt-2 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
      className,
    )}
    {...props}
  />
));
TabsContent.displayName = TabsPrimitive.Content.displayName;

export { Tabs, TabsList, TabsTrigger, TabsContent };
