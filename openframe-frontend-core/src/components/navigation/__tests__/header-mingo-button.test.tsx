/**
 * The top bar's Mingo button: below md (`iconOnly`) a square cell of the bar's width, like
 * every other cell, so its divider lines up with what sits under the bar; its × while open.
 * From md, the fixed 140px labelled cell.
 */

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { HeaderMingoButton } from '../header-mingo-button';

describe('HeaderMingoButton', () => {
  it("is a square cell of the bar's width below md, the close while open", () => {
    const { rerender } = render(<HeaderMingoButton iconOnly />);
    const button = screen.getByRole('button', { name: 'Mingo AI' });
    expect(button).toHaveClass('w-[var(--top-nav-cell,3.5rem)]');
    expect(button).not.toHaveClass('md:w-[140px]');

    rerender(<HeaderMingoButton iconOnly isActive />);
    expect(screen.getByRole('button', { name: 'Close Mingo AI' })).toHaveClass('w-[var(--top-nav-cell,3.5rem)]');
  });

  it('is the 140px labelled cell from md', () => {
    render(<HeaderMingoButton />);
    const button = screen.getByRole('button', { name: 'Mingo AI' });
    expect(button).toHaveClass('md:w-[140px]');
    expect(button).not.toHaveClass('w-[var(--top-nav-cell,3.5rem)]');
    expect(button).toHaveTextContent('Mingo AI');
  });
});
