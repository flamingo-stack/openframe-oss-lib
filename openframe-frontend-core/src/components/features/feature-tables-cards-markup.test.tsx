import { render } from '@testing-library/react';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { FEATURE_TABLE_CASES, IdleIntersectionObserver } from './feature-tables.fixtures';

/**
 * The card layout of every feature table that draws a `DataTable`, locked as markup: loaded, loading and empty.
 *
 * These snapshots were recorded BEFORE the tables learned the grid layout (`layout`, `tableMaxHeight`,
 * `tableSettings`), and that change left them untouched: a table that is not asked for the grid renders what it
 * rendered before. A table that moves to the grid keeps its card rows below `md`, so its snapshot here still holds;
 * update one only for a change that means to alter the card layout.
 */
describe('feature tables, card layout (the default)', () => {
  beforeAll(() => vi.stubGlobal('IntersectionObserver', IdleIntersectionObserver));
  afterAll(() => vi.unstubAllGlobals());

  it.each(FEATURE_TABLE_CASES)('$name', ({ element }) => {
    const { container } = render(element);
    expect(container.innerHTML).not.toContain('data-grid-');
    expect(container).toMatchSnapshot();
  });
});
