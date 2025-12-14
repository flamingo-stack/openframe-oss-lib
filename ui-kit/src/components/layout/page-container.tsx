'use client'

import React from 'react'
import { ChevronLeft } from 'lucide-react'
import { cn } from '../../utils/cn'
import { Button } from '../ui/button'

// Legacy interface for backward compatibility (layout version)
interface LegacyPageContainerProps {
  children: React.ReactNode;
  className?: string;
  /** Whether to apply full-width background to the entire section */
  fullWidthBackground?: boolean;
  /** Custom background style/className for the section wrapper */
  backgroundClassName?: string;
  /** Custom background style object */
  backgroundStyle?: React.CSSProperties;
  /** Custom padding for the content container (overrides default responsive padding) */
  contentPadding?: string;
  /** Custom max-width for the content container (default: max-w-[1920px]) */
  maxWidth?: string;
  /** HTML element type for the container */
  as?: 'section' | 'div' | 'main' | 'article';
  /** HTML id for the container */
  id?: string;
}

// New advanced interface (UI version)
interface AdvancedPageContainerProps {
  /**
   * Page content
   */
  children: React.ReactNode
  /**
   * Page variant determines layout structure
   */
  variant?: 'list' | 'detail' | 'form' | 'content'
  /**
   * Page title (displayed as h1)
   */
  title?: string
  /**
   * Subtitle or description (supports both string and ReactNode)
   */
  subtitle?: string | React.ReactNode
  /**
   * Back button configuration
   */
  backButton?: {
    label?: string
    onClick: () => void
  }
  /**
   * Header actions (buttons, controls, etc.)
   */
  headerActions?: React.ReactNode
  /**
   * Custom header content (overrides title/subtitle)
   */
  headerContent?: React.ReactNode
  /**
   * Container padding
   */
  padding?: 'none' | 'sm' | 'md' | 'lg'
  /**
   * Container background
   */
  background?: 'default' | 'card' | 'transparent'
  /**
   * Additional CSS classes for container
   */
  className?: string
  /**
   * Additional CSS classes for content area
   */
  contentClassName?: string
  /**
   * Whether to show the standard header section
   */
  showHeader?: boolean
}

// Union type that supports both interfaces
export type PageContainerProps = LegacyPageContainerProps | AdvancedPageContainerProps

// Type guard to determine which interface is being used
function isAdvancedProps(props: PageContainerProps): props is AdvancedPageContainerProps {
  return 'variant' in props || 'title' in props || 'subtitle' in props || 'backButton' in props || 'headerActions' in props || 'headerContent' in props || 'showHeader' in props || 'contentClassName' in props
}

/**
 * Unified Page Container Component
 * 
 * Supports both legacy layout patterns and advanced UI patterns:
 * 
 * LEGACY USAGE (backward compatible):
 * <PageContainer backgroundClassName="bg-gray-100">
 *   <h1>Your Content</h1>
 * </PageContainer>
 * 
 * ADVANCED USAGE (new features):
 * <PageContainer variant="detail" title="Page Title" backButton={{onClick: () => {}}}>
 *   <div>Your Content</div>
 * </PageContainer>
 */
export function PageContainer(props: PageContainerProps) {
  if (isAdvancedProps(props)) {
    return renderAdvancedPageContainer(props)
  } else {
    return renderLegacyPageContainer(props)
  }
}

// Legacy implementation (preserves original behavior exactly)
function renderLegacyPageContainer({
  children,
  className = '',
  fullWidthBackground = true,
  backgroundClassName = 'bg-ods-bg',
  backgroundStyle,
  contentPadding = 'px-6 md:px-20 py-6 md:py-10',
  maxWidth = 'max-w-[1920px]',
  as: Component = 'section',
  id
}: LegacyPageContainerProps) {
  const content = (
    <div className={cn(maxWidth, contentPadding, 'mx-auto', className)}>
      {children}
    </div>
  );

  if (fullWidthBackground) {
    return (
      <Component 
        className={cn('w-full', backgroundClassName)} 
        style={backgroundStyle}
        id={id}
      >
        {content}
      </Component>
    );
  }

  // If fullWidthBackground is false, apply background to content container only
  return (
    <Component className="w-full" id={id}>
      <div className={cn(maxWidth, contentPadding, 'mx-auto', backgroundClassName, className)} style={backgroundStyle}>
        {children}
      </div>
    </Component>
  );
}

