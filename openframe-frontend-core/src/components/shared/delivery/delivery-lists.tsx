'use client';

/**
 * DeliveryLists — the delivery section body (two tables: recently
 * completed + active). Reads `search` and `task_type` URL params
 * written by the shared `<DevSectionView>` chrome and refetches on
 * change.
 *
 * Endpoint configuration:
 *   - `completedApiEndpoint` / `inProgressApiEndpoint` are the two
 *     per-bucket GET endpoints. Defaults match the hub's pre-migration
 *     routes (`/api/delivery/completed`, `/api/delivery/in-progress`).
 *
 * Coupling constraint — `searchParamKey` / `taskTypeParamKey`:
 *   These props serve TWO purposes:
 *     1. URL READS — keys this component reads via `useSearchParams()`.
 *        MUST match the consuming chrome's `section.search.paramKey` /
 *        `section.filter.paramKey` (the chrome WRITES the URL params).
 *     2. API WRITES — keys this component sends as query params on the
 *        outbound fetch to `{completedApiEndpoint,inProgressApiEndpoint}`.
 *        The hub API contract uses `'search'` / `'task_type'`; embedders
 *        reverse-proxying those routes must preserve the same names OR
 *        rewrite the inbound query string on the proxy side.
 *
 *   Defaults align with `OPENFRAME_DEV_SECTIONS.delivery.{search.paramKey,filter.paramKey}`
 *   AND the hub API contract, so the OpenFrame zero-config case "just
 *   works". Custom chrome overriding the param keys must override BOTH
 *   ends consistently AND ensure the backend reads the same names.
 */

import { useEffect, useState } from 'react';
import { useSearchParams, useRouter, usePathname } from '../../../embed-shims';
import type { DeliveryResponse } from '../../../types/delivery';
import { DeliveryTable } from './delivery-table';
import { EmptyState } from '../../empty-state';
import { LoadError } from '../../ui/error-state';
import { DEV_SECTION_PARAM_KEYS } from '../../../utils/dev-sections/dev-section-param-keys';
import { contentFetch } from '../../../utils/embed-content-fetch';
import { useScrollToHash } from '../../../hooks/use-scroll-to-hash';

const DEFAULT_COMPLETED_ENDPOINT = '/api/delivery/completed';
const DEFAULT_IN_PROGRESS_ENDPOINT = '/api/delivery/in-progress';
// Param keys sourced from the shared registry (see RoadmapView) — single source for the
// chrome's written `?key=` and this view's read.
const DEFAULT_SEARCH_PARAM_KEY = DEV_SECTION_PARAM_KEYS.search;
const DEFAULT_TASK_TYPE_PARAM_KEY = DEV_SECTION_PARAM_KEYS.deliveryTaskType;

export interface DeliveryListsProps {
  /** GET endpoint for the "Recently Completed" bucket. Default
   *  `/api/delivery/completed`. */
  completedApiEndpoint?: string;
  /** GET endpoint for the "Active Tasks" bucket. Default
   *  `/api/delivery/in-progress`. */
  inProgressApiEndpoint?: string;
  /** URL param key for the search input. MUST match the consuming
   *  chrome's `section.search.paramKey`. Default `'search'`. */
  searchParamKey?: string;
  /** URL param key for the task-type filter. MUST match the consuming
   *  chrome's `section.filter.paramKey`. Default `'task_type'`. */
  taskTypeParamKey?: string;
}

