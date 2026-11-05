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
