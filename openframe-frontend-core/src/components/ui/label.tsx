'use client';

import * as LabelPrimitive from '@radix-ui/react-label';
import { cva, type VariantProps } from 'class-variance-authority';
import { type ComponentPropsWithoutRef, type ElementRef, forwardRef } from 'react';

import { cn } from '../../utils/cn';

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
 * A CLICK-SURFACE (a field's adorned chrome, a checkbox/radio row, a slider's
 * caption row) is a `Label` too, with `variant="surface"`: the label element and
 * its control association, with NO typography of its own; the call site's
 * `className` draws the surface. Never a raw `<label>`.
 */
const LABEL_TEXT_CLASS = 'block text-ods-text-primary text-h6';

const labelVariants = cva('', {
  variants: {
    variant: {
      default: LABEL_TEXT_CLASS,
      /** @deprecated alias of `default` — the three small scales converged on text-h6. */
      small: LABEL_TEXT_CLASS,
      /** @deprecated alias of `default`. */
      medium: LABEL_TEXT_CLASS,
      large: cn(LABEL_TEXT_CLASS, 'text-h4'),
      /** A click surface that labels its control: no typography, the site's `className` is its look. */
      surface: '',
    },
    spacing: {
      none: '',
      tight: 'mb-0.5',
      normal: 'mb-2',
      loose: 'mb-3',
    },
  },
  defaultVariants: {
    variant: 'default',
    spacing: 'none',
  },
});

const Label = forwardRef<
  ElementRef<typeof LabelPrimitive.Root>,
  ComponentPropsWithoutRef<typeof LabelPrimitive.Root> & VariantProps<typeof labelVariants>
>(({ className, variant, spacing, ...props }, ref) => (
  <LabelPrimitive.Root ref={ref} className={cn(labelVariants({ variant, spacing }), className)} {...props} />
));
Label.displayName = LabelPrimitive.Root.displayName;

export { Label };
