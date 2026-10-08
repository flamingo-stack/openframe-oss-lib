import type { ComponentType } from 'react';

/** What every product screen of the registry takes. */
export interface ProductScreenViewProps {
  /** The narrow rendering: fewer columns, secondary panels hidden. */
  compact?: boolean;
}

/** A product screen module: the product's own view, fed by its fixture. */
export type ProductScreenComponent = ComponentType<ProductScreenViewProps>;
