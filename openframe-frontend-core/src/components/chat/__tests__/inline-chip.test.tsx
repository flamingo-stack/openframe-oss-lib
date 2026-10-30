import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { InlineChip } from '../inline-chip';

describe('InlineChip', () => {
  it('draws its label in the inline box', () => {
    render(<InlineChip label="Devices → Add Device" />);
    expect(screen.getByTestId('inline-chip')).toHaveTextContent('Devices → Add Device');
  });
});
