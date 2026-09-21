'use client';

import type React from 'react';
import { useEffect, useRef } from 'react';
import { cn } from '../../utils/cn';
import { Button } from '../ui/button';
import { StatusBadge } from '../ui/status-badge';

export interface SectionItem {
  id: string;
  title: string;
  subtitle?: string;
  description?: string;
  number?: string;
  disabled?: boolean;
  leftIcon?: React.ReactNode;
  badge?: {
    text: string;
    variant?: 'card' | 'button';
    colorScheme?: 'cyan' | 'pink' | 'yellow' | 'green' | 'purple' | 'default';
  };
  screenshots?: {
    src: string;
    alt: string;
    position: 'left' | 'center' | 'right';
  }[];
}

/**
 * A section picker: ONE active section, the rest a click away.
 *
 * `vertical` is a side list on wide screens and, below `lg`, a single horizontally
 * SCROLLABLE strip. A side list stacked above its content on a phone is a screen
 * of navigation before the first pixel of content, and a consumer that made it
 * `sticky` had it cover the content it navigates. When a tab set does not fit,
 * Material's guidance is scrollable tabs, which is what the strip is: no wrapping,
 * no description, the active tab kept in view.
 *
 * Both layouts are a WAI-ARIA `tablist`: `aria-selected`, roving tabindex (Tab
 * lands on the active section, then leaves the list), arrow keys / Home / End.
 */
export interface SectionSelectorProps {
  sections: SectionItem[];
  activeSection: string;
  onSectionChange: (sectionId: string) => void;
  disabled?: boolean;
  className?: string;
  buttonClassName?: string;
  activeButtonClassName?: string;
  layout?: 'vertical' | 'wrap';
  buttonWidth?: 'auto' | 'full' | 'responsive';
  minHeight?: string;
  showDescription?: boolean;
}

// Button component for consistency
const SectionButton: React.FC<{
  section: SectionItem;
  isActive: boolean;
  disabled: boolean;
  onClick: () => void;
  layout: 'vertical' | 'wrap';
  widthClasses: string;
  buttonClassName?: string;
  activeButtonClassName?: string;
  minHeight?: string;
  showDescription?: boolean;
  /** Roving tabindex: the one section Tab lands on. */
  isTabStop: boolean;
}> = ({
  section,
  isActive,
  disabled,
  onClick,
  isTabStop,
  layout,
  widthClasses,
  buttonClassName,
  activeButtonClassName,
  minHeight = layout === 'vertical' ? '96px' : '76px',
  showDescription = true,
}) => {
  const titleClasses = 'text-ods-text-primary';
  const subtitleClasses = 'text-ods-text-secondary';
  const numberClasses = 'text-ods-accent';

  const isDisabled = section.disabled || disabled;

  return (
    <Button
      onClick={onClick}
      disabled={isDisabled}
      variant="outline"
      role="tab"
      aria-selected={isActive}
      tabIndex={isTabStop ? 0 : -1}
      className={cn(
        '!items-start !justify-start bg-ods-card !text-left shadow-ods-card hover:bg-ods-card-hover',
        isActive && 'border-ods-accent',
        widthClasses,
        buttonClassName,
        isActive && activeButtonClassName,
        layout === 'vertical'
          ? // Strip below lg: a compact, non-shrinking tab. Side list from lg: the full card.
            '!h-auto !min-h-12 shrink-0 !px-[var(--spacing-system-mf)] !py-[var(--spacing-system-sf)] lg:!min-h-[var(--section-min-height)] lg:shrink lg:!py-[var(--spacing-system-mf)]'
          : '!h-auto !min-h-[76px] !whitespace-normal !text-left',
      )}
      style={{
        // The side list's height is a CSS variable so the strip can ignore it; an
        // inline `minHeight` would make every strip tab as tall as a side card.
        ...(layout === 'vertical' ? ({ '--section-min-height': minHeight } as React.CSSProperties) : { minHeight }),
        touchAction: 'manipulation',
        WebkitTapHighlightColor: 'transparent',
        textAlign: 'left',
        justifyContent: 'flex-start',
        alignItems: 'flex-start',
      }}
    >
      {layout === 'vertical' ? (
        // Vertical layout with optional number prefix and leftIcon
        <div className="flex w-full items-start gap-3">
          {section.leftIcon && (
            <div className="mt-0.5 shrink-0 text-ods-text-primary opacity-70">{section.leftIcon}</div>
          )}
          {section.number && <span className={cn(numberClasses, 'shrink-0 text-h3')}>{section.number}</span>}
          <div className="min-w-0 flex-1 text-left">
            <div className="flex flex-wrap items-center gap-2">
              <p className={cn(titleClasses, 'whitespace-nowrap text-h4 lg:whitespace-normal lg:break-words')}>
                {section.title}
              </p>
              {section.badge && (
                <StatusBadge
                  text={section.badge.text}
                  variant={section.badge.variant || 'button'}
                  colorScheme={section.badge.colorScheme || 'default'}
                />
              )}
            </div>
            {section.description && showDescription && (
              <p className={cn(subtitleClasses, 'mt-1 hidden whitespace-normal break-words text-h6 lg:block')}>
                {section.description}
              </p>
            )}
          </div>
        </div>
      ) : (
        // Wrap layout with title, subtitle, and optional leftIcon
        <div className="flex h-full w-full items-start justify-start gap-3" style={{ textAlign: 'left' }}>
          {section.leftIcon && (
            <div className="mt-0.5 shrink-0 text-ods-text-primary opacity-70">{section.leftIcon}</div>
          )}
          <div className="flex flex-1 flex-col items-start justify-start gap-1">
            <div className="flex w-full flex-wrap items-start gap-2">
              <span className={cn(titleClasses, 'text-h3')} style={{ textAlign: 'left' }}>
                {section.title}
              </span>
              {section.badge && (
                <StatusBadge
                  text={section.badge.text}
                  variant={section.badge.variant || 'button'}
                  colorScheme={section.badge.colorScheme || 'default'}
                />
              )}
            </div>
            {section.subtitle && (
              <div className={cn(subtitleClasses, 'w-full text-h6')} style={{ textAlign: 'left' }}>
                {section.subtitle}
              </div>
            )}
          </div>
        </div>
      )}
    </Button>
  );
};

