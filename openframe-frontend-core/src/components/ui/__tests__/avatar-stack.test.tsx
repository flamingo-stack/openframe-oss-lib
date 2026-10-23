import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AvatarStack } from '../avatar-stack';

const people = [{ name: 'Ada Lin' }, { name: 'Roman Smith' }, { name: 'Michael Johnson' }];

describe('AvatarStack', () => {
  it('counts the overflow from the people it gets', () => {
    render(<AvatarStack people={[...people, { name: 'Kim Park' }]} max={3} label="Technicians" />);
    expect(screen.getByText('+1')).toHaveAttribute('title', 'Kim Park');
  });

  it('counts everyone not shown when the people are a sample of a larger group', () => {
    render(<AvatarStack people={people} total={7} max={3} label="Technicians" />);
    expect(screen.getByText('+4')).toHaveAttribute('title', '4 more');
    expect(screen.getByRole('group')).toHaveAccessibleName(
      'Technicians: Ada Lin, Roman Smith, Michael Johnson and 4 more',
    );
  });

  it('shows no overflow when the sample is the whole group', () => {
    render(<AvatarStack people={people} total={3} max={3} label="Technicians" />);
    expect(screen.queryByText(/^\+/)).not.toBeInTheDocument();
  });
});
