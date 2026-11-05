import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { APPROVAL_LEVEL_META, APPROVAL_LEVELS, ApprovalLevelView } from '../approval-level';

describe('ApprovalLevelView, editable', () => {
  it('offers the four levels by name, freest first, with the one in force pressed and written before the icons', () => {
    render(<ApprovalLevelView value="ASK_TECHNICIAN" onChange={() => {}} />);
    const options = screen.getAllByRole('button');
    expect(options.map(option => option.getAttribute('aria-label'))).toEqual([
      'Allow',
      'Ask User',
      'Ask Technician',
      'Restrict',
    ]);
    expect(APPROVAL_LEVELS.map(level => APPROVAL_LEVEL_META[level].label)).toEqual(
      options.map(option => option.getAttribute('aria-label')),
    );
    expect(screen.getByRole('button', { name: 'Ask Technician' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByText('Ask Technician')).toBeTruthy();
  });

  it('reports the level picked, and never an empty choice when the one in force is clicked', () => {
    const onChange = vi.fn();
    render(<ApprovalLevelView value="ALLOW" onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: 'Restrict' }));
    expect(onChange).toHaveBeenCalledWith('DENY');
    onChange.mockClear();
    fireEvent.click(screen.getByRole('button', { name: 'Allow' }));
    expect(onChange).not.toHaveBeenCalled();
  });

  it('can hide the written name', () => {
    render(<ApprovalLevelView value="ALLOW" onChange={() => {}} showLabel={false} />);
    expect(screen.queryByText('Allow')).toBeNull();
    expect(screen.getByRole('button', { name: 'Allow' })).toBeTruthy();
  });

  it('shows the group switched off for a locked rule', () => {
    render(<ApprovalLevelView value="ALLOW" editable disabled />);
    expect(screen.getAllByRole('button')).toHaveLength(4);
    expect(screen.getByRole('button', { name: 'Restrict' })).toBeDisabled();
  });
});

describe('ApprovalLevelView, read-only', () => {
  it('draws the icon in the level colour before the name, with no choice to make', () => {
    const { container } = render(<ApprovalLevelView value="DENY" />);
    const name = screen.getByText('Restrict');
    expect(screen.queryByRole('button')).toBeNull();
    expect(name.className).toContain('text-h4');
    const icon = (container.querySelector('svg') as SVGElement).parentElement as HTMLElement;
    expect(icon.className).toContain(APPROVAL_LEVEL_META.DENY.toneClassName);
    expect(icon.compareDocumentPosition(name) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('writes the name in the level colour beside the strip while editing, the level in force primary', () => {
    render(<ApprovalLevelView value="DENY" onChange={() => {}} />);
    expect(screen.getByText('Restrict').className).toContain(APPROVAL_LEVEL_META.DENY.toneClassName);
    const tone = (name: string) =>
      (screen.getByRole('button', { name }).querySelector('svg') as SVGElement).getAttribute('class');
    expect(tone('Restrict')).toContain('text-ods-text-primary');
    expect(tone('Allow')).toContain('text-ods-text-secondary');
  });

  it('keeps the name as the accessible name when it is not written', () => {
    render(<ApprovalLevelView value="DENY" showLabel={false} />);
    expect(screen.getByText('Restrict').className).toContain('sr-only');
  });
});
