'use client'

import { Toaster as SonnerToaster } from 'sonner'

export function Toaster() {
  return (
    <SonnerToaster 
      position="bottom-right"
      toastOptions={{
        classNames: {
          toast: 'bg-ods-card border border-ods-border',
          title: 'text-ods-text-primary',
          description: 'text-ods-text-secondary',
          error: 'bg-red-500/10 border-red-500/20',
          success: 'bg-green-500/10 border-green-500/20',
          warning: 'bg-yellow-500/10 border-yellow-500/20',
          info: 'bg-blue-500/10 border-blue-500/20',
        },
      }}
    />
  )
}