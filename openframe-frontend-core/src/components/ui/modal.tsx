'use client';

import { usePreventScroll } from '@react-aria/overlays';
import { type ReactNode, forwardRef, useEffect } from 'react';
import { cn } from '../../utils/cn';

/**
 * Sizing and the two-column editor layout moved to `ModalV2` (`size` prop +
 * `ModalV2TwoColumn`), which is where the focus trap, Escape stacking and
 * keyboard-inset handling already live. The class-string constants this file
 * used to export were copied per call site and drifted; a component owns the
 * scroll model instead. What remains here is the compact legacy dialog used by
 * the confirm modals that have not moved yet.
 */
interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode;
  className?: string;
}

interface ModalContentProps {
  children: ReactNode;
  className?: string;
}

interface ModalHeaderProps {
  children: ReactNode;
  className?: string;
}

interface ModalTitleProps {
  children: ReactNode;
  className?: string;
}

interface ModalFooterProps {
  children: ReactNode;
  className?: string;
}

/** @deprecated Use ModalV2 from './modal-v2' instead. */
const Modal = forwardRef<HTMLDivElement, ModalProps>(({ isOpen, onClose, children, className }, ref) => {
  // Shared ref-counted scroll lock (react-aria) — restores prior styles on
  // release instead of clobbering to 'unset'.
  usePreventScroll({ isDisabled: !isOpen });

  // Handle Escape key (document-level: top-of-stack semantics for modals)
  useEffect(() => {
    if (!isOpen) return undefined;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[1300] flex items-center justify-center">
      <div className="absolute inset-0 bg-ods-overlay" onClick={onClose} aria-hidden="true" />
      <div
        ref={ref}
        className={cn(
          'relative z-10 mx-4 flex max-h-[90vh] w-full max-w-md flex-col overflow-hidden rounded-lg border border-ods-border bg-ods-card shadow-xl',
          className,
        )}
        role="dialog"
        aria-modal="true"
      >
        {children}
      </div>
    </div>
  );
});
Modal.displayName = 'Modal';

/** @deprecated Use ModalV2Content from './modal-v2' instead. */
const ModalContent = forwardRef<HTMLDivElement, ModalContentProps>(({ children, className }, ref) => (
  <div ref={ref} className={cn('min-h-0 flex-1 overflow-y-auto', className)}>
    {children}
  </div>
));
ModalContent.displayName = 'ModalContent';

/** @deprecated Use ModalV2Header from './modal-v2' instead. */
const ModalHeader = forwardRef<HTMLDivElement, ModalHeaderProps>(({ children, className }, ref) => (
  <div ref={ref} className={cn('shrink-0 border-b border-ods-border px-6 py-4', className)}>
    {children}
  </div>
));
ModalHeader.displayName = 'ModalHeader';

/** @deprecated Use ModalV2Title from './modal-v2' instead. */
const ModalTitle = forwardRef<HTMLHeadingElement, ModalTitleProps>(({ children, className }, ref) => (
  <h2 ref={ref} className={cn('font-semibold text-ods-text-primary', className)}>
    {children}
  </h2>
));
ModalTitle.displayName = 'ModalTitle';

/** @deprecated Use ModalV2Footer from './modal-v2' instead. */
const ModalFooter = forwardRef<HTMLDivElement, ModalFooterProps>(({ children, className }, ref) => (
  <div ref={ref} className={cn('flex shrink-0 justify-end gap-3 px-6 py-4', className)}>
    {children}
  </div>
));
ModalFooter.displayName = 'ModalFooter';

export { Modal, ModalContent, ModalFooter, ModalHeader, ModalTitle };
