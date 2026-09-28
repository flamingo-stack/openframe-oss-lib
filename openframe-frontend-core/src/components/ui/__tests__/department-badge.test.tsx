import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { BADGE_PALETTE, pickBadgePaletteColor } from '../../../utils/badge-palette';
import { DepartmentBadge } from '../department-badge';
import { PaletteBadge } from '../palette-badge';
import { statusBadgeVariants } from '../status-badge';

describe('PaletteBadge', () => {
  it('renders a palette key as its ODS colour scheme, with no inline colour', () => {
    render(<PaletteBadge text="Teal" color="cyanSoft" />);
    const badge = screen.getByText('Teal');
    expect(badge).toHaveClass('bg-ods-flamingo-cyan-secondary', 'text-ods-flamingo-cyan');
    expect(badge).not.toHaveAttribute('style');
  });

  it('renders the unfilled default badge for anything outside the palette, a hex included', () => {
    const { rerender } = render(<PaletteBadge text="Other" color="#ff0000" />);
    expect(screen.getByText('Other')).toHaveClass('bg-ods-bg-surface');
    rerender(<PaletteBadge text="Other" color={null} />);
    expect(screen.getByText('Other')).toHaveClass('bg-ods-bg-surface');
    expect(screen.getByText('Other')).not.toHaveAttribute('style');
  });

  it('gives every palette key a distinct ODS colour scheme', () => {
    const classes = BADGE_PALETTE.map(key => statusBadgeVariants({ colorScheme: key, variant: 'button' }));
    expect(new Set(classes).size).toBe(BADGE_PALETTE.length);
    for (const c of classes) expect(c).not.toMatch(/#[0-9a-f]{3,6}/i);
  });
});

describe('DepartmentBadge', () => {
  it("uses the department's stored palette colour, and the empty label without a department", () => {
    const { rerender } = render(<DepartmentBadge department={{ name: 'Marketing', color: 'pink' }} />);
    expect(screen.getByText('Marketing')).toHaveClass('bg-ods-flamingo-pink');
    rerender(<DepartmentBadge department={null} emptyLabel="Unassigned" />);
    expect(screen.getByText('Unassigned')).toHaveClass('bg-ods-bg-surface');
  });
});

describe('pickBadgePaletteColor', () => {
  it('picks a palette key that is not taken', () => {
    const [free, ...taken] = BADGE_PALETTE;
    expect(pickBadgePaletteColor({ avoid: taken, random: () => 0.99 })).toBe(free);
  });

  it('repeats a colour only once every colour is taken', () => {
    expect(BADGE_PALETTE).toContain(pickBadgePaletteColor({ avoid: [...BADGE_PALETTE], random: () => 0.5 }));
  });
});
