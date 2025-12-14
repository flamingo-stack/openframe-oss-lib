// Stub for comparison utilities

export interface ComparisonPricing {
  id?: number;
  vendor_id?: number;
  min?: number;
  max?: number;
  currency?: string;
  model?: string | null;
  price?: number | null;
  unit?: string | null;
  tier?: string | null;
  billing_cycle?: string | null;
  setup_cost?: number | null;
  notes?: string | null;
}

export interface StructuredPricingSummary {
  ranges: ComparisonPricing[];
  primaryModel: string;
  hasFreeTier: boolean;
  classification: string;
}

export function getStructuredPricingSummary(_vendor: any): StructuredPricingSummary {
  return {
    ranges: [{ min: 0, max: 100, currency: 'USD', model: 'per month', unit: 'user' }],
    primaryModel: 'subscription',
    hasFreeTier: false,
    classification: 'commercial'
  };
}