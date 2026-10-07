import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { FeatureList } from '../feature-list';

const STEPS = [
  { title: 'Reads the logs', description: 'From every computer.' },
  { title: 'Fixes what it can', description: 'Tested first.' },
];

describe('FeatureList numbered', () => {
  it('marks the current step and numbers each one', () => {
    render(<FeatureList variant="numbered" items={STEPS} activeIndex={1} />);
    const steps = screen.getAllByRole('listitem');
    expect(steps[0]).toHaveTextContent('1');
    expect(steps[1]).toHaveAttribute('aria-current', 'step');
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('makes each step a button that reports its index, laid out from the left', () => {
    const onSelect = vi.fn();
    render(<FeatureList variant="numbered" items={STEPS} activeIndex={0} onSelect={onSelect} />);
    const buttons = screen.getAllByRole('button');
    expect(buttons).toHaveLength(2);
    expect(buttons[1]).toHaveClass('w-full', 'justify-start', 'items-start', 'text-left');
    expect(buttons[1]).not.toHaveClass('justify-center', 'items-center', 'whitespace-nowrap');
    fireEvent.click(buttons[1]);
    expect(onSelect).toHaveBeenCalledWith(1);
  });
});
