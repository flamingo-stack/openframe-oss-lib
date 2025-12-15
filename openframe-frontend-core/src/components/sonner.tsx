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
          error: "group-[.toaster]:bg-red-950 group-[.toaster]:text-red-50 group-[.toaster]:border-red-900",
          success: "group-[.toaster]:bg-green-950 group-[.toaster]:text-green-50 group-[.toaster]:border-green-900",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
