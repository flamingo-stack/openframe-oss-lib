"use client"

import { Toaster as Sonner } from "sonner"

type ToasterProps = React.ComponentProps<typeof Sonner>

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      theme="dark"
      position="bottom-right"
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-ods-background-secondary group-[.toaster]:text-ods-text-primary group-[.toaster]:border-ods-border group-[.toaster]:shadow-lg",
          description: "group-[.toast]:text-ods-text-secondary",
          actionButton:
            "group-[.toast]:bg-ods-accent group-[.toast]:text-ods-text-inverted",
          cancelButton:
            "group-[.toast]:bg-ods-background-tertiary group-[.toast]:text-ods-text-secondary",
          error: "group-[.toaster]:bg-ods-error-secondary group-[.toaster]:text-ods-text-primary group-[.toaster]:border-ods-error",
          success: "group-[.toaster]:bg-ods-success-secondary group-[.toaster]:text-ods-text-primary group-[.toaster]:border-ods-success",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
