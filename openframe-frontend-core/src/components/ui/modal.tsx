"use client"

import * as React from "react"
import { useEffect } from "react"
import { usePreventScroll } from "@react-aria/overlays"
import { cn } from "../../utils/cn"

/**
 * Modal width presets — the SSOT for admin modal sizing. Pick a preset via
 * `size` instead of stacking `max-w-*` className overrides per call site.
 *  - default: compact dialogs (confirmations, small forms)
 *  - wide:    two-column editor modals (interview / case study / release …)
 */
export const MODAL_SIZE_CLASSES = {
  default: 'max-w-md',
  wide: 'max-w-[1400px]',
} as const
export type ModalSize = keyof typeof MODAL_SIZE_CLASSES

/**
 * Two-column editor-modal layout SSOT (body wrapper → grid → column).
 * Every dual-column admin modal composes these three, so the shell can't
 * drift per entity:
 *
 *   <div className={TWO_COLUMN_MODAL_BODY_CLASS}>
 *     <div className={TWO_COLUMN_MODAL_GRID_CLASS}>
 *       <div className={TWO_COLUMN_MODAL_COLUMN_CLASS}>…left…</div>
 *       <div className={TWO_COLUMN_MODAL_COLUMN_CLASS}>…right…</div>
 *     </div>
 *   </div>
 */
export const TWO_COLUMN_MODAL_BODY_CLASS = 'px-6 py-4 flex-1 min-h-0 flex flex-col max-h-[70vh]'
export const TWO_COLUMN_MODAL_GRID_CLASS = 'grid grid-cols-1 lg:grid-cols-2 gap-8 flex-1 min-h-0'
export const TWO_COLUMN_MODAL_COLUMN_CLASS = 'space-y-6 overflow-y-auto pr-4'

interface ModalProps {
  isOpen: boolean
  onClose: () => void
  children: React.ReactNode
  className?: string
  /** Width preset from MODAL_SIZE_CLASSES. Default 'default' (max-w-md). */
  size?: ModalSize
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
  ({ isOpen, onClose, children, className, size = 'default' }, ref) => {
    // Shared ref-counted scroll lock (react-aria) — restores prior styles on
    // release instead of clobbering to 'unset'.
    usePreventScroll({ isDisabled: !isOpen })

    // Handle Escape key (document-level: top-of-stack semantics for modals)
    useEffect(() => {
      const handleKeyDown = (event: KeyboardEvent) => {
        if (event.key === 'Escape') {
          onClose()
        }
      }

      if (isOpen) {
        document.addEventListener('keydown', handleKeyDown)
        return () => document.removeEventListener('keydown', handleKeyDown)
      }
    }, [isOpen, onClose])

    if (!isOpen) return null

    return (
      <div className="fixed inset-0 z-[1300] flex items-center justify-center">
        <div 
          className="absolute inset-0 bg-ods-overlay"
          onClick={onClose}
          aria-hidden="true"
        />
        <div 
          ref={ref}
          className={cn(
            "relative z-10 w-full mx-4 max-h-[90vh] flex flex-col overflow-hidden bg-ods-card border border-ods-border rounded-lg shadow-xl",
            MODAL_SIZE_CLASSES[size],
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
