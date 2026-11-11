import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { RadioGroupBlock } from '../radio-group';

describe('RadioGroupBlock trailing control', () => {
  it('keeps the row unlit while the pointer is on its trailing control', () => {
    render(
      <RadioGroupBlock
        name="templates"
        value="a"
        onValueChange={() => {}}
        options={[{ value: 'a', label: 'Option A', trailing: <button type="button">Act</button> }]}
      />,
    );
    const row = screen.getByText('Option A').closest('label') as HTMLElement;
    expect(row.className).toContain('hover:bg-ods-bg-hover');
    expect(row.className).toContain('[&:has([data-radio-trailing]_:hover)]:bg-ods-card');
    expect(screen.getByRole('button', { name: 'Act' }).closest('[data-radio-trailing]')).not.toBeNull();
  });
});

describe('RadioGroupBlock rows added later', () => {
  it('fades in a row added after the first options, and only that row', () => {
    const optionA = { value: 'a', label: 'Option A' };
    const { rerender } = render(<RadioGroupBlock name="t" value="a" onValueChange={() => {}} options={[optionA]} />);
    expect((screen.getByText('Option A').closest('label') as HTMLElement).className).not.toContain('animate-in');

    rerender(
      <RadioGroupBlock
        name="t"
        value="a"
        onValueChange={() => {}}
        options={[optionA, { value: 'b', label: 'Option B' }]}
      />,
    );
    expect((screen.getByText('Option B').closest('label') as HTMLElement).className).toContain('animate-in');
    expect((screen.getByText('Option A').closest('label') as HTMLElement).className).not.toContain('animate-in');
  });

  it('does not fade the first options in after the skeleton', () => {
    const { rerender } = render(<RadioGroupBlock name="t" value="" onValueChange={() => {}} options={[]} loading />);
    rerender(
      <RadioGroupBlock name="t" value="a" onValueChange={() => {}} options={[{ value: 'a', label: 'Option A' }]} />,
    );
    expect((screen.getByText('Option A').closest('label') as HTMLElement).className).not.toContain('animate-in');
  });
});
