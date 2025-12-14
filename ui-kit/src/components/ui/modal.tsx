"use client"

import * as React from "react"
import { useEffect } from "react"
import { X } from "lucide-react"
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
            "relative z-10 w-full max-w-md mx-4 bg-ods-card border border-ods-border rounded-lg shadow-xl",
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

const ModalContent = React.forwardRef<HTMLDivElement, ModalContentProps>(
  ({ children, className }, ref) => (
    <div ref={ref} className={cn("", className)}>
      {children}
    </div>
  )
)
ModalContent.displayName = "ModalContent"

const ModalHeader = React.forwardRef<HTMLDivElement, ModalHeaderProps>(
  ({ children, className }, ref) => (
    <div 
      ref={ref} 
      className={cn("px-6 py-4 border-b border-ods-border", className)}
    >
      {children}
    </div>
  )
)
ModalHeader.displayName = "ModalHeader"

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

const ModalFooter = React.forwardRef<HTMLDivElement, ModalFooterProps>(
  ({ children, className }, ref) => (
    <div 
      ref={ref}
      className={cn("px-6 py-4 flex justify-end gap-3", className)}
    >
      {children}
    </div>
  )
)
ModalFooter.displayName = "ModalFooter"

export {
  Modal,
  ModalContent,
  ModalHeader,
  ModalTitle,
  ModalFooter,
}