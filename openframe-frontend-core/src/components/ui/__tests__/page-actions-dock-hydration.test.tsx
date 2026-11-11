/**
 * The phone's bottom bar rises over the composer dock, by the height `AppLayout` measures after it mounts. A page
 * hydrates after the layout (it sits behind its own boundary), so the bar's first client render must still draw what
 * the server sent, with no offset, or React reports a hydration mismatch and keeps the server's attribute.
 */

import { act, render, screen, within } from '@testing-library/react';
import { hydrateRoot } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { ComposerDockHeightContext } from '../../navigation/app-layout-context';
import { PageActions } from '../page-actions';

const page = (dockHeight: number) => (
  <ComposerDockHeightContext.Provider value={dockHeight}>
    <PageActions variant="primary-buttons" actions={[{ label: 'Save', variant: 'accent', onClick: () => {} }]} />
  </ComposerDockHeightContext.Provider>
);

describe('PageActions bottom bar over the composer dock', () => {
  it('a mounted bar sits on the dock', () => {
    render(page(135));
    expect(screen.getByTestId('mobile-action-bar').style.bottom).toBe('135px');
  });

  it('hydrates as the server drew it while the dock is measured already, then rises over it', async () => {
    // The server knows no dock (it is measured on the client).
    const container = document.createElement('div');
    container.innerHTML = renderToString(page(0));
    document.body.appendChild(container);
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {});

    // The layout hydrated first and measured the dock: the page hydrates under a context that already holds it.
    await act(async () => {
      hydrateRoot(container, page(135));
      // Let React finish the hydration's passive effects before the console is read.
      await Promise.resolve();
    });

    const mismatch = errors.mock.calls.some(call => String(call[0]).includes('hydrated but some attributes'));
    errors.mockRestore();
    expect(mismatch).toBe(false);
    expect(within(container).getByTestId('mobile-action-bar').style.bottom).toBe('135px');
    container.remove();
  });
});
