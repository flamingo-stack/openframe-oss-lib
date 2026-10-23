import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { PageActions } from '../page-actions';

// jsdom applies no media or container queries, so every breakpoint branch renders
// at once: these pin WHAT each branch holds, the variants test pins WHEN it shows.
describe('PageActions primary-buttons in a narrow content area', () => {
  it('keeps the accent action a button and folds the other labelled ones into "..."', () => {
    render(
      <PageActions
        variant="primary-buttons"
        actions={[
          { label: 'Cancel', variant: 'outline', onClick: vi.fn() },
          { label: 'Archive', variant: 'outline', onClick: vi.fn() },
          { label: 'Save', variant: 'accent', onClick: vi.fn() },
        ]}
      />,
    );
    // Desktop row, compact row, mobile bottom bar.
    expect(screen.getAllByRole('button', { name: 'Save' })).toHaveLength(3);
    // The folded ones are only in the desktop row and the bottom bar.
    expect(screen.getAllByRole('button', { name: 'Cancel' })).toHaveLength(2);
    expect(screen.getByRole('button', { name: 'More actions' })).toBeInTheDocument();
  });

  it('leaves a single other action a button rather than a one-item menu', () => {
    render(
      <PageActions
        variant="primary-buttons"
        actions={[
          { label: 'Cancel', variant: 'outline', onClick: vi.fn() },
          { label: 'Save', variant: 'accent', onClick: vi.fn() },
        ]}
      />,
    );
    expect(screen.getAllByRole('button', { name: 'Cancel' })).toHaveLength(3);
    expect(screen.queryByRole('button', { name: 'More actions' })).not.toBeInTheDocument();
  });
});
