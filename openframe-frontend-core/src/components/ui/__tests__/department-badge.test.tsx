import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { DepartmentBadge, departmentColorScheme } from '../department-badge';

describe('DepartmentBadge', () => {
  it('gives a department the same colour every time, and none without a slug', () => {
    expect(departmentColorScheme('engineering')).toBe(departmentColorScheme('engineering'));
    expect(departmentColorScheme(null)).toBe('default');
    expect(departmentColorScheme('')).toBe('default');
  });

  it('renders the department name, or the empty label', () => {
    const { rerender } = render(<DepartmentBadge department={{ name: 'Marketing', slug: 'marketing' }} />);
    expect(screen.getByText('Marketing')).toBeInTheDocument();
    rerender(<DepartmentBadge department={null} emptyLabel="Unassigned" />);
    expect(screen.getByText('Unassigned')).toBeInTheDocument();
  });
});
