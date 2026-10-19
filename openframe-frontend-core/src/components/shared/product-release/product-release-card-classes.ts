import { MEDIA_ASPECT } from '../../../styles/component-sizes';
/**
 * The large product-release card's layout, ONE copy read by `ProductReleaseCard` and `ProductReleaseCardSkeleton`,
 * so the skeleton is the card's size at every width.
 */
export const RELEASE_CARD_LG_FRAME_CLASS = 'flex flex-col gap-4 p-6';
export const RELEASE_CARD_HERO_CLASS = 'flex flex-col gap-4 content-md:flex-row content-md:gap-6';
export const RELEASE_CARD_COVER_COLUMN_CLASS = 'w-full flex-shrink-0 content-md:w-[256px]';
export const RELEASE_CARD_COVER_BOX_CLASS = `relative ${MEDIA_ASPECT.og} w-full overflow-hidden rounded-lg`;
export const RELEASE_CARD_TEXT_COLUMN_CLASS = 'flex min-w-0 flex-1 flex-col';
export const RELEASE_CARD_VERSION_ROW_CLASS = 'mb-3 flex items-center gap-3';
export const RELEASE_CARD_VERSION_CLASS = 'truncate font-semibold text-ods-text-primary text-code';
/** The title's box reserves two lines of the title's own type (`2lh`), the summary's three. */
export const RELEASE_CARD_TITLE_BOX_CLASS = 'mb-3 flex min-h-[2lh] items-start text-h2';
export const RELEASE_CARD_TITLE_CLASS = 'line-clamp-2 text-h2 text-ods-text-primary';
export const RELEASE_CARD_SUMMARY_BOX_CLASS = 'min-h-[3lh] text-h4';
export const RELEASE_CARD_SUMMARY_CLASS = 'line-clamp-3 text-h4 text-ods-text-secondary';
export const RELEASE_CARD_CHANGELOG_CLASS =
  'flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-ods-border pt-3 text-ods-text-secondary text-h6';
export const RELEASE_CARD_GRID_CLASS =
  'grid grid-cols-1 content-md:grid-cols-4 w-full overflow-hidden rounded-md border border-ods-border';
export const RELEASE_CARD_CELL_DIVIDER_CLASS = 'border-b content-md:border-b-0 content-md:border-r border-ods-border';
export const RELEASE_CARD_CELL_CLASS = 'flex flex-col gap-3 p-4';
/** The value over its label: only stacks, so a one-column grid, not a second column flexbox (WEBVIEW-001). */
export const RELEASE_CARD_CELL_STACK_CLASS = 'grid grid-cols-1 gap-0';
export const RELEASE_CARD_CELL_LABEL_CLASS = 'text-ods-text-secondary text-h6';
/** The grid's three value cells' labels (static copy). */
export const RELEASE_CARD_CELL_LABELS = ['Type', 'Status', 'Released'] as const;
