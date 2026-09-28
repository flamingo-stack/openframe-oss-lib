// Stub API hooks — no fetching yet. Kept so consuming apps can wire the call
// sites before the real implementation lands.
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
