'use client';

import { usePreventScroll } from '@react-aria/overlays';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import type React from 'react';
import { useState, useRef } from 'react';
import { useHeaderHeight } from '../../hooks/ui';
import { useFocusTrap } from '../../hooks/ui/use-focus-trap';
import { useIsHydrated } from '../../hooks/ui/use-is-hydrated';
import type { SlidingSidebarConfig, NavigationItem } from '../../types/navigation';
import { cn } from '../../utils';
import { Button } from '../ui/button';
import { OVERLAY_BACKDROP_CLASS } from '../ui/drawer';

export interface SlidingSidebarProps {
  config: SlidingSidebarConfig;
}

export function SlidingSidebar({ config }: SlidingSidebarProps) {
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const mounted = useIsHydrated();
  const headerHeight = useHeaderHeight();
  const asideRef = useRef<HTMLElement>(null);
  const prefersReducedMotion = useReducedMotion();

  // Shared ref-counted scroll lock (react-aria) while the drawer is open.
  usePreventScroll({ isDisabled: !config.isOpen });
  // Escape + initial focus + guarded restore. `contain: false`: the z-50
  // header stays visible and clickable ABOVE the open drawer (see the z-tier
  // comment below), so this is a NON-modal dialog — Tab may leave freely.
  useFocusTrap(asideRef, config.isOpen, { onEscape: config.onClose, contain: false });

  const toggleExpanded = (itemId: string) => {
    const newExpanded = new Set(expandedItems);
    if (newExpanded.has(itemId)) {
      newExpanded.delete(itemId);
    } else {
      newExpanded.add(itemId);
    }
    setExpandedItems(newExpanded);
  };

  const renderMenuItem = (item: NavigationItem, level = 0): React.ReactNode => {
    // If custom element provided, render it
    if (item.element) {
      return <div key={item.id}>{item.element}</div>;
    }

    // Bind the (optional) child list once so the branch below maps a real
    // array instead of asserting `item.children` back into existence.
    const children = item.children ?? [];
    const hasChildren = children.length > 0;
    const isExpanded = expandedItems.has(item.id);

    if (hasChildren) {
      const chevronIcon = (
        <svg
          className={cn('h-4 w-4 transition-transform', isExpanded && 'rotate-90')}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      );

      return (
        <div key={item.id} className="space-y-1">
          <Button
            variant="transparent"
            size="default"
            onClick={() => toggleExpanded(item.id)}
            leftIcon={item.icon}
            rightIcon={chevronIcon}
            className={cn(
              '!w-full overflow-hidden rounded-lg transition-colors md:!w-full',
              level === 0 ? 'pl-3' : 'pl-6',
              item.isActive
                ? 'bg-ods-accent text-ods-text-on-accent hover:bg-ods-accent/90'
                : 'text-ods-text-primary hover:bg-ods-border',
            )}
          >
            <span className="truncate">{item.label}</span>
            {item.badge !== undefined && <span className="ml-auto mr-2 flex-shrink-0">{item.badge}</span>}
          </Button>

          <AnimatePresence>
            {isExpanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{
                  duration: 0.15,
                  ease: 'easeOut',
                  height: { duration: 0.2 },
                  opacity: { duration: 0.1 },
                }}
                className="overflow-hidden"
              >
                <div className="space-y-1 pl-4">{children.map(child => renderMenuItem(child, level + 1))}</div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      );
    }

    // Leaf node - either link or button
    if (item.href) {
      // For Next.js apps, onClick handler should handle navigation
      return (
        <Button
          key={item.id}
          variant="transparent"
          size="default"
          onClick={() => {
            // Let the parent handle navigation
            item.onClick?.();
            config.onClose();
          }}
          leftIcon={item.icon}
          className={cn(
            '!w-full overflow-hidden rounded-lg transition-colors md:!w-full',
            level === 0 ? 'pl-3' : 'pl-6',
            item.isActive
              ? 'bg-ods-accent text-ods-text-on-accent hover:bg-ods-accent/90'
              : 'text-ods-text-primary hover:bg-ods-border',
          )}
        >
          <span className="truncate">{item.label}</span>
          {item.badge !== undefined && <span className="ml-auto flex-shrink-0">{item.badge}</span>}
        </Button>
      );
    }

    return (
      <Button
        key={item.id}
        variant="transparent"
        size="default"
        onClick={() => {
          item.onClick?.();
          config.onClose();
        }}
        leftIcon={item.icon}
        className={cn(
          '!w-full overflow-hidden rounded-lg transition-colors md:!w-full',
          level === 0 ? 'pl-3' : 'pl-6',
          item.isActive
            ? 'bg-ods-accent text-ods-text-on-accent hover:bg-ods-accent/90'
            : 'text-ods-text-primary hover:bg-ods-border',
        )}
      >
        <span className="truncate">{item.label}</span>
        {item.badge !== undefined && <span className="ml-auto flex-shrink-0">{item.badge}</span>}
      </Button>
    );
  };

  if (!mounted) {
    return null;
  }

  return (
    <>
      {/* Overlay — admin-drawer tier (overlay z-[45] / panel z-[46]): ABOVE the
          footer (lowered to z-[44]) so the open drawer covers it, but BEHIND the
          header (z-[50]) so the header stays visible on top (the panel has a
          header spacer below). Kept under z-50 so it also stays beneath modals/
          dialogs (z-50+). See the z-index hierarchy in ODS_TOKEN_RULES.md. */}
      <AnimatePresence>
        {config.isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{
              duration: 0.3,
              ease: [0.4, 0, 0.2, 1],
            }}
            className={cn('fixed inset-0 z-[45]', OVERLAY_BACKDROP_CLASS)}
            onClick={() => config.onClose()}
          />
        )}
      </AnimatePresence>

      {/* Sliding Sidebar */}
      <motion.aside
        ref={asideRef}
        initial={false}
        animate={{
          x: config.isOpen ? 0 : config.position === 'right' ? '100%' : '-100%',
        }}
        transition={
          prefersReducedMotion
            ? { duration: 0 }
            : {
                type: 'spring',
                damping: 25,
                stiffness: 300,
                mass: 0.8,
                restDelta: 0.01,
                velocity: config.isOpen ? 5 : -5,
              }
        }
        tabIndex={-1}
        // Stays mounted translated off-screen — inert keeps its items out of
        // the tab order while "closed". Non-modal dialog: no aria-modal (the
        // header above remains reachable by design).
        inert={!config.isOpen || undefined}
        role={config.isOpen ? 'dialog' : undefined}
        aria-label={config.isOpen ? 'Navigation sidebar' : undefined}
        className={cn(
          'fixed bottom-0 top-0 z-[46] flex w-72 flex-col border-ods-border bg-ods-card shadow-xl',
          config.position === 'right' ? 'right-0 border-l' : 'left-0 border-r',
          config.className,
        )}
      >
        {/* Header spacer - dynamic height */}
        <div className="flex-shrink-0" style={{ height: `${headerHeight}px` }} />

        {/* Navigation */}
        <nav className="flex-1 space-y-2 overflow-y-auto overscroll-contain p-4">
          {config.items.map(item => renderMenuItem(item))}
        </nav>

        {/* Footer - bottom padding clears the iOS home indicator */}
        {config.footer && (
          <div className="border-t border-ods-border p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
            {config.footer}
          </div>
        )}
      </motion.aside>
    </>
  );
}
