import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { APPROVAL_LEVEL_META, APPROVAL_LEVELS, ApprovalLevelControl, ApprovalLevelMark } from '../approval-level';

describe('ApprovalLevelControl', () => {
  it('offers the four levels by name, with the one in force checked and written beside the icons', () => {
    render(<ApprovalLevelControl value="ASK_TECHNICIAN" onChange={() => {}} />);
    const options = screen.getAllByRole('radio');
    expect(options.map(option => option.getAttribute('aria-label'))).toEqual(
      APPROVAL_LEVELS.map(level => APPROVAL_LEVEL_META[level].label),
    );
    expect(screen.getByRole('radio', { name: 'Ask Technician' }).getAttribute('aria-checked')).toBe('true');
    expect(screen.getByText('Ask Technician')).toBeTruthy();
  });

  it('reports the level picked, and never an empty choice when the one in force is clicked', () => {
    const onChange = vi.fn();
    render(<ApprovalLevelControl value="ALLOW" onChange={onChange} />);
    fireEvent.click(screen.getByRole('radio', { name: 'Restrict' }));
    expect(onChange).toHaveBeenCalledWith('DENY');
    onChange.mockClear();
    fireEvent.click(screen.getByRole('radio', { name: 'Allow' }));
    expect(onChange).not.toHaveBeenCalled();
  });

  it('can hide the written name', () => {
    render(<ApprovalLevelControl value="ALLOW" onChange={() => {}} showLabel={false} />);
    expect(screen.queryByText('Allow')).toBeNull();
    expect(screen.getByRole('radio', { name: 'Allow' })).toBeTruthy();
  });
});

describe('ApprovalLevelMark', () => {
  it('writes the level beside its icon, or keeps it as the accessible name when icon only', () => {
    const { rerender } = render(<ApprovalLevelMark level="DENY" />);
    expect(screen.getByText('Restrict')).toBeTruthy();
    rerender(<ApprovalLevelMark level="DENY" iconOnly />);
    expect(screen.getByText('Restrict').className).toContain('sr-only');
  });
});
