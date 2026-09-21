import { cn } from '../../utils/cn';
import { TextSkeleton, UnifiedSkeleton } from './unified-skeleton';

interface CategoryVendorSelectorSkeletonProps {
  /** number of subcategory blocks to render */
  subcategories?: number;
  className?: string;
}

export function CategoryVendorSelectorSkeleton({ subcategories = 3, className }: CategoryVendorSelectorSkeletonProps) {
  return (
    <div
      className={cn('rounded-lg border border-ods-border bg-ods-card p-6', className)}
      role="status"
      aria-label="Loading category section"
    >
      {/* Header */}
      <div className="mb-6 max-w-xl space-y-2">
        <TextSkeleton.Heading className="w-1/2" />
        <TextSkeleton.Body className="w-3/4" />
      </div>

      {/* Subcategory blocks */}
      <div className="space-y-6">
        {Array.from({ length: subcategories }).map((_, idx) => (
          <div key={idx} className="space-y-2">
            {/* Subcategory title */}
            <TextSkeleton.Subheading className="w-1/3" />
            {/* Vendor slots container */}
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
              {Array.from({ length: 2 }).map((__, j) => (
                <UnifiedSkeleton key={j} className="h-20 rounded-lg" />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
