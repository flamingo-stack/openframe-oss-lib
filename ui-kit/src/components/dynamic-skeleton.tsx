"use client";

import React from 'react';
import { cn } from "../utils/cn";
import { useDynamicTheming } from '../hooks/use-dynamic-theming';
import { useThemeAware } from '../hooks/use-theme-aware';

interface DynamicSkeletonProps {
  /**
   * Type of skeleton animation
   */
  animation?: 'pulse' | 'shimmer' | 'wave' | 'static';
  
  /**
   * Skeleton variant based on content type
   */
  variant?: 'text' | 'avatar' | 'card' | 'button' | 'image' | 'custom';
  
  /**
   * Size preset for common elements
   */
  size?: 'sm' | 'md' | 'lg' | 'xl';
  
  /**
   * Custom dimensions
   */
  width?: string | number;
  height?: string | number;
  
  /**
   * Number of lines for text skeleton
   */
  lines?: number;
  
  /**
   * Platform-aware styling
   */
  platformAware?: boolean;
  
  /**
   * Accessibility enhancements
   */
  includeAriaLabel?: boolean;
  
  /**
   * Custom CSS classes
   */
  className?: string;
  
  /**
   * Child elements (for container skeletons)
   */
  children?: React.ReactNode;
}

const sizePresets = {
  sm: { width: '4rem', height: '1rem' },
  md: { width: '8rem', height: '1.5rem' },
  lg: { width: '12rem', height: '2rem' },
  xl: { width: '16rem', height: '2.5rem' }
};

const variantStyles = {
  text: 'rounded',
  avatar: 'rounded-full aspect-square',
  card: 'rounded-lg',
  button: 'rounded-md',
  image: 'rounded-lg aspect-video',
  custom: ''
};

export function DynamicSkeleton({
  animation = 'shimmer',
  variant = 'text',
  size = 'md',
  width,
  height,
  lines = 1,
  platformAware = true,
  includeAriaLabel = true,
  className,
  children
}: DynamicSkeletonProps) {
  const { platform, isDark, accentColor } = useThemeAware();

  // Calculate dimensions
  const dimensions = React.useMemo(() => {
    if (width || height) {
      return {
        width: typeof width === 'number' ? `${width}px` : width,
        height: typeof height === 'number' ? `${height}px` : height
      };
    }
    
    if (variant === 'avatar') {
      const avatarSize = sizePresets[size].height;
      return { width: avatarSize, height: avatarSize };
    }
    
    return sizePresets[size];
  }, [width, height, size, variant]);

  // Platform-specific skeleton colors
  const platformStyles = React.useMemo(() => {
    if (!platformAware) return {};

    const baseOpacity = isDark ? 0.1 : 0.15;
    const accentOpacity = isDark ? 0.05 : 0.08;

    return {
      '--skeleton-base': `color-mix(in srgb, var(--color-bg-skeleton) ${baseOpacity * 100}%, transparent)`,
      '--skeleton-highlight': `color-mix(in srgb, ${accentColor} ${accentOpacity * 100}%, var(--color-bg-skeleton))`,
      '--skeleton-accent': `color-mix(in srgb, ${accentColor} 10%, transparent)`
    } as React.CSSProperties;
  }, [platformAware, isDark, accentColor]);

  // Animation classes
  const animationClasses = {
    pulse: 'animate-pulse',
    shimmer: 'ods-loading-dynamic',
    wave: 'skeleton-wave',
    static: ''
  };

  // Base skeleton classes
  const baseClasses = cn(
    'bg-ods-skeleton',
    variantStyles[variant],
    animationClasses[animation],
    platformAware && `skeleton-platform-${platform}`,
    className
  );

  // For text skeletons with multiple lines
  if (variant === 'text' && lines > 1) {
    return (
      <div 
        className="space-y-2"
        style={platformStyles}
        role="status"
        aria-label={includeAriaLabel ? "Loading content..." : undefined}
      >
        {Array.from({ length: lines }, (_, index) => (
          <div
            key={index}
            className={cn(
              baseClasses,
              index === lines - 1 && 'w-3/4' // Last line shorter
            )}
            style={{
              ...dimensions,
              width: index === lines - 1 ? '75%' : dimensions.width
            }}
          />
        ))}
      </div>
    );
  }

  // Single skeleton element
  return (
    <div
      className={baseClasses}
      style={{ ...dimensions, ...platformStyles }}
      role="status"
      aria-label={includeAriaLabel ? "Loading content..." : undefined}
    >
      {children}
    </div>
  );
}

/**
 * Pre-configured skeleton for common UI patterns
 */
