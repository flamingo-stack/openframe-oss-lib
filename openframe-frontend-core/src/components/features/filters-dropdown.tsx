'use client';

import type { FC, ReactNode, RefObject } from 'react';
import { useEffect, useRef, useState } from 'react';
import { useIsomorphicLayoutEffect } from '../../hooks/ui/use-isomorphic-layout-effect';
import { cn } from '../../utils/cn';
import { CheckboxCheckmarkIcon } from '../icons-v2-generated/signs-and-symbols/checkbox-checkmark-icon';
import { Button } from '../ui';

// Types for filter configuration
export interface FilterOption {
  id: string;
  label: string;
  value: string | number | boolean;
  count?: number;
  type?: 'option' | 'separator';
}

export interface FilterSection {
  id: string;
  title: string;
  type: 'checkbox' | 'radio' | 'select';
  options: FilterOption[];
  allowSelectAll?: boolean;
  defaultSelected?: string[];
}

export interface FiltersDropdownProps {
  triggerElement?: ReactNode; // Custom trigger element
  triggerLabel?: string; // Label for default trigger button
  sections: FilterSection[];
  onApply: (filters: Record<string, string[]>) => void;
  onReset?: () => void;
  className?: string;
  dropdownClassName?: string;
  /**
   * Currently applied filters to preserve state when reopening.
   * Pass the same filters that were applied via onApply callback.
   *
   * @example
   * ```tsx
   * const { appliedFilters, handleApply } = useFiltersDropdown(sections)
   *
   * <FiltersDropdown
   *   sections={sections}
   *   onApply={handleApply}
   *   currentFilters={appliedFilters}
   *   triggerLabel="STATUS"
   * />
   * ```
   */
  currentFilters?: Record<string, string[]>;
  placement?: 'bottom-start' | 'bottom-end' | 'bottom';
  /**
   * Enable responsive mobile behavior (full width on mobile)
   * @default true
   */
  responsive?: boolean;
}

// Custom checkbox component
const FilterCheckbox: FC<{
  checked: boolean;
  disabled?: boolean;
  className?: string;
}> = ({ checked, disabled = false, className }) => {
  return (
    <div
      role="checkbox"
      aria-checked={checked}
      className={cn(
        'relative h-6 w-6 shrink-0 rounded-[6px] transition-all duration-150',
        checked ? 'bg-ods-accent' : 'bg-ods-bg-surface',
        !checked && 'border-2 border-ods-border',
        disabled && 'opacity-50',
        className,
      )}
    >
      {checked && (
        <div className="absolute inset-0 flex items-center justify-center text-ods-text-on-accent">
          <CheckboxCheckmarkIcon size={10} />
        </div>
      )}
    </div>
  );
};

// Animation timings (ms). Must stay in sync with the `duration-200` Tailwind
// class on the dropdown panel below.
const ANIMATION_MS = 200;

