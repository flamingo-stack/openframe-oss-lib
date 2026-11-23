import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { StatusBadge } from '../status-badge';

/**
 * A badge is ONE line, as wide as its text: its words never stack (they did by default for `variant="button"`, so
 * "Blocked by an area" drew four lines) and no cell or stretching parent widens it.
 */
describe('StatusBadge is one line, as wide as its text', () => {
  it('keeps a multi-word compact badge on one line', () => {
    render(<StatusBadge variant="button" text="Blocked by an area" />);
    // One text run: stacked words were one element per word, which this query would not find.
    expect(screen.getByText('Blocked by an area')).toHaveClass('truncate');
    expect(screen.getByTitle('Blocked by an area')).toHaveClass('whitespace-nowrap');
  });

  it('fits its text and shortens inside a narrow container, the whole text as its tooltip', () => {
    render(<StatusBadge text="Waiting for review" />);
    expect(screen.getByTitle('Waiting for review')).toHaveClass('w-fit', 'max-w-full', 'min-w-0');
    expect(screen.getByText('Waiting for review')).toHaveClass('min-w-0', 'truncate');
  });
});
