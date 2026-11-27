import { render, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { ProductScreen } from '../components/product-demo/product-screen';
import type { ProductScreenKey } from '../components/product-demo/screen-keys';
import { PRODUCT_SCREEN_READABLE_WIDTH } from '../components/ui/product-screen-frame';

/**
 * CU-17tkuw6ahu7: the product page's other table screens (cloud tenants, logs, policies, scripts) draw the product's
 * grid table in the wide frame, as the Devices screen does, and every column they keep fits the room the screen gives
 * the table at its layout width: a picture cannot scroll, so a column past the edge would sit under the scroll shade.
 * The card-sized (compact) frame keeps the card rows: it is a phone's or a tablet's width, where the grid is cut.
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

/** The screen laid out as a product page lays out its wide pictures (the hero, a capability panel), scaled to 900px. */
function wideScreen(screen: ProductScreenKey) {
  frameWidth(900);
  return render(<ProductScreen screen={screen} height={440} designWidth={PRODUCT_SCREEN_READABLE_WIDTH} />);
}

/** The screen as a carousel card draws it on a phone: the narrow rendering at its real size. */
function compactScreen(screen: ProductScreenKey) {
  frameWidth(340);
  return render(<ProductScreen screen={screen} compact height={300} />);
}

/** The width the frame lays the screen out at before scaling it (the frame's inner box). */
function layoutWidth(container: HTMLElement): number {
  const inner = container.querySelector<HTMLElement>('.product-screen-frame > div');
  return Number.parseFloat(inner?.style.width ?? '');
}

/** The grid's columns, as the widths it sets on its root (`--dtc<n>-w`, one per drawn column). */
function gridColumnWidths(container: HTMLElement): number[] {
  const root = container.querySelector<HTMLElement>('[data-grid-root]');
  if (!root) return [];
  return Array.from(root.style)
    .filter(name => /^--dtc\d+-w$/.test(name))
    .map(name => Number.parseFloat(root.style.getPropertyValue(name)));
}

const sum = (values: number[]) => values.reduce((total, value) => total + value, 0);

/** The table's border, 1px each side, inside the room the screen gives it. */
const TABLE_BORDER = 2;
/** The screens' frame padding at a desktop layout: `--spacing-system-l` (24px) or, for scripts, `-m` (16px). */
const PADDING_L = 24;
const PADDING_M = 16;
/** The logs screen's docked drawer: 400px and its `--spacing-system-m` gap. */
const LOG_DRAWER = 400 + PADDING_M;
/** The scripts screen's code pane: 39% of the content box, then a `--spacing-system-m` gap. */
const SCRIPT_CODE_SHARE = 0.39;

/**
 * Per screen: the room its table has at a layout width (the screen's own chrome taken off), and the columns the grid
 * draws there. Logs keeps when, how bad and what happened beside its drawer; scripts drops the initiator (every run is
 * on behalf of the same person, whom the code pane names).
 */
const WIDE_SCREENS: { screen: ProductScreenKey; room: (layout: number) => number; columns: number }[] = [
  { screen: 'cloud-tenants', room: layout => layout - 2 * PADDING_L - TABLE_BORDER, columns: 4 },
  { screen: 'policies', room: layout => layout - 2 * PADDING_L - TABLE_BORDER, columns: 5 },
  { screen: 'logs', room: layout => layout - LOG_DRAWER - 2 * PADDING_L - TABLE_BORDER, columns: 3 },
  {
    screen: 'scripts',
    room: layout => {
      const content = layout - 2 * PADDING_M;
      return content - content * SCRIPT_CODE_SHARE - PADDING_M - TABLE_BORDER;
    },
    columns: 3,
  },
];

describe('the product demo table screens', () => {
  afterEach(() => {
    if (clientWidth) Object.defineProperty(HTMLElement.prototype, 'clientWidth', clientWidth);
  });

  it.each(WIDE_SCREENS)('$screen draws the grid table in the wide frame', async ({ screen, columns }) => {
    const { container } = wideScreen(screen);
    await waitFor(() => expect(container.querySelector('[data-grid-root]')).not.toBeNull());
    expect(gridColumnWidths(container)).toHaveLength(columns);
  });

  it.each(WIDE_SCREENS)(
    '$screen: every column fits the room its table has at the layout width',
    async ({ screen, room }) => {
      const { container } = wideScreen(screen);
      await waitFor(() => expect(container.querySelector('[data-grid-root]')).not.toBeNull());
      const layout = layoutWidth(container);
      expect(layout).toBeGreaterThan(0);
      expect(sum(gridColumnWidths(container))).toBeLessThanOrEqual(room(layout));
    },
  );

  it('lays the logs screen out wide enough for the time, the status and the message beside the drawer', async () => {
    const { container } = wideScreen('logs');
    await waitFor(() => expect(container.querySelector('[data-grid-root]')).not.toBeNull());
    expect(layoutWidth(container)).toBe(1360);
  });

  it.each(WIDE_SCREENS)('$screen keeps the card rows in the compact frame', async ({ screen }) => {
    const { container } = compactScreen(screen);
    // The screen's code has arrived once the frame holds more than its loading box: the table's rows.
    await waitFor(() => expect(container.querySelector('[data-loading-item]')).not.toBeNull());
    expect(container.querySelector('[data-grid-root]')).toBeNull();
  });
});
