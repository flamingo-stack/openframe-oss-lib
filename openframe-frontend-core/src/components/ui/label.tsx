"use client"

import * as React from "react"
import * as LabelPrimitive from "@radix-ui/react-label"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "../../utils/cn"

const labelVariants = cva(
  "block font-body font-medium text-ods-text-primary leading-6",
  {
    variants: {
      variant: {
        default: "text-[18px]",
        small: "text-[14px]",
        medium: "text-[16px]",
        large: "text-[20px]"
      },
      spacing: {
        default: "mb-1",
        tight: "mb-0.5",
        normal: "mb-2",
        loose: "mb-3"
      }
    },
    defaultVariants: {
      variant: "default",
      spacing: "default"
    }
  }
)

const Label = React.forwardRef<
  React.ElementRef<typeof LabelPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof LabelPrimitive.Root> & VariantProps<typeof labelVariants>
>(({ className, variant, spacing, ...props }, ref) => (
  <LabelPrimitive.Root 
    ref={ref} 
    className={cn(labelVariants({ variant, spacing }), className)} 
    {...props} 
  />
))
Label.displayName = LabelPrimitive.Root.displayName

export { Label }