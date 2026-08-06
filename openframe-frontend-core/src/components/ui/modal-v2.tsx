"use client"

import * as React from "react"
import { useEffect, useState } from "react"
import { usePreventScroll } from "@react-aria/overlays"
import { XmarkIcon } from "../icons-v2-generated"
import { cn } from "../../utils/cn"

// Duration of the open/close animation in ms — keep in sync with the
// `duration-200` utilities applied to the backdrop and panel below.
const ANIMATION_DURATION = 200

const ModalContext = React.createContext<{ onClose?: () => void }>({})

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
    // Keep the modal mounted while the exit animation plays.
    const [isMounted, setIsMounted] = useState(isOpen)
    const panelRef = React.useRef<HTMLDivElement | null>(null)
    const restoreFocusRef = React.useRef<HTMLElement | null>(null)

    // FOCUS MANAGEMENT — the dialog contract every ModalV2 consumer was
    // missing: focus moves INTO the dialog on open (a modal opened from a
    // Radix dropdown otherwise loses the focus race to the menu's
    // close-restore and focus stays on the page), Tab cycles inside it, and
    // focus returns to the opener on close.
    useEffect(() => {
      if (!isOpen) return
      restoreFocusRef.current = document.activeElement as HTMLElement | null
      const raf = requestAnimationFrame(() => {
        const panel = panelRef.current
        if (!panel) return
        // If a consumer already moved focus inside (e.g. a form autofocusing
        // its first field), leave it alone.
        if (panel.contains(document.activeElement)) return
        panel.focus()
      })
      return () => {
        cancelAnimationFrame(raf)
        restoreFocusRef.current?.focus?.()
      }
    }, [isOpen])

    // Tab trap: cycle within the panel's focusables.
    useEffect(() => {
      if (!isOpen) return
      const handleTab = (event: KeyboardEvent) => {
        if (event.key !== 'Tab') return
        const panel = panelRef.current
        if (!panel) return
        const focusables = Array.from(
          panel.querySelectorAll<HTMLElement>(
            'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
          ),
        ).filter(el => el.getAttribute('aria-hidden') !== 'true' && el.offsetParent !== null)
        if (focusables.length === 0) return
        const first = focusables[0]
        const last = focusables[focusables.length - 1]
        const active = document.activeElement
        if (event.shiftKey) {
          if (active === first || !panel.contains(active)) {
            event.preventDefault()
            last.focus()
          }
        } else if (active === last || !panel.contains(active)) {
          event.preventDefault()
          first.focus()
        }
      }
      document.addEventListener('keydown', handleTab)
      return () => document.removeEventListener('keydown', handleTab)
    }, [isOpen])

    useEffect(() => {
      if (isOpen) {
        setIsMounted(true)
        return
      }
      const timeout = setTimeout(() => setIsMounted(false), ANIMATION_DURATION)
      return () => clearTimeout(timeout)
    }, [isOpen])

    // Shared ref-counted scroll lock (react-aria) — restores prior styles on
    // release instead of clobbering to 'unset'.
    usePreventScroll({ isDisabled: !isOpen })

    // Escape key (document-level: top-of-stack semantics for modals)
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

    if (!isMounted) return null

    const state = isOpen ? "open" : "closed"

    return (
      <div className="fixed inset-0 z-[1300] flex items-end md:items-center justify-center">
        <div
          data-state={state}
          className={cn(
            "absolute inset-0 bg-ods-overlay backdrop-blur-[2px] md:backdrop-blur-none",
            "duration-200 fill-mode-forwards",
            "data-[state=open]:animate-in data-[state=open]:fade-in-0",
            "data-[state=closed]:animate-out data-[state=closed]:fade-out-0",
            // Hold the hidden end-state until unmount so the backdrop doesn't
            // flash back to full opacity when the animation finishes a frame
            // before the unmount timeout fires.
            "data-[state=closed]:fill-mode-forwards"
          )}
          onClick={onClose}
          aria-hidden="true"
        />
        <div
          ref={(node) => {
            panelRef.current = node
            if (typeof ref === 'function') ref(node)
            else if (ref) (ref as React.MutableRefObject<HTMLDivElement | null>).current = node
          }}
          tabIndex={-1}
          data-state={state}
          className={cn(
            // min() keeps the desktop cap at 28rem while never letting content
            // stretch the panel past the viewport (minus the mx-4 margins) on
            // narrow screens. A single base utility (not md:max-w-md) so consumer
            // max-w-* overrides via className still win at every breakpoint.
            "relative z-10 w-full min-w-0 max-w-[min(28rem,calc(100vw-2rem))] flex flex-col",
            "mx-4 mb-4 md:mb-0",
            "max-h-[90vh]",
            "bg-ods-bg md:bg-ods-card",
            "border border-ods-border rounded-md shadow-xl",
            "p-[var(--spacing-system-xl)] gap-[var(--spacing-system-l)]",
            "duration-200 fill-mode-forwards",
            "data-[state=open]:animate-in data-[state=open]:fade-in-0",
            "data-[state=open]:slide-in-from-bottom-4 md:data-[state=open]:slide-in-from-bottom-0 md:data-[state=open]:zoom-in-95",
            "data-[state=closed]:animate-out data-[state=closed]:fade-out-0",
            "data-[state=closed]:slide-out-to-bottom-4 md:data-[state=closed]:slide-out-to-bottom-0 md:data-[state=closed]:zoom-out-95",
            // Hold the hidden end-state until unmount so the panel doesn't snap
            // back to opacity/scale 1 for a frame before it unmounts.
            "data-[state=closed]:fill-mode-forwards",
            className
          )}
          role="dialog"
          aria-modal="true"
        >
          <ModalContext.Provider value={{ onClose }}>
            {children}
          </ModalContext.Provider>
        </div>
      </div>
    )
  }
)
Modal.displayName = "ModalV2"

const ModalContent = React.forwardRef<HTMLDivElement, ModalContentProps>(
  ({ children, className }, ref) => (
    <div ref={ref} className={cn("flex-1 min-h-0 overflow-y-auto", className)}>
      {children}
    </div>
  )
)
ModalContent.displayName = "ModalV2Content"

const ModalHeader = React.forwardRef<HTMLDivElement, ModalHeaderProps>(
  ({ children, className }, ref) => {
    const { onClose } = React.useContext(ModalContext)
    return (
      <div
        ref={ref}
        className={cn("flex items-center gap-[var(--spacing-system-sf)]", className)}
      >
        <div className="flex flex-col flex-1 min-w-0">
          {children}
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="hidden md:flex shrink-0 text-ods-text-secondary hover:text-ods-text-primary transition-colors"
            aria-label="Close"
          >
            <XmarkIcon className="size-6" />
          </button>
        )}
      </div>
    )
  }
)
ModalHeader.displayName = "ModalV2Header"

const ModalTitle = React.forwardRef<HTMLHeadingElement, ModalTitleProps>(
  ({ children, className }, ref) => (
    <h2 
      ref={ref}
      className={cn("text-ods-text-primary text-h2", className)}
    >
      {children}
    </h2>
  )
)
ModalTitle.displayName = "ModalV2Title"

const ModalFooter = React.forwardRef<HTMLDivElement, ModalFooterProps>(
  ({ children, className }, ref) => (
    <div
      ref={ref}
      className={cn("flex gap-4", className)}
    >
      {children}
    </div>
  )
)
ModalFooter.displayName = "ModalV2Footer"

export {
  Modal as ModalV2,
  ModalContent as ModalV2Content,
  ModalFooter as ModalV2Footer,
  ModalHeader as ModalV2Header,
  ModalTitle as ModalV2Title
}
