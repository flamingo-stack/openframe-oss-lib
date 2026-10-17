import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { FeatureCardGrid } from '../feature-card';

const ITEMS = [
  { id: 'hire', title: 'We need more people', content: <p>Today: tickets grow.</p> },
  { id: 'tools', title: 'A tool for every job', content: <p>Today: five tools.</p> },
  { title: 'No id, never pickable', content: <p>Plain.</p> },
];

describe('FeatureCardGrid selection', () => {
  it('draws plain cells when no selection is passed', () => {
    render(<FeatureCardGrid items={ITEMS} />);
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('makes every item with an id a toggle that states whether it is picked', () => {
    render(<FeatureCardGrid items={ITEMS} selection={{ selectedIds: ['tools'], onToggle: () => {} }} />);
    const buttons = screen.getAllByRole('button');
    expect(buttons).toHaveLength(2);
    expect(buttons[0]).toHaveAttribute('aria-pressed', 'false');
    expect(buttons[1]).toHaveAttribute('aria-pressed', 'true');
    expect(buttons[1]).toHaveClass('ring-ods-accent');
  });

  it('reports the tapped item by its id', () => {
    const onToggle = vi.fn();
    render(<FeatureCardGrid items={ITEMS} selection={{ selectedIds: [], onToggle }} />);
    fireEvent.click(screen.getByRole('button', { name: /We need more people/ }));
    expect(onToggle).toHaveBeenCalledWith('hire');
  });

  it('is not pickable while loading', () => {
    render(<FeatureCardGrid items={ITEMS} loading selection={{ selectedIds: [], onToggle: () => {} }} />);
    expect(screen.queryByRole('button')).toBeNull();
  });
});
