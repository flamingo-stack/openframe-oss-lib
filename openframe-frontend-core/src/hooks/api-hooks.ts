// Stub API hooks — no fetching yet. Kept so consuming apps can wire the call
// sites before the real implementation lands.
//
// WARNING: These are placeholder implementations that always return empty
// data with `loading: false` and `error: null`. They perform no real fetching.
// This module MUST NOT be exposed via the package's public `exports` map —
// it is intended for internal/dev wiring only. If real API hooks are needed
// by consumers, implement and export those instead of relying on these stubs.
const NO_CATEGORIES: readonly never[] = Object.freeze([]);
const NO_VENDORS: readonly never[] = Object.freeze([]);

export function useCategories() {
  return { categories: NO_CATEGORIES, loading: false, error: null };
}

export function useVendors() {
  return { vendors: NO_VENDORS, loading: false, error: null };
}

export function useSubcategoryCountByCategory() {
  return { data: {}, loading: false };
}
