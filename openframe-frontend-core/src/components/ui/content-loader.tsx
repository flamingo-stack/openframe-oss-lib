'use client';

import { cn } from '../../utils/cn';
import { LoadingRegion } from '../loading/loading-region';
import { UnifiedSkeleton } from '../loading/unified-skeleton';
import { LoadingItems } from './loading-scope';

/** Body lines the detail placeholder draws: a typical paragraph. */
const CONTENT_LOADER_SKELETON_LINES = 3;

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
  /** What is loading, read once by a screen reader. Default "Loading". */
  label?: string;
  /** The loading state announces itself (`LoadingRegion`). `false` inside another loading region. Default `true`. */
  region?: boolean;
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
  label = 'Loading',
  region = true,
}: ContentLoaderProps) {
  const renderCardSkeleton = () => (
    <div>
      {showTitle && <UnifiedSkeleton className="mb-6 h-8 w-64 rounded" />}
      <div className="rounded-lg border border-ods-border bg-ods-card p-6">
        <div className="mb-6 grid grid-cols-1 gap-6 content-md:grid-cols-4">
          <LoadingItems count={items}>
            {() => (
              <div data-loading-item>
                <UnifiedSkeleton className="mb-2 h-4 w-20 rounded" />
                <UnifiedSkeleton className="h-6 w-32 rounded" />
              </div>
            )}
          </LoadingItems>
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
          <LoadingItems count={items}>
            {() => (
              <div data-loading-item>
                <UnifiedSkeleton className="mb-2 h-4 w-32 rounded" />
                <UnifiedSkeleton className="h-10 rounded" />
              </div>
            )}
          </LoadingItems>
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
              <LoadingItems count={CONTENT_LOADER_SKELETON_LINES}>
                {() => <UnifiedSkeleton className="h-4 rounded" />}
              </LoadingItems>
            </div>
          </div>
          <div>
            <UnifiedSkeleton className="mb-4 h-32 rounded" />
            <div className="space-y-2">
              <LoadingItems count={items}>
                {() => <UnifiedSkeleton className="h-3 rounded" data-loading-item />}
              </LoadingItems>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderListSkeleton = () => (
    <div className="space-y-3">
      {showTitle && <UnifiedSkeleton className="mb-6 h-8 w-64 rounded" />}
      <LoadingItems count={items}>
        {() => (
          <div className="rounded-lg border border-ods-border bg-ods-card p-4" data-loading-item>
            <div className="flex items-center gap-4">
              <UnifiedSkeleton className="h-12 w-12 rounded" />
              <div className="flex-1">
                <UnifiedSkeleton className="mb-2 h-4 w-3/4 rounded" />
                <UnifiedSkeleton className="h-3 w-1/2 rounded" />
              </div>
              <UnifiedSkeleton className="h-8 w-20 rounded" />
            </div>
          </div>
        )}
      </LoadingItems>
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
    <LoadingRegion label={label} announce={region} className={cn('p-6', containerClassName)}>
      <div className={cn(className)}>{renderSkeleton()}</div>
    </LoadingRegion>
  );
}

// Export individual skeleton variants for specific use cases
export const CardLoader = (props: Omit<ContentLoaderProps, 'variant'>) => <ContentLoader {...props} variant="card" />;

export const FormLoader = (props: Omit<ContentLoaderProps, 'variant'>) => <ContentLoader {...props} variant="form" />;

export const DetailLoader = (props: Omit<ContentLoaderProps, 'variant'>) => (
  <ContentLoader {...props} variant="detail" />
);

export const ListLoader = (props: Omit<ContentLoaderProps, 'variant'>) => <ContentLoader {...props} variant="list" />;
