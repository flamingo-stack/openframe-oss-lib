'use client'

import { ChevronLeft } from 'lucide-react'
import React from 'react'
import { cn } from '../../utils/cn'
import { Button } from '../ui/button'
import { MoreActionsItem } from '../ui/more-actions-menu'
import { PageActions, type PageActionButton } from '../ui/page-actions'

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
   * Can be used together with or instead of `actions` prop
   */
  headerActions?: React.ReactNode
  /**
   * Page action buttons configuration
   * Automatically renders PageActions component with appropriate variant:
   * - 'list' variant → 'icon-buttons' (collapses to menu on mobile)
   * - 'detail'/'form' variants → 'primary-buttons' (fixed bottom on mobile)
   */
  actions?: PageActionButton[]
  /**
   * Override the automatically determined PageActions variant
   */
  actionsVariant?: 'icon-buttons' | 'primary-buttons' | 'menu-primary'
  /**
   * Page action menu items configuration
   */
  menuActions?: MoreActionsItem[]
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
  return 'variant' in props || 'title' in props || 'subtitle' in props || 'backButton' in props || 'headerActions' in props || 'headerContent' in props || 'showHeader' in props || 'contentClassName' in props || 'actions' in props || 'actionsVariant' in props
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
  contentPadding,
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
  actions,
  actionsVariant,
  menuActions,
  padding = 'none',
  background = 'transparent',
  className,
  contentClassName,
  showHeader = true
}: AdvancedPageContainerProps) {

  // Determine PageActions variant based on page variant
  const getActionsVariant = () => {
    if (actionsVariant) return actionsVariant
    // List pages use icon-buttons (collapses to menu on mobile)
    if (variant === 'list') return 'icon-buttons'
    // Detail/form pages use primary-buttons (fixed bottom on mobile)
    return 'primary-buttons'
  }

  // Render actions component
  const renderActions = () => {
    if (!actions || actions.length === 0) return null
    return <PageActions variant={getActionsVariant()} actions={actions} menuActions={menuActions} />
  }

  // Check if we need bottom padding for mobile fixed actions
  const needsBottomPadding = actions && actions.length > 0 && getActionsVariant() === 'primary-buttons'
  
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
                variant="transparent"
                className="flex self-start justify-start text-ods-text-secondary"
                leftIcon={<ChevronLeft className="h-6 w-6 text-ods-text-secondary" />}
                noPadding
              >
                {backButton.label || 'Back'}
              </Button>
            )}

            {/* Title */}
            {title && (
              <h1 className="font-['Azeret_Mono'] font-semibold text-[24px] sm:text-[32px] leading-[32px] sm:leading-[40px] tracking-[-0.48px] sm:tracking-[-0.64px] text-ods-text-primary">
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
          {(headerActions || actions) && (
            <div className="flex gap-2 items-center">
              {headerActions}
              {renderActions()}
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
          {(headerActions || actions) && (
            <div className="flex gap-3 items-center">
              {headerActions}
              {renderActions()}
            </div>
          )}
        </div>
      )
    }

    if (variant === 'form') {
      return (
        <div className="flex items-end justify-between">
          <div className="flex flex-col gap-2">
            {/* Back Button */}
            {backButton && (
              <Button
                onClick={backButton.onClick}
                className="flex self-start justify-start text-ods-text-secondary"
                variant="transparent"
                leftIcon={<ChevronLeft className="w-6 h-6" />}
                noPadding
              >
                {backButton.label || 'Back'}
              </Button>
            )}
            
            {title && (
              <h1 className="text-[32px] font-['Azeret_Mono:SemiBold',_sans-serif] font-semibold text-ods-text-primary tracking-[-0.64px]">
                {title}
              </h1>
            )}
          </div>
          
          {/* Header Actions */}
          {(headerActions || actions) && (
            <div className="flex gap-4 items-center">
              {headerActions}
              {renderActions()}
            </div>
          )}
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

        {(headerActions || actions) && (
          <div className="flex gap-3 items-center">
            {headerActions}
            {renderActions()}
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
        return cn(baseClasses, 'gap-4 md:gap-6', className)
      case 'detail':
        return cn(baseClasses, 'gap-4 md:gap-6', className)
      case 'form':
        return cn(baseClasses, 'gap-6 md:gap-10', className)
      case 'content':
      default:
        return cn(baseClasses, 'gap-4 md:gap-6', className)
    }
  }

  const getContentClasses = () => {
    // Add bottom padding on mobile when using primary-buttons variant (fixed bottom bar)
    const mobilePadding = needsBottomPadding ? 'pb-28 md:pb-0' : ''

    switch (variant) {
      case 'detail':
        return cn('flex-1 overflow-auto', mobilePadding, contentClassName)
      case 'list':
        return cn('flex flex-col gap-4 md:gap-6', mobilePadding, contentClassName)
      case 'form':
        return cn('flex flex-col gap-4 md:gap-10', mobilePadding, contentClassName)
      case 'content':
      default:
        return cn('flex-1', mobilePadding, contentClassName)
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

// Re-export PageActionButton type for convenience
export type { PageActionButton } from '../ui/page-actions'

export default PageContainer;