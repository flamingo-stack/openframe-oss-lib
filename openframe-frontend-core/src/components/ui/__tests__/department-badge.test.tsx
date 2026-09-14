import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { randomIdentityColor } from '../../../utils/ods-color-utils';
import { DepartmentBadge } from '../department-badge';

describe('DepartmentBadge', () => {
  it("fills the badge with the department's stored colour and a readable label", () => {
    render(<DepartmentBadge department={{ name: 'Marketing', color: '#1e88e5' }} />);
    expect(screen.getByText('Marketing')).toHaveStyle({ backgroundColor: 'rgb(30, 136, 229)' });
  });

  it('renders neutral without a valid colour, and the empty label without a department', () => {
    const { rerender } = render(<DepartmentBadge department={{ name: 'Design', color: 'not-a-colour' }} />);
    expect(screen.getByText('Design')).not.toHaveAttribute('style');
    rerender(<DepartmentBadge department={null} emptyLabel="Unassigned" />);
    expect(screen.getByText('Unassigned')).toBeInTheDocument();
  });
});

describe('randomIdentityColor', () => {
  it('returns a #rrggbb colour whose only random input is the hue', () => {
    expect(randomIdentityColor(() => 0)).toMatch(/^#[0-9a-f]{6}$/);
    expect(randomIdentityColor(() => 0)).not.toBe(randomIdentityColor(() => 0.5));
  });
});