export const SectionSelector: React.FC<SectionSelectorProps> = ({
  sections,
  activeSection,
  onSectionChange,
  disabled = false,
  className,
  buttonClassName,
  activeButtonClassName,
  layout = 'vertical',
  buttonWidth = 'auto',
  minHeight,
  showDescription = true,
}) => {
  const containerClasses = cn(
    layout === 'wrap'
      ? 'flex flex-wrap gap-2 md:gap-4 lg:gap-6'
      : 'flex flex-row gap-[var(--spacing-system-xsf)] overflow-x-auto [scrollbar-width:none] lg:flex-col lg:overflow-visible [&::-webkit-scrollbar]:hidden',
    className,
  );

  const listRef = useRef<HTMLDivElement>(null);

  // Keep the active tab in view in the strip. Scrolls the LIST only, never the
  // page: `scrollIntoView` would also move every scrollable ancestor.
  useEffect(() => {
    const list = listRef.current;
    const active = list?.querySelector<HTMLElement>('[role="tab"][aria-selected="true"]');
    if (!list || !active || list.scrollWidth <= list.clientWidth) return;
    const offset = active.getBoundingClientRect().left - list.getBoundingClientRect().left;
    // Instant on purpose: a smooth scroll is driven by animation frames, which a
    // background tab or an embedded preview does not run, so it never arrived.
    list.scrollLeft += offset - (list.clientWidth - active.clientWidth) / 2;
  }, [activeSection]);

  const enabled = sections.filter(section => !section.disabled && !disabled);
  const tabStopId = enabled.some(section => section.id === activeSection) ? activeSection : enabled[0]?.id;

  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const step =
      event.key === 'ArrowRight' || event.key === 'ArrowDown'
        ? 1
        : event.key === 'ArrowLeft' || event.key === 'ArrowUp'
          ? -1
          : 0;
    if (!step && event.key !== 'Home' && event.key !== 'End') return;
    if (enabled.length === 0) return;
    event.preventDefault();
    const at = Math.max(
      0,
      enabled.findIndex(section => section.id === activeSection),
    );
    const next =
      event.key === 'Home'
        ? enabled[0]
        : event.key === 'End'
          ? enabled[enabled.length - 1]
          : enabled[(at + step + enabled.length) % enabled.length];
    onSectionChange(next.id);
    requestAnimationFrame(() =>
      listRef.current?.querySelector<HTMLElement>('[role="tab"][aria-selected="true"]')?.focus(),
    );
  };

  const getButtonWidthClasses = () => {
    switch (buttonWidth) {
      case 'full':
        return 'w-full';
      case 'responsive':
        return 'w-full md:w-[calc(50%-8px)] lg:w-auto';
      default:
        return '';
    }
  };

  const widthClasses = getButtonWidthClasses();

  return (
    <div ref={listRef} role="tablist" onKeyDown={onKeyDown} className={containerClasses}>
      {sections.map(section => (
        <SectionButton
          key={section.id}
          section={section}
          isActive={activeSection === section.id}
          disabled={disabled}
          onClick={() => onSectionChange(section.id)}
          layout={layout}
          widthClasses={widthClasses}
          buttonClassName={buttonClassName}
          activeButtonClassName={activeButtonClassName}
          minHeight={minHeight}
          showDescription={showDescription}
          isTabStop={section.id === tabStopId}
        />
      ))}
    </div>
  );
};

export default SectionSelector;
