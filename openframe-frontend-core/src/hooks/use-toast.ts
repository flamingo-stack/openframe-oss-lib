import { toast as sonnerToast } from 'sonner'

export interface ToastOptions {
  title?: string
  description?: string
  variant?: 'default' | 'success' | 'destructive' | 'info' | 'warning'
  duration?: number
}

export const toast = (options: ToastOptions | string) => {
  if (typeof options === 'string') {
    sonnerToast(options)
    return
  }

  const { title, description, variant = 'default', duration } = options

  const message = title || ''
  const opts = {
    description,
    duration,
  }

  switch (variant) {
    case 'success':
      sonnerToast.success(message, opts)
      break
    case 'destructive':
      sonnerToast.error(message, opts)
      break
    case 'info':
      sonnerToast.info(message, opts)
      break
    case 'warning':
      sonnerToast.warning(message, opts)
      break
    default:
      sonnerToast(message, opts)
  }
}

export const useToast = () => {
  return {
    toast,
    // Direct access to sonner methods if needed
    ...sonnerToast,
  }
}