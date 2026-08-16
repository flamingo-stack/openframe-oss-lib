"use client"

import * as React from "react"
import * as LabelPrimitive from "@radix-ui/react-label"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "../../utils/cn"

const labelVariants = cva(
  "block text-ods-text-primary",
  {
    variants: {
      variant: {
        // default is text-h6, matching `Field`'s label (Label variant="small")
        // and FieldWrapper — every bare <Label> is a form label, and the three
        // primitives must agree on ONE label scale. Use variant="large" for an
        // intentionally bigger label.
        default: "text-h6",
        small: "text-h6",
        medium: "text-h6",
        large: "text-h4"
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