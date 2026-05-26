'use client';

import { StatusBadge } from '../../ui';
import { getStatusColorScheme } from '../../../utils';
import {
  type DeliveryItem,
  TASK_TYPE_LABELS,
  TASK_TYPE_TEXT_COLORS,
} from '../../../types/delivery';

interface DeliveryTableProps {
  items: DeliveryItem[];
  isLoading?: boolean;
}

/**
 * Format relative time for display
 */
function getRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const weeks = Math.floor(days / 7);
  const months = Math.floor(days / 30);

  if (months > 0) {
    return months === 1 ? 'last month' : `${months} months ago`;
  }
  if (weeks > 0) {
    return weeks === 1 ? 'last week' : `${weeks} weeks ago`;
  }
  if (days > 0) {
    return days === 1 ? 'yesterday' : `${days} days ago`;
  }
  return 'today';
}

/**
 * Skeleton loader for rows - matching responsive structure
 */
function SkeletonRow() {
  return (
    <div className="border-b border-ods-border last:border-b-0 p-[12px] md:p-[16px]">
      <div className="flex flex-col md:flex-row items-start justify-between gap-[12px] md:gap-[16px] w-full">
        {/* Left: Title, subtitle, and description skeleton */}
        <div className="flex-1 min-w-0 w-full md:w-auto flex flex-col gap-[12px] md:gap-[16px]">
          {/* Title skeleton - responsive */}
          <div className="min-h-[24px] flex items-center">
            <div className="h-[20px] bg-ods-border rounded animate-pulse w-full"></div>
          </div>
          {/* Subtitle skeleton - 1 line */}
          <div className="min-h-[20px] flex items-center">
            <div className="h-[20px] bg-ods-border rounded animate-pulse w-1/2"></div>
          </div>
          {/* Description skeleton - 3 lines */}
          <div className="min-h-[72px] flex items-center">
            <div className="flex-1 space-y-1">
              <div className="h-[20px] bg-ods-border rounded animate-pulse w-full"></div>
              <div className="h-[20px] bg-ods-border rounded animate-pulse w-full"></div>
              <div className="h-[20px] bg-ods-border rounded animate-pulse w-2/3"></div>
            </div>
          </div>
        </div>

        {/* Right: Badge skeleton - two stacked badges */}
        <div className="flex-shrink-0 self-start flex flex-col gap-2">
          <div className="h-[32px] w-[100px] bg-ods-border rounded animate-pulse"></div>
          <div className="h-[32px] w-[120px] bg-ods-border rounded animate-pulse"></div>
        </div>
      </div>
    </div>
  );
}

/**
 * DeliveryTable Component
 * Displays bug fixes and enhancements with fixed-height rows
 */
export function DeliveryTable({ items, isLoading = false }: DeliveryTableProps) {
  // Show skeletons while loading
  if (isLoading) {
    return (
      <div className="bg-ods-card border border-ods-border rounded-[6px] overflow-hidden w-full">
        <div className="w-full">
          {[1, 2, 3, 4, 5].map((i) => (
            <SkeletonRow key={i} />
          ))}
        </div>
      </div>
    );
  }

  // Empty state
  if (items.length === 0) {
    return (
      <div className="bg-ods-card border border-ods-border rounded-[6px] p-[40px] text-center w-full">
        <p className="text-ods-text-secondary text-[14px] font-['DM_Sans'] font-medium">
          No tasks available
        </p>
      </div>
    );
  }

  return (
    <div className="bg-ods-card border border-ods-border rounded-[6px] overflow-hidden w-full">
      <div className="w-full">
        {items.map((item, index) => {
          // Get task type badge label and text color
          const taskType = item.taskType as keyof typeof TASK_TYPE_LABELS;
          const typeBadgeLabel = TASK_TYPE_LABELS[taskType] || 'TASK';
          const typeBadgeTextColor = TASK_TYPE_TEXT_COLORS[taskType] || '';

          // Get status badge color scheme using centralized utility
          const statusBadgeScheme = getStatusColorScheme(item.status);

          // Calculate relative time from last activity (dateUpdated)
          const relativeTime = getRelativeTime(item.dateUpdated);

          return (
            <div
              key={item.id}
              className={`border-b border-ods-border last:border-b-0 p-[12px] md:p-[16px] ${index === 0 ? '' : ''}`}
            >
              <div className="flex flex-col md:flex-row items-start justify-between gap-[12px] md:gap-[16px] w-full">
                {/* Left: Title, subtitle, and description - matching roadmap-card.tsx structure */}
                <div className="flex-1 min-w-0 w-full md:w-auto flex flex-col gap-[12px] md:gap-[16px]">
                  {/* Title: 2 lines on mobile, 1 line on desktop */}
                  <div className="min-h-[24px] md:min-h-[24px] flex items-center">
                    <h3 className="text-h3 text-ods-text-primary tracking-[-0.36px] flex-1 line-clamp-2 md:truncate break-words">
                      {item.title}
                    </h3>
                  </div>

                  {/* Subtitle: 1 line with last activity date, list name(s), task ID - Azeret Mono.
                      A task can live in multiple ClickUp lists ("Tasks in Multiple Lists" feature) —
                      we render every list joined by ", ". */}
                  <div className="min-h-[20px] flex items-center">
                    <p className="text-h5 text-ods-text-secondary uppercase tracking-[-0.28px] truncate">
                      ACTIVE {relativeTime}{item.listNames.length > 0 ? `, ${item.listNames.join(', ')}` : ''}, {item.id}
                    </p>
                  </div>

                  {/* Description: 3 lines max, 72px height with vertical centering - matching roadmap */}
                  <div className="min-h-[72px] flex items-center">
                    <p className="text-h4 text-ods-text-secondary line-clamp-3 break-words">
                      {item.description || 'No description provided'}
                    </p>
                  </div>
                </div>

                {/* Right: Status and Type badges stacked vertically */}
                <div className="flex-shrink-0 self-start flex flex-col gap-2">
                  {/* Status Badge - matching roadmap cards */}
                  <StatusBadge
                    text={item.status.toUpperCase()}
                    colorScheme={statusBadgeScheme}
                    variant="card"
                    className="border border-ods-border"
                  />
                  {/* Task Type Badge - same style as Version badge in roadmap */}
                  <StatusBadge
                    text={typeBadgeLabel}
                    variant="card"
                    className={`border border-ods-border ${typeBadgeTextColor}`}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
