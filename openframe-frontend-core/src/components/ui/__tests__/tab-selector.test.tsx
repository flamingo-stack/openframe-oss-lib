import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { TabSelector } from '../tab-selector';

const items = [
  { id: 'a', ariaLabel: 'A', icon: <svg /> },
  { id: 'b', ariaLabel: 'B', icon: <svg /> },
];

describe('TabSelector size', () => {
  it('keeps the full-width strip by default, 48px from content-md', () => {
    render(<TabSelector value="a" onValueChange={() => {}} items={items} />);
    const segment = screen.getByRole('button', { name: 'A' });
    expect((segment.parentElement as HTMLElement).className).toContain('content-md:h-12');
    expect(segment.className).toContain('flex-1');
    expect(segment.querySelector(String.raw`.content-md\:size-5`)).toBeNull();
  });

  it('draws compact as a 40px strip of 32px segments with 16px icons, 44 / 36 / 20 from content-md', () => {
    render(<TabSelector value="a" size="compact" onValueChange={() => {}} items={items} />);
    const segment = screen.getByRole('button', { name: 'A' });
    const strip = segment.parentElement as HTMLElement;
    expect(strip.className).toContain('h-10 content-md:h-11');
    expect(strip.className).not.toContain('content-md:h-12');
    expect(segment.className).toContain('w-8');
    expect(segment.className).toContain('content-md:w-9');
    expect(segment.className).not.toContain('flex-1');
    expect(segment.querySelector(String.raw`.content-md\:size-5`)).not.toBeNull();
  });
});
