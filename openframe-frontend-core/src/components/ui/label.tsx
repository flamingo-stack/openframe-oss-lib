"use client"

import * as React from "react"
import * as LabelPrimitive from "@radix-ui/react-label"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "../../utils/cn"

/**
 * THE form label. One treatment, stated once:
 *
 *  - Scale + color live in the BASE (`text-h6 text-ods-text-primary`), so call
 *    sites never restate them — before this, ~100 call sites carried a
 *    `className="text-ods-text-primary"` override and ~115 cargo-culted
 *    `variant="small"` because the base under-specified.
 *  - NO margin. Layout belongs to the CONTAINER (`Field`'s gap, a `space-y-2`
 *    wrapper) — a margin inside a text primitive stacks with container gaps,
 *    which is exactly how `Field` rows ended up 12px label→control while the
 *    hand-rolled rows were 8px, and how labels sat 2px off their inline badges
 *    in `items-center` rows. Opt into `spacing` ONLY when the label truly has
 *    no spacing container.
 *
 * Raw `<label>` elements remain correct for CLICK-SURFACES (a field's adorned
 * chrome, checkbox/radio rows, upload dropzones) — those are interaction
 * wrappers, not text labels, and must not inherit this typography.
 */
const labelVariants = cva(
  "block text-h6 text-ods-text-primary",
  {
    variants: {
      variant: {
        default: "",
        /** @deprecated alias of `default` — the three small scales converged on text-h6. */
        small: "",
        /** @deprecated alias of `default`. */
        medium: "",
        large: "text-h4"
      },
      spacing: {
        none: "",
        tight: "mb-0.5",
        normal: "mb-2",
        loose: "mb-3"
      }
    },
    defaultVariants: {
      variant: "default",
      spacing: "none"
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