export function DeliveryLists({
  completedApiEndpoint = DEFAULT_COMPLETED_ENDPOINT,
  inProgressApiEndpoint = DEFAULT_IN_PROGRESS_ENDPOINT,
  searchParamKey = DEFAULT_SEARCH_PARAM_KEY,
  taskTypeParamKey = DEFAULT_TASK_TYPE_PARAM_KEY,
}: DeliveryListsProps = {}) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const [data, setData] = useState<DeliveryResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Get filter state from URL
  const searchQuery = searchParams.get(searchParamKey) || '';
  const taskTypeFilter = searchParams.get(taskTypeParamKey) || 'all';

  useEffect(() => {
    async function fetchDeliveryData() {
      try {
        setIsLoading(true);
        setError(null);

        // Build query parameters for filtering. The outbound key names
        // mirror the inbound URL-param keys — see "Coupling constraint"
        // in the file docblock for why.
        const params = new URLSearchParams();
        if (searchQuery) {
          params.set(searchParamKey, searchQuery);
        }
        if (taskTypeFilter && taskTypeFilter !== 'all') {
          params.set(taskTypeParamKey, taskTypeFilter);
        }
        const queryString = params.toString();
        const queryParam = queryString ? `?${queryString}` : '';

        // Fetch completed and in-progress tasks separately with filters
        const [completedResponse, inProgressResponse] = await Promise.all([
          contentFetch(`${completedApiEndpoint}${queryParam}`),
          contentFetch(`${inProgressApiEndpoint}${queryParam}`),
        ]);

        if (!completedResponse.ok || !inProgressResponse.ok) {
          throw new Error('Failed to fetch delivery items');
        }

        const [completedResult, inProgressResult] = await Promise.all([
          completedResponse.json(),
          inProgressResponse.json(),
        ]);

        setData({
          completed: completedResult.items || [],
          inProgress: inProgressResult.items || [],
        });
      } catch (err) {
        console.error('Error fetching delivery items:', err);
        setError('Failed to load delivery items. Please try again later.');
      } finally {
        setIsLoading(false);
      }
    }

    fetchDeliveryData();
  }, [searchQuery, taskTypeFilter, completedApiEndpoint, inProgressApiEndpoint, searchParamKey, taskTypeParamKey]);

  const filteredCompleted = data?.completed || [];
  const filteredInProgress = data?.inProgress || [];

  // Deep-link hash dispatch — `?search=<id>#delivery-<id>` from a chat
  // card or a linked-delivery card on a ticket. Shared hook owns the
  // poll-until-mount + hashchange-listener wiring (same instance used
  // by RoadmapView). 96 matches the sticky-header offset every
  // hash-scroll surface in the app uses.
  useScrollToHash(data, { headerOffset: 96 });

  const showCompleted = true;
  const showInProgress = true;

  const hasActiveFilters = searchQuery !== '' || taskTypeFilter !== 'all';
  const hasResults = (showCompleted && filteredCompleted.length > 0) || (showInProgress && filteredInProgress.length > 0);

  // Error state — consume lib's canonical LoadError so ODS tokens +
  // retry affordance stay in lockstep with every other surface.
  if (error) {
    return (
      <div className="w-full">
        <LoadError message={error} onRetry={() => window.location.reload()} />
      </div>
    );
  }

  return (
    <div className="w-full flex flex-col gap-[40px]">
      {/* Empty state if no results after filtering */}
      {!isLoading && !hasResults && (
        hasActiveFilters ? (
          <EmptyState
            type="search"
            title="No tasks found"
            description="No tasks match your current filters. Try adjusting your search or status filter."
            showCTA={true}
            ctaText="Reset Filters"
            onCtaClick={() => {
              const params = new URLSearchParams(searchParams.toString());
              params.delete(searchParamKey);
              params.delete(taskTypeParamKey);
              router.replace(`${pathname}?${params.toString()}`, { scroll: false });
            }}
          />
        ) : (
          <EmptyState
            type="generic"
            title="No tasks available"
            description="Check back soon for upcoming tasks!"
            showCTA={false}
          />
        )
      )}

      {/* Completed Tasks Table */}
      {showCompleted && (hasResults || isLoading) && (
        <div className="w-full">
          <h3 className="text-h2 text-ods-text-primary tracking-[-0.48px] md:tracking-[-0.56px] lg:tracking-[-0.64px] mb-4">
            Recently Completed<span className="text-ods-accent">:</span>
          </h3>
          <DeliveryTable
            items={filteredCompleted}
            isLoading={isLoading}
          />
        </div>
      )}

      {/* In Progress Tasks Table */}
      {showInProgress && (hasResults || isLoading) && (
        <div className="w-full">
          <h3 className="text-h2 text-ods-text-primary tracking-[-0.48px] md:tracking-[-0.56px] lg:tracking-[-0.64px] mb-4">
            Active Tasks<span className="text-ods-accent">:</span>
          </h3>
          <DeliveryTable
            items={filteredInProgress}
            isLoading={isLoading}
          />
        </div>
      )}
    </div>
  );
}
