// Report related TypeScript interfaces
// This centralizes types used by margin analysis wizard and DAL utilities.

import type { MSP, StackVendorSelection, UserStack } from './stack';
import type { UserProfile } from './user';
import type { Vendor } from './vendor';

/**
 * Vendor row embedded in a margin report — what `getVendorsBySlugs(slugs, true)`
 * returns. Identical to `Vendor` apart from the two audit columns the
 * lightweight select omits.
 */
export type MarginReportVendor = Omit<Vendor, 'created_by' | 'updated_by'>;

export interface MarginReportCostStructure {
  total_current: number;
  total_alternative: number;
  total_savings: number;
}

export interface MarginReportReplacementEntry {
  current_vendor: MarginReportVendor | null;
  alternative_vendor: MarginReportVendor | null;
  cost_structure: MarginReportCostStructure;
}

/** One AI-generated recommendation card (strategic + OpenFrame sections). */
export interface MarginReportRecommendation {
  title: string;
  body: string;
  metric_label?: string | null;
  metric_value?: string | null;
  /** Glyph name — OpenFrame recommendation cards only. */
  icon?: string | null;
}

/**
 * Category slug → subcategory slug → vendor slug (null when the wizard left
 * the slot empty). The shape the margin-analysis trigger builds from the
 * user's stack selections.
 */
export type StackSlugMap = Record<string, Record<string, string | null>>;

export interface MarginReport {
  id: string;
  cost_structure: MarginReportCostStructure;
  strategic_recommendations: MarginReportRecommendation[];
  openframe_recommendations: MarginReportRecommendation[];
  replacements: MarginReportReplacementEntry[];
  msp_profile?: MSP;
  share_token?: string;
  is_public?: boolean;
  created_at: string;
}

// Payload when wizard triggers report generation (unchanged for now)
export interface CreateMarginReportPayload {
  mspProfile: MSP;
  user?: UserProfile;
  stack: UserStack;
  currentStack: StackSlugMap;
  manualAltMap: StackSlugMap;
  aiAltMap: StackSlugMap;
  stackVendorsToSlugs: StackVendorSelection[];
  // other dynamic AI prompt fields...
}
