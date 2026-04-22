import { toast as sonnerToast } from 'sonner'
import { showToast, type ToastVariant } from '../components/ui/toaster'

export interface ToastOptions {
  title?: string
  description?: string
  variant?: 'default' | 'success' | 'destructive' | 'info' | 'warning' | 'error'
  duration?: number
  dismissible?: boolean
}

const normalizeVariant = (variant: ToastOptions['variant']): ToastVariant => {
  if (variant === 'destructive') return 'error'
  if (!variant) return 'default'
  return variant
}

export const toast = (options: ToastOptions | string) => {
  if (typeof options === 'string') {
    return showToast({ title: options })
  }

  const { title, description, variant, duration, dismissible } = options
  return showToast({
    title,
    description,
    variant: normalizeVariant(variant),
    duration,
    dismissible,
  })
}

export const useToast = () => ({
  toast,
  dismiss: sonnerToast.dismiss,
  promise: sonnerToast.promise,
})
