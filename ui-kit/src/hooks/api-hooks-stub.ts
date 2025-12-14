// Hook injection system for ui-kit to access main project hooks
// This allows ui-kit components to use real API hooks from the consuming project

export type UseVendorsHook = (options?: {
  filtering?: string[];
  pageSize?: number;
  lightweight?: boolean;
}) => {
  data: { vendors: any[]; total: number } | undefined;
  isLoading: boolean;
  error?: any;
};

export type UseSubcategoryCountHook = (categorySlug: string | null) => {
  data: number;
  isLoading: boolean;
  error?: any;
};

// Global hook storage
let useVendorsHook: UseVendorsHook | null = null;
let useSubcategoryCountHook: UseSubcategoryCountHook | null = null;

// Hook setters (called by main project)
export function setUseVendorsHook(hook: UseVendorsHook) {
  useVendorsHook = hook;
}

export function setUseSubcategoryCountHook(hook: UseSubcategoryCountHook) {
  useSubcategoryCountHook = hook;
}

// Hook getters (used by ui-kit components)
export function useVendors(options?: { filtering?: string[]; pageSize?: number; lightweight?: boolean }) {
  if (!useVendorsHook) {
    console.error('🚨 useVendors hook not injected - using stub data. Call setupUIKitHooks() first!');
    return {
      data: { vendors: [], total: 0 },
      isLoading: false,
      error: null
    };
  }
  console.log('✅ useVendors hook called with options:', options);
  return useVendorsHook(options);
}

export function useSubcategoryCountByCategory(categorySlug: string | null) {
  if (!useSubcategoryCountHook) {
    console.warn('useSubcategoryCountByCategory hook not injected - using stub data');
    return {
      data: 0,
      isLoading: false,
      error: null
    };
  }
  return useSubcategoryCountHook(categorySlug);
}