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

// TODO: NOT FOR PRODUCTION USE — this stub ignores the `_vendor` argument and
// always returns the same fixed pricing summary. It exists as a placeholder
// pending a real implementation that derives the summary from the given
// vendor. Any production consumer relying on this will show identical,
// incorrect pricing data for every vendor.
export function getStructuredPricingSummary(_vendor: unknown): StructuredPricingSummary {
  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'getStructuredPricingSummary: stub implementation must not be used in production'
    );
  }
  return {
    ranges: [{ min: 0, max: 100, currency: 'USD', model: 'per month', unit: 'user' }],
    primaryModel: 'subscription',
    hasFreeTier: false,
    classification: 'commercial',
  };
}
