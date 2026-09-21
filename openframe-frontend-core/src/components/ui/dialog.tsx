'use client';

import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { type ComponentPropsWithoutRef, type ElementRef, type HTMLAttributes, forwardRef } from 'react';

import { cn } from '../../utils/cn';

const Dialog = DialogPrimitive.Root;

const DialogTrigger = DialogPrimitive.Trigger;

const DialogPortal = DialogPrimitive.Portal;

const DialogClose = DialogPrimitive.Close;

const DialogOverlay = forwardRef<
  ElementRef<typeof DialogPrimitive.Overlay>,
  ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      'fixed inset-0 z-[9998] bg-ods-overlay backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
      className,
    )}
    {...props}
  />
));
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName;

const DialogContent = forwardRef<
  ElementRef<typeof DialogPrimitive.Content>,
  ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
>(({ className, children, ...props }, ref) => (
  <DialogPortal>
    <DialogOverlay />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        // Centered on the KEYBOARD-FREE area, not the layout viewport: nothing
        // resizes the viewport when a mobile software keyboard opens, so a
        // plain top-[50%] leaves the lower half of the dialog behind it. See
        // modal-v2.tsx for the full reasoning; --of-keyboard-inset is published
        // by the app (keyboard-inset.ts) and 0 everywhere else.
        //
        // The cap is on THIS box but the scrolling is not: the close button
        // below is `absolute` against it, so a scroll container here would
        // carry the X off the top. The wrapper around `children` scrolls
        // instead, and carries the section gap that used to sit here so
        // header/body/footer keep their spacing.
        //
        // `grid-rows-[minmax(0,1fr)]` is what makes the cap bite. An implicit
        // row track is `auto`-sized, so it grows to its content and overflows
        // the max-height no matter what min-height the wrapper carries —
        // measured at 1136px of rows inside an 843px box. Constraining the
        // track is what hands the wrapper a scrollbar; `1fr` still collapses to
        // max-content when the dialog is shorter than the cap, so short dialogs
        // keep hugging their content.
        'fixed left-[50%] top-[calc(50%_-_var(--of-keyboard-inset,0px)/2)] z-[9999] grid max-h-[calc(100dvh_-_var(--of-keyboard-inset,0px)_-_2rem)] w-full max-w-lg translate-x-[-50%] translate-y-[-50%] grid-rows-[minmax(0,1fr)] border bg-background p-6 shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-1/2 data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-1/2 md:rounded-lg',
        className,
      )}
      {...props}
    >
      {/* min-h-0 is load-bearing: a grid item defaults to min-height:auto and
          would refuse to shrink below its content, so the cap above would push
          past the viewport instead of handing this box a scrollbar. */}
      <div className="grid min-h-0 gap-[var(--spacing-system-mf)] overflow-y-auto">{children}</div>
      <DialogPrimitive.Close className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground">
        <X className="h-4 w-4" />
        <span className="sr-only">Close</span>
      </DialogPrimitive.Close>
    </DialogPrimitive.Content>
  </DialogPortal>
));
DialogContent.displayName = DialogPrimitive.Content.displayName;

const DialogHeader = ({ className, ...props }: HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('flex flex-col space-y-1.5 text-center md:text-left', className)} {...props} />
);
DialogHeader.displayName = 'DialogHeader';

const DialogFooter = ({ className, ...props }: HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('flex flex-col-reverse md:flex-row md:justify-end md:space-x-2', className)} {...props} />
);
DialogFooter.displayName = 'DialogFooter';

const DialogTitle = forwardRef<
  ElementRef<typeof DialogPrimitive.Title>,
  ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title ref={ref} className={cn('text-h3', className)} {...props} />
));
DialogTitle.displayName = DialogPrimitive.Title.displayName;

const DialogDescription = forwardRef<
  ElementRef<typeof DialogPrimitive.Description>,
  ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description ref={ref} className={cn('text-muted-foreground text-h6', className)} {...props} />
));
DialogDescription.displayName = DialogPrimitive.Description.displayName;

export {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogClose,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
};
