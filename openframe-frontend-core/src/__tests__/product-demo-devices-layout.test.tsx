import { render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import DevicesScreen from '../components/product-demo/screens/devices';
import { DevicesScreenView } from '../components/product-demo/screens/devices-view';
import { ProductScreenFrame } from '../components/ui/product-screen-frame';

/**
 * CU-17tkuw6af0q: the Devices screen a marketing page shows (the OpenFrame page's hero) draws the product's grid table,
 * as the product's tables now do, at every frame width: scaled to the frame, unscaled at the layout width, and at its
 * real size in the narrow layout under the frame's scale step (a phone), where the columns past the edge are cut.
 */

const clientWidth = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'clientWidth');

/** jsdom lays nothing out: the frame measures `width`, everything else 0. */
function frameWidth(width: number) {
  Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
    configurable: true,
    get(this: HTMLElement) {
      return this.classList.contains('product-screen-frame') ? width : 0;
    },
  });
}

function Picture({ loading = false }: { loading?: boolean }) {
  return (
    <ProductScreenFrame label="Devices" height={520} designWidth={1120} scaleFrom={480}>
      {loading ? <DevicesScreenView loading /> : <DevicesScreen />}
    </ProductScreenFrame>
  );
}

describe('the Devices product screen', () => {
  afterEach(() => {
    if (clientWidth) Object.defineProperty(HTMLElement.prototype, 'clientWidth', clientWidth);
  });

  it.each([
    ['a phone-wide frame, in the narrow layout', 340],
    ['a tablet-wide frame, scaled', 700],
    ['a desktop-wide frame, scaled', 900],
    ['a frame as wide as the layout, unscaled', 1200],
  ])('draws the grid table in %s', (_frame, width) => {
    frameWidth(width);
    const { container } = render(<Picture />);
    const html = container.innerHTML;
    expect(html).toContain('data-grid-root');
    // The rows are the grid body's.
    expect(html.slice(html.indexOf('data-grid-body'))).toContain('data-loading-item');
  });

  it('draws its loading state in the grid table too', () => {
    frameWidth(700);
    const { container } = render(<Picture loading />);
    expect(container.innerHTML).toContain('data-grid-root');
  });
});
