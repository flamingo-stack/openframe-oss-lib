'use client';

import type React from 'react';
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
}> = ({
  section,
  isActive,
  disabled,
  onClick,
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
      className={cn(
        '!items-start !justify-start bg-ods-card !text-left shadow-ods-card hover:bg-ods-card-hover',
        isActive && 'border-ods-accent',
        widthClasses,
        buttonClassName,
        isActive && activeButtonClassName,
        layout === 'vertical'
          ? '!h-auto !min-h-[80px] !px-4 !py-4'
          : '!h-auto !min-h-[76px] !whitespace-normal !text-left',
      )}
      style={{
        minHeight,
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
              <p className={cn(titleClasses, 'whitespace-normal break-words text-h4')}>{section.title}</p>
              {section.badge && (
                <StatusBadge
                  text={section.badge.text}
                  variant={section.badge.variant || 'button'}
                  colorScheme={section.badge.colorScheme || 'default'}
                />
              )}
            </div>
            {section.description && showDescription && (
              <p className={cn(subtitleClasses, 'mt-1 whitespace-normal break-words text-h6')}>{section.description}</p>
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
    layout === 'wrap' ? 'flex flex-wrap gap-2 md:gap-4 lg:gap-6' : 'flex flex-col gap-2',
    className,
  );

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
    <div className={containerClasses}>
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
        />
      ))}
    </div>
  );
};

export default SectionSelector;
