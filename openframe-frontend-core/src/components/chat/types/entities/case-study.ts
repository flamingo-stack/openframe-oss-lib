/**
 * Case Study entity types — chat card consumer barrel.
 *
 * The canonical CaseStudy shape already lives in `src/types/case-study.ts`
 * (lib). Audit found NO competing definition in the hub — clients have
 * always relied on this lib shape. This module re-exports it for the
 * chat entities barrel.
 */

export type {
  CaseStudy,
  CaseStudyFilters,
  CaseStudyListResponse,
} from '@/types/case-study';
