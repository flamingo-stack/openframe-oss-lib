"use client"

import * as React from "react"
import * as TabsPrimitive from "@radix-ui/react-tabs"

import { cn } from "../../utils/cn"

/**
 * @deprecated Use `TabNavigation` from `components/ui/tab-navigation` — the
 * single canonical tab component (ODS tokens, URL-sync, overflow scroll
 * shadows). This Radix-based `Tabs` set (a duplicate of `components/tabs.tsx`)
 * styles itself with legacy shadcn tokens (`bg-muted`, `text-foreground`,
 * `ring-ring`) that don't exist in ODS and is kept only for un-migrated call
 * sites. Do not use in new code — EXCEPT `variant="admin-rail"`, the sanctioned
 * ODS underline-tab styling for admin config surfaces (see {@link TabsList}).
 */
const Tabs = TabsPrimitive.Root

export type TabsVariant = 'default' | 'admin-rail'

const TABS_LIST_BASE =
  "inline-flex h-10 items-center justify-center rounded-md bg-muted p-1 text-muted-foreground"

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
  'admin-rail': cn(TABS_LIST_BASE, 'inline-flex justify-start rounded-none bg-transparent h-auto p-0'),
}

const TABS_TRIGGER_BASE =
  "inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-h6 ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm"

const tabsTriggerVariantClasses: Record<TabsVariant, string> = {
  default: TABS_TRIGGER_BASE,
  'admin-rail': cn(
    TABS_TRIGGER_BASE,
    'rounded-none border-b-2 border-transparent',
    'data-[state=active]:border-ods-accent data-[state=active]:bg-transparent',
    'px-[var(--spacing-system-l)] py-[var(--spacing-system-sf)] text-h4 whitespace-nowrap',
    'text-ods-text-secondary data-[state=active]:text-ods-text-primary',
    'hover:text-ods-text-primary transition-colors',
    // Disabled tabs stay visible but inert.
    'disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:text-ods-text-secondary',
  ),
}

/** The bordered rail `admin-rail` lists sit on, scrollable when tabs overflow. */
const ADMIN_RAIL_WRAPPER_CLASS = 'w-full border-b border-ods-border overflow-x-auto'

interface TabsListProps
  extends React.ComponentPropsWithoutRef<typeof TabsPrimitive.List> {
  /**
   * `admin-rail` renders the ODS underline-tab list AND wraps it in the
   * bordered, horizontally-scrollable rail — no extra wrapper div needed at
   * the call site.
   */
  variant?: TabsVariant
}

/** @deprecated for `variant="default"` — use `TabNavigation`. `variant="admin-rail"` is the sanctioned admin tabs styling. See {@link Tabs}. */
const TabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  TabsListProps
>(({ className, variant = 'default', ...props }, ref) => {
  const list = (
    <TabsPrimitive.List
      ref={ref}
      className={cn(tabsListVariantClasses[variant], className)}
      {...props}
    />
  )
  if (variant === 'admin-rail') {
    return <div className={ADMIN_RAIL_WRAPPER_CLASS}>{list}</div>
  }
  return list
})
TabsList.displayName = TabsPrimitive.List.displayName

interface TabsTriggerProps
  extends React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger> {
  /** Match the `variant` set on the surrounding `TabsList`. */
  variant?: TabsVariant
}

/** @deprecated for `variant="default"` — use `TabNavigation`. `variant="admin-rail"` is the sanctioned admin tabs styling. See {@link Tabs}. */
const TabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  TabsTriggerProps
>(({ className, variant = 'default', ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    className={cn(tabsTriggerVariantClasses[variant], className)}
    {...props}
  />
))
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName

/** @deprecated Use `TabNavigation` from `components/ui/tab-navigation`. See {@link Tabs}. */
const TabsContent = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={cn(
      "mt-2 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
      className
    )}
    {...props}
  />
))
TabsContent.displayName = TabsPrimitive.Content.displayName

export { Tabs, TabsList, TabsTrigger, TabsContent }
