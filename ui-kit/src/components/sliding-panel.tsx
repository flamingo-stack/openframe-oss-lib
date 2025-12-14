"use client";

import { useEffect, Fragment } from 'react';
import { X } from 'lucide-react';
import { Button } from "./ui";
import { Transition, Dialog } from '@headlessui/react';

interface SlidingPanelProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'half' | 'fullscreen';
}

/**
 * Sliding panel that slides in from the right side of the screen
 * Built on top of Headless UI Dialog for proper accessibility
 */
export function SlidingPanel({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
  footer,
  size = 'md'
}: SlidingPanelProps) {
  const sizeClasses = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    half: 'max-w-[50vw]',
    fullscreen: 'max-w-[90vw]'
  };

  // Prevent body scroll when panel is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }

    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={onClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black/25 backdrop-blur-sm" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-hidden">
          <div className="absolute inset-0 overflow-hidden">
            <div className="pointer-events-none fixed inset-y-0 right-0 flex max-w-full pl-10">
              <Transition.Child
                as={Fragment}
                enter="transform transition ease-in-out duration-500"
                enterFrom="translate-x-full"
                enterTo="translate-x-0"
                leave="transform transition ease-in-out duration-500"
                leaveFrom="translate-x-0"
                leaveTo="translate-x-full"
              >
                <Dialog.Panel className={`pointer-events-auto w-screen ${sizeClasses[size]}`}>
                  <div className="flex h-full flex-col bg-ods-bg border-l border-ods-border shadow-2xl">
                    {/* Header */}
                    <div className="px-6 py-4 border-b border-ods-border">
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <Dialog.Title as="h2" className="font-['Azeret_Mono'] text-[20px] font-semibold text-ods-text-primary">
                            {title}
                          </Dialog.Title>
                          {subtitle && (
                            <p className="mt-1 text-sm text-ods-text-secondary font-['DM_Sans']">
                              {subtitle}
                            </p>
                          )}
                        </div>
                        <div className="ml-3 flex h-7 items-center">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={onClose}
                            className="h-8 w-8 p-0"
                          >
                            <X className="h-5 w-5" />
                            <span className="sr-only">Close panel</span>
                          </Button>
                        </div>
                      </div>
                    </div>

                    {/* Content */}
                    <div className="flex-1 overflow-y-auto">
                      {children}
                    </div>

                    {/* Footer */}
                    {footer && (
                      <div className="px-6 py-4 border-t border-ods-border bg-ods-card">
                        {footer}
                      </div>
                    )}
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
}