'use client';

import { cn } from '../../utils/cn';
import { UnifiedSkeleton } from '../loading/unified-skeleton';

export interface ContentLoaderProps {
  /**
   * The type of content being loaded
   */
  variant?: 'card' | 'form' | 'detail' | 'list';
  /**
   * Number of items to show in the skeleton
   */
  items?: number;
  /**
   * Show a title skeleton
   */
  showTitle?: boolean;
  /**
   * Additional CSS classes
   */
  className?: string;
  /**
   * Container CSS classes
   */
  containerClassName?: string;
}

/**
 * Unified content loader component that replaces duplicate loading patterns
 * Uses ODS design tokens for consistent theming
 */
export function ContentLoader({
  variant = 'card',
  items = 4,
  showTitle = true,
  className,
  containerClassName,
}: ContentLoaderProps) {
  const renderCardSkeleton = () => (
    <div>
      {showTitle && <UnifiedSkeleton className="mb-6 h-8 w-64 rounded" />}
      <div className="rounded-lg border border-ods-border bg-ods-card p-6">
        <div className="mb-6 grid grid-cols-1 gap-6 content-md:grid-cols-4">
          {Array.from({ length: items }).map((_, i) => (
            <div key={i}>
              <UnifiedSkeleton className="mb-2 h-4 w-20 rounded" />
              <UnifiedSkeleton className="h-6 w-32 rounded" />
            </div>
          ))}
        </div>
        <div className="border-t border-ods-border pt-4">
          <UnifiedSkeleton className="h-4 w-64 rounded" />
        </div>
      </div>
    </div>
  );

  const renderFormSkeleton = () => (
    <div>
      {showTitle && <UnifiedSkeleton className="mb-6 h-8 w-64 rounded" />}
      <div className="rounded-lg bg-ods-card p-6">
        <div className="space-y-4">
          {Array.from({ length: items }).map((_, i) => (
            <div key={i}>
              <UnifiedSkeleton className="mb-2 h-4 w-32 rounded" />
              <UnifiedSkeleton className="h-10 rounded" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const renderDetailSkeleton = () => (
    <div>
      {showTitle && <UnifiedSkeleton className="mb-6 h-8 w-64 rounded" />}
      <div className="rounded-lg border border-ods-border bg-ods-card p-6">
        <div className="grid grid-cols-1 gap-6 content-lg:grid-cols-3">
          <div className="content-lg:col-span-2">
            <UnifiedSkeleton className="mb-4 h-64 rounded" />
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <UnifiedSkeleton key={i} className="h-4 rounded" />
              ))}
            </div>
          </div>
          <div>
            <UnifiedSkeleton className="mb-4 h-32 rounded" />
            <div className="space-y-2">
              {Array.from({ length: items }).map((_, i) => (
                <UnifiedSkeleton key={i} className="h-3 rounded" />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderListSkeleton = () => (
    <div className="space-y-3">
      {showTitle && <UnifiedSkeleton className="mb-6 h-8 w-64 rounded" />}
      {Array.from({ length: items }).map((_, i) => (
        <div key={i} className="rounded-lg border border-ods-border bg-ods-card p-4">
          <div className="flex items-center gap-4">
            <UnifiedSkeleton className="h-12 w-12 rounded" />
            <div className="flex-1">
              <UnifiedSkeleton className="mb-2 h-4 w-3/4 rounded" />
              <UnifiedSkeleton className="h-3 w-1/2 rounded" />
            </div>
            <UnifiedSkeleton className="h-8 w-20 rounded" />
          </div>
        </div>
      ))}
    </div>
  );

  const renderSkeleton = () => {
    switch (variant) {
      case 'form':
        return renderFormSkeleton();
      case 'detail':
        return renderDetailSkeleton();
      case 'list':
        return renderListSkeleton();
      case 'card':
      default:
        return renderCardSkeleton();
    }
  };

  return (
    <div className={cn('p-6', containerClassName)}>
      <div className={cn(className)}>{renderSkeleton()}</div>
    </div>
  );
}

// Export individual skeleton variants for specific use cases
export const CardLoader = (props: Omit<ContentLoaderProps, 'variant'>) => <ContentLoader {...props} variant="card" />;

export const FormLoader = (props: Omit<ContentLoaderProps, 'variant'>) => <ContentLoader {...props} variant="form" />;

export const DetailLoader = (props: Omit<ContentLoaderProps, 'variant'>) => (
  <ContentLoader {...props} variant="detail" />
);

export const ListLoader = (props: Omit<ContentLoaderProps, 'variant'>) => <ContentLoader {...props} variant="list" />;
