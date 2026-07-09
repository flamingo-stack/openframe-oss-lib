"use client";

/**
 * Aspect-ratio tab + grouping primitives for video surfaces.
 *
 * `RatioTabs` + `RATIO_GRID_CLASS` are ADMIN-ONLY now (VideoBitesEditor,
 * VideoLibraryGrid) — the public grid was replaced by `<VideoBitesStrip>`,
 * which consumes only `detectAspectRatio` + `RATIO_TO_CSS_ASPECT` from here.
 *
 * Why these live here in the lib (not the hub): the strip and the hub's
 * admin editors share the ratio primitives, and the lib is the SSoT.
 */

import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from '../ui/tabs';
import type { VideoTeaser } from '../../types/video-processing';

/**
 * Vizard clip extraction aspect ratios. Mirrors `lib/types/aspect-ratio.ts`
 * in the hub — narrow on purpose. If the hub's `VizardAspectRatio` adds a
 * value, mirror it here.
 */
export type VizardAspectRatio = '9:16' | '16:9' | '1:1';

/**
 * Extended VideoTeaser with aspect_ratio metadata from Vizard.
 * The base `VideoTeaser` carries every other persisted bite field
 * (timing/confidence/viral_reason live there); this adds ONLY the
 * ratio. Import this when you need the ratio at compile time —
 * it is the canonical type display/aggregation code extends.
 */
export interface VideoTeaserWithRatio extends VideoTeaser {
  aspect_ratio?: VizardAspectRatio;
}

/** Ratio category used for grid layout and tab grouping. */
export type RatioCategory = 'portrait' | 'square' | 'landscape';

// Shared tab trigger class — matches `<EntityVideoSection>`'s pattern.
const TAB_TRIGGER_CLASS =
  'rounded-none border-b-2 border-transparent data-[state=active]:border-ods-accent data-[state=active]:bg-transparent data-[state=active]:shadow-none px-4 py-2 text-sm text-ods-text-secondary data-[state=active]:text-ods-text-primary';

/** Grid class for each aspect ratio (admin editors — narrower columns). */
export const RATIO_GRID_CLASS: Record<RatioCategory, string> = {
  portrait: 'grid grid-cols-2 md:grid-cols-3 gap-4',
  square: 'grid grid-cols-2 md:grid-cols-3 gap-4',
  landscape: 'grid grid-cols-1 md:grid-cols-2 gap-4',
};

/** CSS `aspect-ratio` value per category — sizing for strip cards + placeholders. */
export const RATIO_TO_CSS_ASPECT: Record<RatioCategory, string> = {
  portrait: '9 / 16',
  square: '1 / 1',
  landscape: '16 / 9',
};

const RATIO_TAB_CONFIG: { key: RatioCategory; label: string }[] = [
  { key: 'portrait', label: 'Portrait 9:16' },
  { key: 'square', label: 'Square 1:1' },
  { key: 'landscape', label: 'Landscape 16:9' },
];

interface RatioTabsProps {
  groups: Record<RatioCategory, { count: number; render: () => React.ReactNode }>;
  defaultTab?: RatioCategory;
  className?: string;
}

/**
 * RatioTabs — shared aspect-ratio tab wrapper.
 *
 * Only renders tabs that have content. `forceMount` + `data-[state=inactive]:hidden`
 * keeps inactive tabs in the DOM so switching back doesn't scroll-jump.
 */
export function RatioTabs({
  groups,
  defaultTab,
  className = '',
}: RatioTabsProps) {
  const activeTabs = RATIO_TAB_CONFIG.filter(t => groups[t.key].count > 0);

  // If only one tab has content, don't show tabs.
  if (activeTabs.length <= 1) {
    const active = activeTabs[0];
    return active ? <>{groups[active.key].render()}</> : null;
  }

  const firstTab =
    defaultTab && groups[defaultTab].count > 0 ? defaultTab : activeTabs[0].key;

  return (
    <Tabs defaultValue={firstTab} className={`w-full ${className}`}>
      <TabsList className="inline-flex justify-start rounded-none bg-transparent h-auto p-0 gap-0 mb-2">
        {activeTabs.map(t => (
          <TabsTrigger key={t.key} value={t.key} className={TAB_TRIGGER_CLASS}>
            {t.label} ({groups[t.key].count})
          </TabsTrigger>
        ))}
      </TabsList>
      {activeTabs.map(t => (
        <TabsContent
          key={t.key}
          value={t.key}
          forceMount
          className="data-[state=inactive]:hidden"
        >
          {groups[t.key].render()}
        </TabsContent>
      ))}
    </Tabs>
  );
}

/**
 * Detect aspect ratio from a Vizard ratio string, falling back to
 * inferring from width/height if the string is missing or unknown.
 * Default: portrait (`'9:16'`).
 */
export function detectAspectRatio(
  ratioString?: string,
  width?: number,
  height?: number,
): VizardAspectRatio {
  if (ratioString === '16:9') return '16:9';
  if (ratioString === '1:1') return '1:1';
  if (ratioString === '9:16') return '9:16';
  if (width && height) {
    if (Math.abs(width - height) < Math.min(width, height) * 0.1) return '1:1';
    if (width > height) return '16:9';
  }
  return '9:16';
}

/** Map a `VizardAspectRatio` to its `RatioCategory` for grouping. */
export function ratioToCategory(ratio: VizardAspectRatio): RatioCategory {
  if (ratio === '16:9') return 'landscape';
  if (ratio === '1:1') return 'square';
  return 'portrait';
}

/**
 * Group items by aspect ratio into portrait / square / landscape buckets.
 * `hasMultiple` is true when 2+ buckets are non-empty (drives tab vs. flat
 * grid rendering downstream).
 */
export function groupByAspectRatio<T>(
  items: T[],
  getAspectRatio: (item: T) => VizardAspectRatio,
): {
  portrait: T[];
  square: T[];
  landscape: T[];
  hasMultiple: boolean;
} {
  const portrait: T[] = [];
  const square: T[] = [];
  const landscape: T[] = [];
  for (const item of items) {
    const cat = ratioToCategory(getAspectRatio(item));
    if (cat === 'landscape') landscape.push(item);
    else if (cat === 'square') square.push(item);
    else portrait.push(item);
  }
  const filled = [portrait, square, landscape].filter(a => a.length > 0).length;
  return { portrait, square, landscape, hasMultiple: filled > 1 };
}
