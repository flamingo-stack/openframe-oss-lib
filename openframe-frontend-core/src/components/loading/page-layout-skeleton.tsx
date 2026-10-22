import { cn } from '../../utils/cn';
import { CardSkeletonGrid } from './card-skeleton';
import { UnifiedSkeleton, TextSkeleton, InteractiveSkeleton } from './unified-skeleton';

interface PageLayoutSkeletonProps {
  className?: string;
}

/**
 * A whole loading state (a layout or a grid, not a piece of chrome): it announces itself once
 * (`LoadingRegion`). `region={false}` inside another loading region.
 */
interface LoadingLayoutProps extends PageLayoutSkeletonProps {
  /** The loading state announces itself (`LoadingRegion`). `false` inside another loading region. Default `true`. */
  region?: boolean;
}

/**
 * Header skeleton for a page that is still loading: logo, navigation and action placeholders
 */
export function HeaderSkeleton() {
  return (
    <header className="sticky top-0 z-40 flex w-full items-center justify-between border-b border-ods-border bg-ods-card bg-ods-card/95 px-4 py-3 backdrop-blur-sm content-md:px-[80px] content-md:py-[12px]">
      {/* Left: Logo skeleton */}
      <div className="flex min-w-0 flex-1 items-center justify-start">
        <UnifiedSkeleton className="h-[26px] w-[110px] rounded content-md:h-8 content-md:w-[137px]" />
      </div>

      {/* Center: Navigation skeleton - hidden on mobile, visible on desktop */}
      <nav className="hidden min-w-0 flex-1 basis-1/3 items-center justify-center gap-2 content-md:flex">
        <div className="flex items-center gap-2">
          <InteractiveSkeleton.Button className="h-10 w-24" />
          <InteractiveSkeleton.Button className="h-10 w-24" />
          <InteractiveSkeleton.Button className="h-10 w-24" />
        </div>
      </nav>

      {/* Right: Actions skeleton */}
      <div className="flex min-w-0 flex-1 items-center justify-end gap-4">
        {/* Mobile: Show hamburger skeleton */}
        <div className="content-md:hidden">
          <InteractiveSkeleton.Button className="h-10 w-10" />
        </div>

        {/* Desktop: Show action buttons skeletons */}
        <div className="hidden items-center gap-4 content-md:flex">
          <InteractiveSkeleton.Button className="h-10 w-10" />
          <InteractiveSkeleton.Button className="h-10 w-32" />
          <InteractiveSkeleton.Button className="h-10 w-20" />
        </div>
      </div>
    </header>
  );
}

/**
 * Search container skeleton with filters
 */
export function SearchContainerSkeleton({
  className,
  showFilters = true,
}: PageLayoutSkeletonProps & { showFilters?: boolean }) {
  return (
    <div className={cn('space-y-4', className || '')}>
      {/* Search input and button */}
      <div className="flex gap-2 content-md:gap-4">
        <InteractiveSkeleton.Input className="flex-1" />
        <InteractiveSkeleton.Button className="w-32 content-md:w-40" />
      </div>

      {/* Filter chips */}
      {showFilters && (
        <div className="flex flex-wrap gap-2">
          <InteractiveSkeleton.Chip />
          <InteractiveSkeleton.Chip className="w-24" />
          <InteractiveSkeleton.Chip className="w-16" />
          <InteractiveSkeleton.Chip className="w-20" />
        </div>
      )}
    </div>
  );
}

/**
 * Category sidebar skeleton for filtering pages
 */
export function CategorySidebarSkeleton({ className }: PageLayoutSkeletonProps) {
  // Matches the actual MultiLevelNavigation sidebar with folder/file icons, README badges, and chevrons
  const items = [
    { type: 'file', width: 'w-20', hasBadge: false },
    { type: 'folder', width: 'w-24', hasBadge: true },
    { type: 'folder', width: 'w-20', hasBadge: true },
    { type: 'folder', width: 'w-24', hasBadge: true },
    { type: 'folder', width: 'w-16', hasBadge: true },
    { type: 'folder', width: 'w-20', hasBadge: true },
    { type: 'folder', width: 'w-28', hasBadge: true },
    { type: 'folder', width: 'w-16', hasBadge: true },
    { type: 'folder', width: 'w-24', hasBadge: true },
    { type: 'file', width: 'w-28' },
    { type: 'file', width: 'w-36' },
  ];

  return (
    <div className={cn('w-full content-lg:w-[320px]', className)}>
      {/* DATA ROOM label */}
      <UnifiedSkeleton className="mb-4 h-[14px] w-24 rounded" />

      {/* Navigation items — each has card background matching actual MultiLevelNavigation */}
      <div className="space-y-1.5">
        {items.map((item, index) => (
          <div
            key={index}
            className={cn(
              'flex min-h-[50px] items-center justify-between rounded-lg border border-ods-border px-4 py-4',
              index === 0 ? 'bg-ods-accent/20' : 'bg-ods-card',
            )}
          >
            <div className="flex items-center gap-2.5">
              <UnifiedSkeleton className="h-4 w-4 shrink-0 rounded" />
              <UnifiedSkeleton className={`h-[14px] ${item.width} rounded`} />
            </div>
            <div className="flex h-[18px] items-center gap-2">
              {item.hasBadge && <UnifiedSkeleton className="h-[18px] w-14 rounded" />}
              {item.type === 'folder' && <UnifiedSkeleton className="h-4 w-4 rounded" />}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Breadcrumb navigation skeleton
 */
export function BreadcrumbSkeleton({ className }: PageLayoutSkeletonProps) {
  return (
    <div className={cn('mb-6 flex items-center space-x-1', className)}>
      <TextSkeleton.Caption className="w-16" />
      <UnifiedSkeleton variant="default" className="h-4 w-4 rounded-full" />
      <TextSkeleton.Caption className="w-24" />
      <UnifiedSkeleton variant="default" className="h-4 w-4 rounded-full" />
      <TextSkeleton.Caption className="w-32" />
      <UnifiedSkeleton variant="default" className="h-4 w-4 rounded-full" />
      <TextSkeleton.Caption className="w-24" />
    </div>
  );
}

/**
 * ONE breadcrumb link while it loads: a bar the height of the link's line
 * (`text-h6`), for a trail whose links stream in one by one.
 */
export function BreadcrumbLinkSkeleton({ className }: PageLayoutSkeletonProps) {
  return <UnifiedSkeleton as="span" className={cn('inline-block h-5 w-16', className)} />;
}

/**
 * Results header skeleton with count and sorting
 */
export function ResultsHeaderSkeleton({ className }: PageLayoutSkeletonProps) {
  return (
    <div
      className={cn(
        'mb-6 flex flex-col items-start justify-between gap-4 content-md:flex-row content-md:items-center',
        className,
      )}
    >
      <div className="space-y-1">
        <TextSkeleton.Body className="w-48" />
        {/* <TextSkeleton.Caption className="w-32" /> */}
      </div>
    </div>
  );
}

/**
 * Vendor Grid Skeleton - Always displays exactly 12 vendor card skeletons
 * Used for consistent vendor page layout with predictable height
 */
export function VendorGridSkeleton({ className, region = true }: LoadingLayoutProps) {
  return (
    <div className={cn('space-y-6', className)}>
      <CardSkeletonGrid
        count={12}
        variant="vendor"
        region={region}
        className="grid-cols-1 content-md:grid-cols-2 content-lg:grid-cols-3"
      />
    </div>
  );
}
