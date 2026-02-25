"use client"

import * as React from "react"
import * as DialogPrimitive from "@radix-ui/react-dialog"
import { cva, type VariantProps } from "class-variance-authority"
import { X } from "lucide-react"

import { cn } from "../../utils/cn"

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
      "fixed inset-0 z-[9997] bg-black/50 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
      className
    )}
    {...props}
  />
))
DrawerOverlay.displayName = "DrawerOverlay"

const drawerVariants = cva(
  "fixed z-[9998] flex data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:duration-300 data-[state=open]:duration-300",
  {
    variants: {
      side: {
        right:
          "inset-y-0 right-0 items-center pr-4 py-4 data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right",
        left:
          "inset-y-0 left-0 items-center pl-4 py-4 data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left",
        top:
          "inset-x-0 top-0 justify-center pt-4 px-4 data-[state=closed]:slide-out-to-top data-[state=open]:slide-in-from-top",
        bottom:
          "inset-x-0 bottom-0 justify-center pb-4 px-4 data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom",
      },
    },
    defaultVariants: {
      side: "right",
    },
  }
)

const drawerPanelVariants = cva(
  "flex flex-col gap-4 rounded-md border border-ods-border bg-ods-card p-4",
  {
    variants: {
      side: {
        right: "h-full",
        left: "h-full",
        top: "w-full",
        bottom: "w-full",
      },
    },
    defaultVariants: {
      side: "right",
    },
  }
)

type DrawerSide = "right" | "left" | "top" | "bottom"

interface DrawerContentProps
  extends React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>,
    VariantProps<typeof drawerVariants> {}

const DrawerContent = React.forwardRef<
  React.ComponentRef<typeof DialogPrimitive.Content>,
  DrawerContentProps
>(({ side = "right", className, children, ...props }, ref) => (
  <DrawerPortal>
    <DrawerOverlay />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(drawerVariants({ side }))}
      {...props}
    >
      <div className={cn(drawerPanelVariants({ side }), className)}>
        {children}
      </div>
    </DialogPrimitive.Content>
  </DrawerPortal>
))
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

const DrawerTitle = React.forwardRef<
  React.ComponentRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, children, ...props }, ref) => (
  <div className="flex items-start gap-4">
    <DialogPrimitive.Title
      ref={ref}
      className={cn(
        "flex-1 font-sans text-lg font-bold leading-6 tracking-[-0.36px] text-ods-text-primary",
        className
      )}
      {...props}
    >
      {children}
    </DialogPrimitive.Title>
    <DialogPrimitive.Close className="shrink-0 rounded-sm text-ods-text-secondary transition-colors hover:text-ods-text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-ods-focus focus-visible:ring-offset-2 focus-visible:ring-offset-ods-card">
      <X className="size-6" />
      <span className="sr-only">Close</span>
    </DialogPrimitive.Close>
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
      "font-sans text-sm font-medium leading-5 text-ods-text-secondary",
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

export type { DrawerContentProps, DrawerSide }
