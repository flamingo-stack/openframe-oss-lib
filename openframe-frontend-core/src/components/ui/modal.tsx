"use client"

import * as React from "react"
import { useEffect } from "react"
import { cn } from "../../utils/cn"

interface ModalProps {
  isOpen: boolean
  onClose: () => void
  children: React.ReactNode
  className?: string
}

interface ModalContentProps {
  children: React.ReactNode
  className?: string
}

interface ModalHeaderProps {
  children: React.ReactNode
  className?: string
}

interface ModalTitleProps {
  children: React.ReactNode
  className?: string
}

interface ModalFooterProps {
  children: React.ReactNode
  className?: string
}

/** @deprecated Use ModalV2 from './modal-v2' instead. */
const Modal = React.forwardRef<HTMLDivElement, ModalProps>(
  ({ isOpen, onClose, children, className }, ref) => {
    // Handle Escape key and scroll blocking
    useEffect(() => {
      const handleKeyDown = (event: KeyboardEvent) => {
        if (event.key === 'Escape') {
          onClose()
        }
      }

      if (isOpen) {
        // Block background scrolling
        document.body.style.overflow = 'hidden'
        document.addEventListener('keydown', handleKeyDown)
        
        return () => {
          // Restore scrolling
          document.body.style.overflow = 'unset'
          document.removeEventListener('keydown', handleKeyDown)
        }
      }
    }, [isOpen, onClose])

    if (!isOpen) return null

    return (
      <div className="fixed inset-0 z-[1300] flex items-center justify-center">
        <div 
          className="absolute inset-0 bg-black/50" 
          onClick={onClose}
          aria-hidden="true"
        />
        <div 
          ref={ref}
          className={cn(
            "relative z-10 w-full max-w-md mx-4 max-h-[90vh] flex flex-col overflow-hidden bg-ods-card border border-ods-border rounded-lg shadow-xl",
            className
          )}
          role="dialog"
          aria-modal="true"
        >
          {children}
        </div>
      </div>
    )
  }
)
Modal.displayName = "Modal"

/** @deprecated Use ModalV2Content from './modal-v2' instead. */
const ModalContent = React.forwardRef<HTMLDivElement, ModalContentProps>(
  ({ children, className }, ref) => (
    <div ref={ref} className={cn("overflow-y-auto min-h-0 flex-1", className)}>
      {children}
    </div>
  )
)
ModalContent.displayName = "ModalContent"

/** @deprecated Use ModalV2Header from './modal-v2' instead. */
const ModalHeader = React.forwardRef<HTMLDivElement, ModalHeaderProps>(
  ({ children, className }, ref) => (
    <div 
      ref={ref} 
      className={cn("px-6 py-4 border-b border-ods-border shrink-0", className)}
    >
      {children}
    </div>
  )
)
ModalHeader.displayName = "ModalHeader"

/** @deprecated Use ModalV2Title from './modal-v2' instead. */
const ModalTitle = React.forwardRef<HTMLHeadingElement, ModalTitleProps>(
  ({ children, className }, ref) => (
    <h2 
      ref={ref}
      className={cn("text-ods-text-primary font-semibold", className)}
    >
      {children}
    </h2>
  )
)
ModalTitle.displayName = "ModalTitle"

/** @deprecated Use ModalV2Footer from './modal-v2' instead. */
const ModalFooter = React.forwardRef<HTMLDivElement, ModalFooterProps>(
  ({ children, className }, ref) => (
    <div 
      ref={ref}
      className={cn("px-6 py-4 flex justify-end gap-3 shrink-0", className)}
    >
      {children}
    </div>
  )
)
ModalFooter.displayName = "ModalFooter"

export {
  Modal,
  ModalContent, 
  ModalFooter, 
  ModalHeader,
  ModalTitle
}
