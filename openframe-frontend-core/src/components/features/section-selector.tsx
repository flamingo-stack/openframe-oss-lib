"use client"

import React from 'react'
import { cn } from '../../utils/cn'
import { Button } from '../ui/button'
import { StatusBadge } from '../ui/status-badge'

export interface SectionItem {
  id: string
  title: string
  subtitle?: string
  description?: string
  number?: string
  disabled?: boolean
  badge?: {
    text: string
    variant?: 'card' | 'button'
    colorScheme?: 'cyan' | 'pink' | 'yellow' | 'green' | 'purple' | 'default'
  }
  screenshots?: {
    src: string
    alt: string
    position: 'left' | 'center' | 'right'
  }[]
}

export interface SectionSelectorProps {
  sections: SectionItem[]
  activeSection: string
  onSectionChange: (sectionId: string) => void
  disabled?: boolean
  className?: string
  buttonClassName?: string
  activeButtonClassName?: string
  layout?: 'vertical' | 'wrap'
  buttonWidth?: 'auto' | 'full' | 'responsive'
  minHeight?: string
  showDescription?: boolean
}

// Button component for consistency
const SectionButton: React.FC<{
  section: SectionItem
  isActive: boolean
  disabled: boolean
  onClick: () => void
  layout: 'vertical' | 'wrap'
  widthClasses: string
  buttonClassName?: string
  activeButtonClassName?: string
  minHeight?: string
  showDescription?: boolean
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
  showDescription = true
}) => {
  const titleClasses = "font-['DM_Sans'] text-ods-text-primary"
  const subtitleClasses = "font-['DM_Sans'] text-ods-text-secondary"
  const numberClasses = "font-['DM_Sans'] font-bold text-[var(--ods-open-yellow-base)]"

  const isDisabled = section.disabled || disabled;

  return (
    <Button
      onClick={onClick}
      disabled={isDisabled}
      variant={isActive ? "section-active" : "section"}
      size={layout === 'vertical' ? "touch" : "sectionWrap"}
      className={cn(
        widthClasses,
        buttonClassName,
        isActive && activeButtonClassName,
        layout === 'vertical' ? '!h-auto !py-4 !px-4 !min-h-[80px]' : '!text-left !whitespace-normal !h-auto !min-h-[76px]'
      )}
      style={{
        minHeight,
        touchAction: 'manipulation',
        WebkitTapHighlightColor: 'transparent',
        textAlign: 'left',
        justifyContent: 'flex-start',
        alignItems: 'flex-start'
      }}
    >
      {layout === 'vertical' ? (
        // Vertical layout with optional number prefix
        <div className="flex gap-2 items-start w-full">
          {section.number && (
            <span className={cn(numberClasses, 'text-lg tracking-[-0.36px] leading-[24px] shrink-0')}>
              {section.number}
            </span>
          )}
          <div className="flex-1 text-left min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className={cn(titleClasses, 'font-medium text-lg leading-[24px] whitespace-normal break-words')}>
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
              <p className={cn(subtitleClasses, 'text-sm mt-1 hidden xl:block whitespace-normal break-words')}>
                {section.description}
              </p>
            )}
          </div>
        </div>
      ) : (
        // Wrap layout with title and subtitle
        <div className="flex flex-col items-start justify-start w-full h-full gap-1" style={{ textAlign: 'left' }}>
          <div className="flex items-start gap-2 flex-wrap w-full">
            <span className={cn(titleClasses, 'font-bold text-[18px] leading-[24px] tracking-[-0.36px]')} style={{ textAlign: 'left' }}>
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
            <div className={cn(subtitleClasses, 'font-medium text-[14px] leading-[20px] w-full')} style={{ textAlign: 'left' }}>
              {section.subtitle}
            </div>
          )}
        </div>
      )}
    </Button>
  )
}

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
  showDescription = true
}) => {
  const containerClasses = cn(
    layout === 'wrap' ? 'flex flex-wrap gap-2 sm:gap-4 lg:gap-6' : 'flex flex-col gap-2',
    className
  )

  const getButtonWidthClasses = () => {
    switch (buttonWidth) {
      case 'full':
        return 'w-full'
      case 'responsive':
        return 'w-full sm:w-[calc(50%-8px)] lg:w-auto'
      default:
        return ''
    }
  }

  const widthClasses = getButtonWidthClasses()

  return (
    <div className={containerClasses}>
      {sections.map((section) => (
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
  )
}

export default SectionSelector