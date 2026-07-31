"use client"

import React from 'react'
import { AlertTriangle, RefreshCw, Home } from 'lucide-react'
import { Button } from './button'
import { cn } from '../../utils/cn'

interface ErrorStateProps {
  title?: string
  message: string
  variant?: 'error' | 'warning' | 'info'
  showIcon?: boolean
  showRetry?: boolean
  showHome?: boolean
  onRetry?: () => void
  onHome?: () => void
  className?: string
  containerClassName?: string
}

export function ErrorState({
  title = 'Error',
  message,
  variant = 'error',
  showIcon = true,
  showRetry = false,
  showHome = false,
  onRetry,
  onHome,
  className,
  containerClassName
}: ErrorStateProps) {
  const getVariantStyles = () => {
    switch (variant) {
      case 'error':
        return {
          // -secondary tokens, NOT `/20` alpha modifiers: the ods colors are
          // hex CSS vars, and Tailwind 3.x can't inject alpha into those —
          // the modifier silently produced no background at all.
          bg: 'bg-ods-error-secondary',
          border: 'border-ods-error',
          text: 'text-ods-error',
          icon: 'text-ods-error'
        }
      case 'warning':
        return {
          bg: 'bg-ods-warning-secondary',
          border: 'border-ods-warning',
          text: 'text-ods-warning',
          icon: 'text-ods-warning'
        }
      case 'info':
        return {
          bg: 'bg-ods-bg-surface',
          border: 'border-ods-border',
          text: 'text-ods-text-secondary',
          icon: 'text-ods-text-secondary'
        }
    }
  }

  const styles = getVariantStyles()

  return (
    <div className={cn("p-6", containerClassName)}>
      <div className={cn(
        "rounded-lg p-4 border",
        styles.bg,
        styles.border,
        className
      )}>
        <div className="flex items-start gap-3">
          {showIcon && (
            <AlertTriangle className={cn("h-5 w-5 mt-0.5 flex-shrink-0", styles.icon)} />
          )}
          <div className="flex-1">
            <h3 className={cn("font-semibold mb-1", styles.text)}>
              {title}
            </h3>
            <p className={cn("text-h6", styles.text)}>
              {message}
            </p>
            {(showRetry || showHome) && (
              <div className="flex gap-2 mt-3">
                {showRetry && onRetry && (
                  <Button
                    onClick={onRetry}
                    variant="outline"
                    size="small-legacy"
                    className="h-8"
                    leftIcon={<RefreshCw className="h-4 w-4" />}
                  >
                    Try Again
                  </Button>
                )}
                {showHome && onHome && (
                  <Button
                    onClick={onHome}
                    variant="outline"
                    size="small-legacy"
                    className="h-8"
                    leftIcon={<Home className="h-4 w-4" />}
                  >
                    Go Home
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// Convenience components for common error scenarios
export function PageError({ message, onRetry, onHome }: { message: string; onRetry?: () => void; onHome?: () => void }) {
  return (
    <ErrorState
      title="Page Error"
      message={message}
      variant="error"
      showRetry={!!onRetry}
      showHome={!!onHome}
      onRetry={onRetry}
      onHome={onHome}
    />
  )
}

export function LoadError({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <ErrorState
      title="Loading Error"
      message={message}
      variant="error"
      showRetry={!!onRetry}
      onRetry={onRetry}
    />
  )
}

export function NotFoundError({ message = "The requested item was not found", onHome }: { message?: string; onHome?: () => void }) {
  return (
    <ErrorState
      title="Not Found"
      message={message}
      variant="warning"
      showHome={!!onHome}
      onHome={onHome}
    />
  )
}