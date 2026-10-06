/**
 * The product screens a marketing page can show: key and label. A key is
 * stored by hosts (the hub keeps one per capability), so it is a contract:
 * never rename one, add a new one instead.
 *
 * Leaf module with no React and no loaders, so a host reads it on the server
 * (to validate a stored key, to fill a picker). The loaders are in `registry`.
 */
export const PRODUCT_SCREEN_LABELS = {
  'tickets-board': 'Ticket board',
} as const;

export type ProductScreenKey = keyof typeof PRODUCT_SCREEN_LABELS;

export const PRODUCT_SCREEN_KEYS = Object.keys(PRODUCT_SCREEN_LABELS) as ProductScreenKey[];

export function isProductScreenKey(value: unknown): value is ProductScreenKey {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(PRODUCT_SCREEN_LABELS, value);
}

/** Key and label of every screen, for a picker. */
export const PRODUCT_SCREEN_OPTIONS: readonly { value: ProductScreenKey; label: string }[] = PRODUCT_SCREEN_KEYS.map(
  key => ({ value: key, label: PRODUCT_SCREEN_LABELS[key] }),
);