export const SkeletonPresets = {
  /**
   * Card skeleton with header, content, and actions
   */
  Card: ({ showActions = true, showImage = false }: { showActions?: boolean; showImage?: boolean }) => (
    <div className="bg-ods-card border border-ods-border rounded-lg p-6 space-y-4">
      {showImage && (
        <DynamicSkeleton variant="image" className="w-full h-40" />
      )}
      <div className="space-y-2">
        <DynamicSkeleton variant="text" size="lg" />
        <DynamicSkeleton variant="text" lines={2} size="md" />
      </div>
      {showActions && (
        <div className="flex gap-2 pt-2">
          <DynamicSkeleton variant="button" width="6rem" height="2.5rem" />
          <DynamicSkeleton variant="button" width="4rem" height="2.5rem" />
        </div>
      )}
    </div>
  ),

  /**
   * User profile skeleton
   */
  Profile: () => (
    <div className="flex items-start gap-4 p-4">
      <DynamicSkeleton variant="avatar" size="lg" />
      <div className="flex-1 space-y-2">
        <DynamicSkeleton variant="text" size="lg" width="8rem" />
        <DynamicSkeleton variant="text" size="sm" width="12rem" />
        <DynamicSkeleton variant="text" lines={2} size="md" />
      </div>
    </div>
  ),

  /**
   * Navigation skeleton
   */
  Navigation: ({ items = 5 }: { items?: number }) => (
    <nav className="space-y-2 p-4">
      {Array.from({ length: items }, (_, index) => (
        <div key={index} className="flex items-center gap-3">
          <DynamicSkeleton variant="avatar" size="sm" />
          <DynamicSkeleton variant="text" size="md" />
        </div>
      ))}
    </nav>
  ),

  /**
   * Table skeleton
   */
  Table: ({ rows = 5, columns = 4 }: { rows?: number; columns?: number }) => (
    <div className="space-y-3">
      {/* Header */}
      <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}>
        {Array.from({ length: columns }, (_, index) => (
          <DynamicSkeleton key={`header-${index}`} variant="text" size="md" />
        ))}
      </div>
      {/* Rows */}
      {Array.from({ length: rows }, (_, rowIndex) => (
        <div key={`row-${rowIndex}`} className="grid gap-4" style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}>
          {Array.from({ length: columns }, (_, colIndex) => (
            <DynamicSkeleton key={`cell-${rowIndex}-${colIndex}`} variant="text" size="sm" />
          ))}
        </div>
      ))}
    </div>
  ),

  /**
   * Vendor grid skeleton (specific to the app)
   */
  VendorGrid: ({ items = 6 }: { items?: number }) => (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
      {Array.from({ length: items }, (_, index) => (
        <div key={index} className="bg-ods-card border border-ods-border rounded-lg p-4 space-y-3">
          <div className="flex items-center gap-3">
            <DynamicSkeleton variant="avatar" size="md" />
            <div className="flex-1">
              <DynamicSkeleton variant="text" size="md" width="6rem" />
              <DynamicSkeleton variant="text" size="sm" width="4rem" className="mt-1" />
            </div>
          </div>
          <DynamicSkeleton variant="text" lines={2} size="sm" />
          <div className="flex gap-2">
            <DynamicSkeleton variant="custom" width="3rem" height="1.25rem" className="rounded-full" />
            <DynamicSkeleton variant="custom" width="4rem" height="1.25rem" className="rounded-full" />
          </div>
        </div>
      ))}
    </div>
  ),

  /**
   * Blog post skeleton
   */
  BlogPost: () => (
    <article className="space-y-6">
      <div className="space-y-2">
        <DynamicSkeleton variant="text" size="xl" width="75%" />
        <div className="flex gap-4 text-sm">
          <DynamicSkeleton variant="text" size="sm" width="4rem" />
          <DynamicSkeleton variant="text" size="sm" width="6rem" />
        </div>
      </div>
      <DynamicSkeleton variant="image" className="w-full h-64" />
      <div className="space-y-3">
        {Array.from({ length: 4 }, (_, index) => (
          <DynamicSkeleton key={index} variant="text" lines={3} size="md" />
        ))}
      </div>
    </article>
  )
};

/**
 * Platform-aware loading container that shows different skeletons based on platform
 */
export function PlatformSkeletonContainer({ 
  children, 
  isLoading, 
  skeletonType = 'Card',
  skeletonProps = {}
}: {
  children: React.ReactNode;
  isLoading: boolean;
  skeletonType?: keyof typeof SkeletonPresets;
  skeletonProps?: any;
}) {
  const { platform } = useThemeAware();

  if (!isLoading) {
    return <>{children}</>;
  }

  const SkeletonComponent = SkeletonPresets[skeletonType];

  return (
    <div className={`platform-skeleton skeleton-${platform}`}>
      <SkeletonComponent {...skeletonProps} />
    </div>
  );
}

/**
 * Enhanced skeleton with progressive enhancement
 */
export function ProgressiveSkeleton({
  stages = ['basic', 'detailed', 'interactive'],
  currentStage = 0,
  children,
  ...props
}: DynamicSkeletonProps & {
  stages?: string[];
  currentStage?: number;
}) {
  const { platform } = useThemeAware();

  // Show more detailed skeleton as loading progresses
  const stageConfig = {
    0: { animation: 'pulse' as const, variant: 'text' as const },
    1: { animation: 'shimmer' as const, variant: 'card' as const },
    2: { animation: 'wave' as const, variant: 'custom' as const }
  };

  const config = stageConfig[currentStage as keyof typeof stageConfig] || stageConfig[0];

  return (
    <DynamicSkeleton
      {...props}
      {...config}
      className={cn(
        props.className,
        `skeleton-stage-${currentStage}`,
        `skeleton-platform-${platform}`
      )}
    >
      {children}
    </DynamicSkeleton>
  );
}