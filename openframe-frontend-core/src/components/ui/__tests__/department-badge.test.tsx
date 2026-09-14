import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { COLOR_PRESETS, pickPresetColor } from '../../../utils/color-presets';
import { DepartmentBadge } from '../department-badge';
import { PaletteBadge } from '../palette-badge';

describe('PaletteBadge', () => {
  it('fills the badge with the palette colour a key names', () => {
    render(<PaletteBadge text="Teal" color="teal" />);
    expect(screen.getByText('Teal')).toHaveStyle({ backgroundColor: 'rgb(77, 182, 172)' });
  });

  it('renders neutral for an unknown colour', () => {
    render(<PaletteBadge text="Other" color="not-a-colour" />);
    expect(screen.getByText('Other')).not.toHaveAttribute('style');
  });
});

describe('DepartmentBadge', () => {
  it("uses the department's stored palette colour, and the empty label without a department", () => {
    const { rerender } = render(<DepartmentBadge department={{ name: 'Marketing', color: 'sky' }} />);
    expect(screen.getByText('Marketing')).toHaveStyle({ backgroundColor: 'rgb(79, 195, 247)' });
    rerender(<DepartmentBadge department={null} emptyLabel="Unassigned" />);
    expect(screen.getByText('Unassigned')).not.toHaveStyle({ backgroundColor: 'rgb(79, 195, 247)' });
  });
});

describe('pickPresetColor', () => {
  it('picks a palette key that is not taken, and never neutral', () => {
    const keys = COLOR_PRESETS.map(preset => preset.key);
    const taken = keys.filter(key => key !== 'teal' && key !== 'neutral');
    for (let run = 0; run < 10; run++) expect(pickPresetColor({ avoid: taken })).toBe('teal');
  });

  it('repeats a colour only once every colour is taken', () => {
    const everything = COLOR_PRESETS.map(preset => preset.key);
    expect(everything).toContain(pickPresetColor({ avoid: everything }));
    expect(pickPresetColor({ avoid: everything })).not.toBe('neutral');
  });
});
