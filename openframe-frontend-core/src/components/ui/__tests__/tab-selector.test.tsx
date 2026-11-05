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
    expect(segment.querySelector('.size-5')).toBeNull();
  });

  it('draws compact as a 44px strip of 36px segments with 20px icons', () => {
    render(<TabSelector value="a" size="compact" onValueChange={() => {}} items={items} />);
    const segment = screen.getByRole('button', { name: 'A' });
    const strip = segment.parentElement as HTMLElement;
    expect(strip.className).toContain('h-11');
    expect(strip.className).not.toContain('content-md:h-12');
    expect(segment.className).toContain('w-9');
    expect(segment.className).not.toContain('flex-1');
    expect(segment.querySelector('.size-5')).not.toBeNull();
  });
});
