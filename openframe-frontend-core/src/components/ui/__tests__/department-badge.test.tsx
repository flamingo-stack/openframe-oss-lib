import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { hexToRgb, randomIdentityColor } from '../../../utils/ods-color-utils';
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
  it('returns a #rrggbb colour', () => {
    expect(randomIdentityColor()).toMatch(/^#[0-9a-f]{6}$/);
  });

  it('keeps away from the hues already in use', () => {
    // Every existing colour is red-ish; the pick must land far from red.
    const avoid = ['#d74242', '#d75542', '#d74255'];
    for (let run = 0; run < 20; run++) {
      const rgb = hexToRgb(randomIdentityColor({ avoid })) ?? { r: 255, g: 0, b: 0 };
      expect(rgb.r < rgb.g || rgb.r < rgb.b).toBe(true);
    }
  });
});
