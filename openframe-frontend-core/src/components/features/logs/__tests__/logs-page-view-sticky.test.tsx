/**
 * The logs page's sticky search toolbar publishes its measured height
 * (`--sticky-toolbar-h`), so the table header pins flush under it at every width
 * instead of at the desktop toolbar's 96px (a strip of rows showed between the two
 * where the spacing tokens shrink the toolbar).
 */

import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { LogsPageView } from '../logs-page-view';

describe('LogsPageView sticky toolbar', () => {
  it('publishes the toolbar height around the table', () => {
    render(
      <LogsPageView onRefresh={vi.fn()} search="" onSearchChange={vi.fn()} onOpenFilters={vi.fn()}>
        <p>table</p>
      </LogsPageView>,
    );
    expect(screen.getByPlaceholderText('Search for Logs')).toBeInTheDocument();
    // jsdom lays nothing out: the measured height is 0, published all the same.
    expect(document.body.innerHTML).toMatch(/class="contents" style="--sticky-toolbar-h: 0px;"/);
  });
});
