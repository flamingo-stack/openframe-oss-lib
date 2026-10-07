import type { ProductScreenKey } from './screen-keys';
import type { ProductScreenComponent } from './types';

type ProductScreenLoader = () => Promise<{ default: ProductScreenComponent }>;

/**
 * How each screen of `screen-keys` is loaded: the product's own view rendered
 * with a fixture from `./fixtures`, one chunk per screen. The `Record` type
 * makes a key without a loader a compile error.
 */
export const PRODUCT_SCREEN_LOADERS: Record<ProductScreenKey, ProductScreenLoader> = {
  'remote-session': () => import('./screens/remote-session'),
  'software-update': () => import('./screens/software-update'),
  devices: () => import('./screens/devices'),
  policies: () => import('./screens/policies'),
  'cloud-tenants': () => import('./screens/cloud-tenants'),
  'tickets-board': () => import('./screens/tickets-board'),
  logs: () => import('./screens/logs'),
  knowledge: () => import('./screens/knowledge'),
};