export const FiltersDropdown: FC<FiltersDropdownProps> = ({
  triggerElement,
  triggerLabel = 'Filters',
  sections,
  onApply,
  onReset,
  className,
  dropdownClassName,
  currentFilters,
  placement = 'bottom-start',
  responsive = true,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  // `shouldRender` controls mount/unmount.
  // `isVisible` controls the open/closed *visual* state and drives the CSS transition.
  // Splitting them lets us mount in the closed visual state, then flip to open on
  // the next frame so the browser actually transitions (instead of teleporting).
  const [shouldRender, setShouldRender] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [measuredMobile, setIsMobile] = useState(false);
  const [actualPlacement, setActualPlacement] = useState(placement);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement | HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Drive mount/unmount and visual state from `isOpen`.
  //
  // Open  : mount with closed styles → wait two frames, flip to visible → CSS transition runs.
  // Close : flip to invisible → CSS transition runs → unmount after duration.
  //
  // Because we use CSS transitions (not @keyframes), interrupting mid-animation
  // smoothly continues from the current computed value — no flicker.
  // The two INSTANT halves are adjusted while rendering: mounting on open and
  // dropping the visible class on close are both edges the render already knows
  // about, and doing them here rather than from the effect removes a render
  // pass from every open and every close. Each is guarded on the state it
  // writes, so the pass React schedules for the adjustment takes the early exit.
  // The effect below is left owning only the two halves that genuinely need a
  // timer: the double-rAF entry and the delayed unmount.
  if (isOpen && !shouldRender) setShouldRender(true);
  if (!isOpen && isVisible) setIsVisible(false);

  useEffect(() => {
    if (isOpen) {
      // Double rAF: the first frame guarantees the element is mounted and the
      // closed styles have been painted; the second flips to the open state so
      // the browser sees a transitionable property change. A single rAF can
      // sometimes fire in the same frame as mount, suppressing the transition.
      let id2 = 0;
      const id1 = requestAnimationFrame(() => {
        id2 = requestAnimationFrame(() => setIsVisible(true));
      });
      return () => {
        cancelAnimationFrame(id1);
        cancelAnimationFrame(id2);
      };
    }
    const t = setTimeout(() => setShouldRender(false), ANIMATION_MS);
    return () => clearTimeout(t);
  }, [isOpen]);

  // Check if mobile on mount and resize. `responsive: false` means "never treat
  // this as mobile" — a fact about the PROP, so it masks the measurement below
  // instead of being written into it from the effect.
  const isMobile = responsive && measuredMobile;

  useEffect(() => {
    if (!responsive) return undefined;

    const checkMobile = () => {
      setIsMobile(window.innerWidth < 640); // sm breakpoint
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, [responsive]);

  useEffect(() => {
    if (!isOpen || isMobile || !triggerRef.current) return undefined;

    const calculateOptimalPlacement = () => {
      const trigger = triggerRef.current;
      if (!trigger) return;

      const triggerRect = trigger.getBoundingClientRect();
      const dropdownWidth = 320; // Fixed width from the dropdown
      const viewportWidth = window.innerWidth;

      const spaceRight = viewportWidth - triggerRect.right;
      const spaceLeft = triggerRect.left;

      let optimalPlacement = placement;

      if (placement === 'bottom-start' && spaceRight < dropdownWidth && spaceLeft >= dropdownWidth) {
        optimalPlacement = 'bottom-end';
      } else if (placement === 'bottom-end' && spaceLeft < dropdownWidth && spaceRight >= dropdownWidth) {
        optimalPlacement = 'bottom-start';
      } else if (placement === 'bottom' && (spaceLeft < dropdownWidth / 2 || spaceRight < dropdownWidth / 2)) {
        optimalPlacement = spaceLeft > spaceRight ? 'bottom-end' : 'bottom-start';
      }

      setActualPlacement(optimalPlacement);
    };

    calculateOptimalPlacement();
    window.addEventListener('resize', calculateOptimalPlacement);

    return () => window.removeEventListener('resize', calculateOptimalPlacement);
  }, [isOpen, isMobile, placement]);

  // Mobile: the panel is `fixed`, so its `top` is a live measurement of where
  // the trigger currently sits. Applied to the node in a layout effect rather
  // than read during render — `getBoundingClientRect()` in the render body
  // measured the PREVIOUS commit's layout, so the panel opened against a
  // trigger position that could already be wrong (page scrolled between
  // renders, chips above the trigger wrapping to a second line) and had no way
  // to correct itself. Unconditional so every commit re-measures; runs before
  // paint, so the panel never appears in the wrong place first.
  useIsomorphicLayoutEffect(() => {
    const dropdown = dropdownRef.current;
    if (!dropdown) return;
    if (!isMobile) {
      // Desktop is `absolute` + placement classes — an inline top from a
      // previous mobile layout would fight them.
      dropdown.style.top = '';
      return;
    }
    const trigger = triggerRef.current;
    dropdown.style.top = `${trigger ? trigger.getBoundingClientRect().bottom + window.scrollY + 8 : 0}px`;
  });

  // Initialize state with current filters or defaults
  const [selectedFilters, setSelectedFilters] = useState<Record<string, string[]>>(() => {
    if (currentFilters) {
      return { ...currentFilters };
    }
    const initial: Record<string, string[]> = {};
    sections.forEach(section => {
      initial[section.id] = section.defaultSelected || [];
    });
    return initial;
  });

  // Sync with external changes to currentFilters. Keyed on the serialised
  // CONTENT, not the object identity — a parent that rebuilds the same filters
  // object every render must not stomp local state. Read back from the same
  // string so the effect has no stale-closure gap.
  // Adjusted while rendering — React's documented prop-sync pattern — rather
  // than from an effect: the checkboxes render from `selectedFilters`, so an
  // externally applied filter set arrived one frame after the panel had already
  // painted the previous selection.
  const currentFiltersStr = currentFilters ? JSON.stringify(currentFilters) : '';
  const [syncedFiltersStr, setSyncedFiltersStr] = useState(currentFiltersStr);
  if (syncedFiltersStr !== currentFiltersStr) {
    setSyncedFiltersStr(currentFiltersStr);
    if (currentFiltersStr) {
      setSelectedFilters(JSON.parse(currentFiltersStr) as Record<string, string[]>);
    }
  }

  // Closing must NOT reset `actualPlacement`.
  //
  // The panel stays mounted through its exit transition (see `shouldRender`), so
  // a reset here lands on something still on screen: a dropdown that had flipped
  // to the opposite side snaps back the moment it starts fading, sliding roughly
  // its own width sideways on the way out. It showed up on whichever filter sits
  // nearest an edge — the last column on tablet, and the same column on desktop
  // once the window is narrow enough to force the flip.
  //
  // Nothing is lost by dropping it: opening recomputes the placement from the
  // trigger's current rect (see the effect above), so the value left behind is
  // never read again.

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      // Check if click is outside the entire component container
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (!isOpen) return undefined;

    // Use a small delay to avoid closing immediately after opening
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
    }, 0);

    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen]);

  const handleToggleOption = (sectionId: string, optionId: string, sectionType: string) => {
    setSelectedFilters(prev => {
      const current = prev[sectionId] || [];

      if (sectionType === 'radio') {
        return {
          ...prev,
          [sectionId]: [optionId],
        };
      } else {
        if (current.includes(optionId)) {
          return {
            ...prev,
            [sectionId]: current.filter(id => id !== optionId),
          };
        } else {
          return {
            ...prev,
            [sectionId]: [...current, optionId],
          };
        }
      }
    });
  };

  const handleSelectAll = (sectionId: string, section: FilterSection) => {
    const allOptionIds = section.options.map(opt => opt.id);
    const currentSelection = selectedFilters[sectionId] || [];
    const isAllSelected = allOptionIds.every(id => currentSelection.includes(id));

    setSelectedFilters(prev => ({
      ...prev,
      [sectionId]: isAllSelected ? [] : allOptionIds,
    }));
  };

  const handleReset = () => {
    const defaults: Record<string, string[]> = {};
    sections.forEach(section => {
      defaults[section.id] = section.defaultSelected || [];
    });
    setSelectedFilters(defaults);
    onReset?.();
    setIsOpen(false);
  };

  const handleApply = () => {
    onApply(selectedFilters);
    // No placement reset — see the note above the outside-click effect. `Reset`
    // never did one, which is why only Apply and the dismiss paths slid.
    setIsOpen(false);
  };

  const getActiveFiltersCount = () => {
    return Object.values(selectedFilters).reduce((acc: number, curr: string[]) => acc + curr.length, 0);
  };

  // Dropdown positioning classes based on placement and mobile state
  const getDropdownPositionClasses = () => {
    if (isMobile) {
      // On mobile, center horizontally with left offset for minimized sidebar
      // Vertically position right under the trigger button
      return 'top-full mt-2';
    }

    // Desktop positioning based on placement prop
    const desktopClasses = {
      'bottom-start': 'top-full left-0 mt-2',
      'bottom-end': 'top-full right-0 mt-2',
      bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
    };

    return desktopClasses[actualPlacement];
  };

  return (
    <div ref={containerRef} className={cn('relative inline-block', className)}>
      {/* Trigger */}
      {triggerElement ? (
        <div ref={triggerRef as RefObject<HTMLDivElement>} onClick={() => setIsOpen(!isOpen)}>
          {triggerElement}
        </div>
      ) : (
        <button
          ref={triggerRef as RefObject<HTMLButtonElement>}
          onClick={() => setIsOpen(!isOpen)}
          className={cn(
            'flex items-center gap-1.5 transition-colors text-h5',
            getActiveFiltersCount() > 0
              ? 'text-ods-accent hover:text-ods-accent/80'
              : 'text-ods-text-secondary hover:text-ods-text-primary',
          )}
        >
          {triggerLabel}
          {getActiveFiltersCount() > 0 && <span className="size-1.5 rounded-full bg-ods-accent" />}
        </button>
      )}

      {/* Dropdown Panel — kept mounted briefly on close to play exit transition. */}
      {shouldRender && (
        <div
          ref={dropdownRef}
          className={cn(
            'z-50 origin-top',
            // CSS transitions (not @keyframes) so mid-animation interruption
            // interpolates smoothly from the current computed value.
            'transition-[opacity,transform] duration-200 ease-out',
            'will-change-[opacity,transform]',
            isVisible ? 'translate-y-0 scale-100 opacity-100' : 'pointer-events-none -translate-y-2 scale-95 opacity-0',
            isMobile ? 'fixed left-4 right-4 mx-auto max-w-[320px]' : 'absolute w-[320px]',
            getDropdownPositionClasses(),
            dropdownClassName,
          )}
          // No `style` here: the mobile `top` is a DOM measurement and is owned
          // by the layout effect above.
        >
          <div className="flex flex-col overflow-hidden rounded-md border border-ods-border bg-ods-bg p-4 shadow-xl">
            <div className="max-h-[250px] min-h-0 flex-1 overflow-y-auto">
              {sections.map((section, sectionIndex) => {
                const sectionSelection = selectedFilters[section.id] || [];
                const allSelected = section.options.every(opt => sectionSelection.includes(opt.id));

                return (
                  <div key={section.id} className={cn('space-y-2', sectionIndex > 0 && 'mt-4')}>
                    {/* Section Header — sticky so title + Select All stay visible while options scroll. */}
                    <div className="sticky top-0 z-10 flex items-center justify-between bg-ods-bg pb-2">
                      <h3 className="text-ods-text-secondary text-h5">{section.title}</h3>
                      {section.allowSelectAll && section.type === 'checkbox' && (
                        <button
                          onClick={() => handleSelectAll(section.id, section)}
                          className="text-ods-text-secondary underline transition-colors text-h6 hover:text-ods-text-primary"
                        >
                          {allSelected ? 'Deselect All' : 'Select All'}
                        </button>
                      )}
                    </div>

                    {/* Options Container */}
                    <div className="overflow-hidden rounded-md border border-ods-border bg-ods-bg">
                      {section.options.map((option, index) => {
                        // Handle separator type
                        if (option.type === 'separator') {
                          return (
                            <div key={`${section.id}-separator-${index}`} className="my-1 border-t border-ods-border" />
                          );
                        }

                        const isSelected = sectionSelection.includes(option.id);
                        const isLast = index === section.options.length - 1;

                        return (
                          <button
                            type="button"
                            key={`${section.id}-${option.id}-${index}`}
                            onClick={() => handleToggleOption(section.id, option.id, section.type)}
                            className={cn(
                              'flex w-full items-center gap-[var(--spacing-system-s)] p-[var(--spacing-system-s)] text-left',
                              isSelected ? 'bg-ods-bg-surface' : 'bg-ods-bg',
                              !isLast && 'border-b border-ods-border',
                              'transition-colors hover:bg-ods-bg-hover',
                            )}
                          >
                            <FilterCheckbox checked={isSelected} />
                            <span
                              className="min-w-0 flex-1 truncate text-ods-text-primary text-h4"
                              title={option.label}
                            >
                              {option.label}
                            </span>
                            {option.count !== undefined && (
                              <span className="shrink-0 text-ods-text-secondary text-h6">
                                {option.count.toLocaleString()}
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
            {/* Action Buttons */}
            <div className="mt-4 flex shrink-0 gap-3">
              <Button variant="outline" onClick={handleReset} size="default" className="md:w-full!">
                Reset
              </Button>
              <Button variant="accent" onClick={handleApply} size="default" className="md:w-full!">
                Apply
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Export convenience hook for managing filter state
export const useFiltersDropdown = (initialSections: FilterSection[]) => {
  const [appliedFilters, setAppliedFilters] = useState<Record<string, string[]>>(() => {
    const initial: Record<string, string[]> = {};
    initialSections.forEach(section => {
      if (section.defaultSelected) {
        initial[section.id] = section.defaultSelected;
      }
    });
    return initial;
  });

  const handleApply = (filters: Record<string, string[]>) => {
    setAppliedFilters(filters);
  };

  const handleReset = () => {
    const defaults: Record<string, string[]> = {};
    initialSections.forEach(section => {
      defaults[section.id] = section.defaultSelected || [];
    });
    setAppliedFilters(defaults);
  };

  const getActiveFiltersCount = () => {
    return Object.values(appliedFilters).reduce((acc: number, curr: string[]) => acc + curr.length, 0);
  };

  return {
    appliedFilters,
    handleApply,
    handleReset,
    getActiveFiltersCount,
  };
};
