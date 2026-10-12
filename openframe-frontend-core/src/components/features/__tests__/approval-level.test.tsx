import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { APPROVAL_LEVEL_META, APPROVAL_LEVELS, ApprovalLevelView } from '../approval-level';

describe('ApprovalLevelView, editable', () => {
  it('offers the four levels by name, with the one in force checked and written before the icons', () => {
    render(<ApprovalLevelView value="ASK_TECHNICIAN" onChange={() => {}} />);
    const options = screen.getAllByRole('radio');
    expect(options.map(option => option.getAttribute('aria-label'))).toEqual(
      APPROVAL_LEVELS.map(level => APPROVAL_LEVEL_META[level].label),
    );
    expect(screen.getByRole('radio', { name: 'Ask Technician' }).getAttribute('aria-checked')).toBe('true');
    expect(screen.getByText('Ask Technician')).toBeTruthy();
  });

  it('reports the level picked, and never an empty choice when the one in force is clicked', () => {
    const onChange = vi.fn();
    render(<ApprovalLevelView value="ALLOW" onChange={onChange} />);
    fireEvent.click(screen.getByRole('radio', { name: 'Restrict' }));
    expect(onChange).toHaveBeenCalledWith('DENY');
    onChange.mockClear();
    fireEvent.click(screen.getByRole('radio', { name: 'Allow' }));
    expect(onChange).not.toHaveBeenCalled();
  });

  it('can hide the written name', () => {
    render(<ApprovalLevelView value="ALLOW" onChange={() => {}} showLabel={false} />);
    expect(screen.queryByText('Allow')).toBeNull();
    expect(screen.getByRole('radio', { name: 'Allow' })).toBeTruthy();
  });

  it('shows the group switched off for a locked rule', () => {
    render(<ApprovalLevelView value="ALLOW" editable disabled />);
    expect(screen.getAllByRole('radio')).toHaveLength(4);
    expect(screen.getByRole('radio', { name: 'Restrict' })).toBeDisabled();
  });
});

describe('ApprovalLevelView, read-only', () => {
  it('writes the same name in the same colour as the editable form, with no choice to make', () => {
    const { rerender } = render(<ApprovalLevelView value="DENY" />);
    const readOnlyName = screen.getByText('Restrict');
    expect(screen.queryByRole('radio')).toBeNull();
    const readOnlyClass = readOnlyName.className;
    rerender(<ApprovalLevelView value="DENY" onChange={() => {}} />);
    expect(screen.getByText('Restrict').className).toBe(readOnlyClass);
  });

  it('keeps the name as the accessible name when it is not written', () => {
    render(<ApprovalLevelView value="DENY" showLabel={false} />);
    expect(screen.getByText('Restrict').className).toContain('sr-only');
  });
});
