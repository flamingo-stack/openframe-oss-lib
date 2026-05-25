/**
 * Customer Interview entity types — chat card consumer barrel.
 *
 * The canonical CustomerInterview shape already lives in
 * `src/types/customer-interview.ts` (lib). Audit found NO competing
 * definition in the hub — clients have always relied on this lib shape.
 * This module re-exports it for the chat entities barrel.
 */

export type {
  CustomerInterview,
  CustomerInterviewConfig,
  CustomerInterviewFilters,
  CustomerInterviewListResponse,
} from '@/types/customer-interview';
