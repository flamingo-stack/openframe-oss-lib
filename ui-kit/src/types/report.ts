// Report related TypeScript interfaces
// This centralizes types used by margin analysis wizard and DAL utilities.

import { StackVendorSelection, UserStack } from "./stack";

// Vendor objects returned with lightweight=true from getVendorsBySlugs

export interface MarginReportCostStructure {
  total_current: number;
  total_alternative: number;
  total_savings: number;
}

export interface MarginReportReplacementEntry {
  current_vendor: any | null;
  alternative_vendor: any | null;
  cost_structure: MarginReportCostStructure;
}

export interface MarginReport {
  id: string;
  cost_structure: MarginReportCostStructure;
  strategic_recommendations: any[]; // TODO: refine types
  openframe_recommendations: any[];
  replacements: MarginReportReplacementEntry[];
  msp_profile?: any;
  share_token?: string;
  is_public?: boolean;
  created_at: string;
}

// Payload when wizard triggers report generation (unchanged for now)
export interface CreateMarginReportPayload {
  mspProfile: any;
  user?: any;
  stack: UserStack;
  currentStack: Record<string, any>;
  manualAltMap: Record<string, any>;
  aiAltMap: Record<string, any>;
  stackVendorsToSlugs: StackVendorSelection[];
  // other dynamic AI prompt fields...
} 