// Advanced implementation (from UI component)
function renderAdvancedPageContainer({
  children,
  variant = 'content',
  title,
  subtitle,
  backButton,
  headerActions,
  headerContent,
  padding = 'md',
  background = 'transparent',
  className,
  contentClassName,
  showHeader = true
}: AdvancedPageContainerProps) {
  
  const paddingClasses = {
    none: '',
    sm: 'p-4',
    md: 'p-6',
    lg: 'p-8'
  }

  const backgroundClasses = {
    default: 'bg-ods-bg',
    card: 'bg-ods-card',
    transparent: ''
  }

  const renderHeader = () => {
    if (!showHeader) return null
    
    if (headerContent) {
      return (
        <div className={cn(
          "flex items-end justify-between gap-4"
        )}>
          {headerContent}
        </div>
      )
    }

    if (variant === 'detail') {
      return (
        <div className="flex items-end justify-between gap-4">
          <div className="flex flex-col gap-2 flex-1">
            {/* Back Button */}
            {backButton && (
              <Button
                onClick={backButton.onClick}
                variant="ghost"
                className="flex items-center gap-2 p-3 rounded-[6px] hover:bg-ods-bg-hover transition-colors self-start justify-start"
                leftIcon={<ChevronLeft className="h-6 w-6 text-ods-text-secondary" />}
              >
                <span className="font-['DM_Sans'] font-medium text-[18px] leading-[24px] text-ods-text-secondary">
                  {backButton.label || 'Back'}
                </span>
              </Button>
            )}

            {/* Title */}
            {title && (
              <h1 className="font-['Azeret_Mono'] font-semibold text-[32px] leading-[40px] tracking-[-0.64px] text-ods-text-primary">
                {title}
              </h1>
            )}
            
            {/* Subtitle */}
            {subtitle && (
              <div className="text-ods-text-secondary font-['DM_Sans'] font-medium text-[16px]">
                {subtitle}
              </div>
            )}
          </div>

          {/* Header Actions */}
          {headerActions && (
            <div className="flex gap-2 items-center">
              {headerActions}
            </div>
          )}
        </div>
      )
    }

    if (variant === 'list') {
      return (
        <div className="flex items-center justify-between">
          <div className="flex flex-col gap-1">
            {title && (
              <h1 className="font-['Azeret_Mono'] font-semibold text-[24px] leading-[32px] tracking-[-0.48px] text-ods-text-primary">
                {title}
              </h1>
            )}
            {subtitle && (
              <div className="text-ods-text-secondary font-['DM_Sans'] font-medium text-[16px]">
                {subtitle}
              </div>
            )}
          </div>

          {/* Header Actions */}
          {headerActions && (
            <div className="flex gap-3">
              {headerActions}
            </div>
          )}
        </div>
      )
    }

    if (variant === 'form') {
      return (
        <div className="border-b border-ods-border pb-10 pt-6">
          <div className="flex items-end justify-between">
            <div className="flex flex-col gap-2">
              {/* Back Button */}
              {backButton && (
                <Button
                  onClick={backButton.onClick}
                  variant="ghost"
                  className="flex items-center gap-2 text-ods-text-secondary hover:text-ods-text-primary transition-colors px-0 py-3 justify-start"
                  leftIcon={<ChevronLeft className="w-6 h-6" />}
                >
                  <span className="text-lg font-['DM_Sans:Medium',_sans-serif] font-medium">{backButton.label || 'Back'}</span>
                </Button>
              )}
              
              {title && (
                <h1 className="text-[32px] font-['Azeret_Mono:SemiBold',_sans-serif] font-semibold text-ods-text-primary tracking-[-0.64px]">
                  {title}
                </h1>
              )}
            </div>
            
            {/* Header Actions */}
            {headerActions && (
              <div className="flex gap-4">
                {headerActions}
              </div>
            )}
          </div>
        </div>
      )
    }

    // Default content header
    return (
      <div className="flex items-center justify-between">
        {(title || subtitle) && (
          <div className="flex flex-col gap-1">
            {title && (
              <h1 className="font-['Azeret_Mono'] font-semibold text-[24px] leading-[32px] tracking-[-0.48px] text-ods-text-primary">
                {title}
              </h1>
            )}
            {subtitle && (
              <div className="text-ods-text-secondary font-['DM_Sans'] font-medium text-[16px]">
                {subtitle}
              </div>
            )}
          </div>
        )}

        {headerActions && (
          <div className="flex gap-3">
            {headerActions}
          </div>
        )}
      </div>
    )
  }

  const getContainerClasses = () => {
    const baseClasses = [
      'flex flex-col w-full',
      backgroundClasses[background],
      paddingClasses[padding]
    ]

    switch (variant) {
      case 'list':
        return cn(baseClasses, 'gap-8', className)
      case 'detail':
        return cn(baseClasses, 'gap-10', className)
      case 'form':
        return cn(baseClasses, 'min-h-screen', className)
      case 'content':
      default:
        return cn(baseClasses, 'gap-8', className)
    }
  }

  const getContentClasses = () => {
    switch (variant) {
      case 'detail':
        return cn('flex-1 overflow-auto', contentClassName)
      case 'form':
        return cn('space-y-10 pt-12', contentClassName)
      case 'list':
      case 'content':
      default:
        return cn('flex-1', contentClassName)
    }
  }

  return (
    <div className={getContainerClasses()}>
      {renderHeader()}
      
      <div className={getContentClasses()}>
        {children}
      </div>
    </div>
  )
}

// Convenience exports for common page types (advanced mode only)
export const ListPageContainer = (props: Omit<AdvancedPageContainerProps, 'variant'>) => 
  <PageContainer {...props} variant="list" />

export const DetailPageContainer = (props: Omit<AdvancedPageContainerProps, 'variant'>) => 
  <PageContainer {...props} variant="detail" />

export const FormPageContainer = (props: Omit<AdvancedPageContainerProps, 'variant'>) => 
  <PageContainer {...props} variant="form" />

export const ContentPageContainer = (props: Omit<AdvancedPageContainerProps, 'variant'>) => 
  <PageContainer {...props} variant="content" />

export default PageContainer;