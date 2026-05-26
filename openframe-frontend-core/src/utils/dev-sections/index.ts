/**
 * Dev-sections registry barrel.
 *
 * `RELEASE_STATUS_OPTIONS` (the hub's old alias) is deliberately NOT
 * re-exported — embedders that need the release-status options should
 * import `releaseStatusOptions` from `@flamingo-stack/openframe-frontend-core/types`
 * directly. That matches lib's existing canonical export name and
 * avoids one-way alias drift.
 */

export {
  OPENFRAME_DEV_SECTIONS,
  ROADMAP_STATUS_OPTIONS,
  DELIVERY_TASK_TYPE_OPTIONS,
  type OpenframeDevSection,
  type OpenframeDevSectionKey,
} from './openframe-dev-sections'
