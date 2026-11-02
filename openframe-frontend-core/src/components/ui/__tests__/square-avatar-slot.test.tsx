import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Autocomplete } from '../autocomplete';
import { SquareAvatar } from '../square-avatar';

/**
 * An avatar keeps its picture's size and fit in a slot that sizes the images under it: a field's start
 * adornment draws every image there as a 16/24px icon (`[&_img]:size-4`, `object-contain`), which shrank an
 * employee's photo to a corner of its circle. The avatar's own classes win (important), whatever the slot.
 * jsdom has no Tailwind: the classes are the contract.
 */
describe('SquareAvatar in a slot that sizes its images', () => {
  const classesOf = (img: HTMLElement) => img.getAttribute('class')?.split(/\s+/) ?? [];

  it("fills its frame with a portrait as the field's start adornment", () => {
    render(
      <Autocomplete
        options={[{ value: 'u-1', label: 'Ann Lee' }]}
        value="u-1"
        onChange={() => {}}
        startAdornment={<SquareAvatar src="/avatars/ann.png" alt="Ann Lee" size="sm" variant="round" />}
      />,
    );
    const img = screen.getByRole('img', { name: 'Ann Lee' });
    // The field's slot still sizes the images it draws as icons.
    expect(document.body.innerHTML).toContain('[&amp;_img]:size-4');
    expect(classesOf(img)).toEqual(
      expect.arrayContaining(['!h-[calc(100%+2px)]', '!w-[calc(100%+2px)]', '!object-cover']),
    );
  });

  it('fits a logo whole, padded or not', () => {
    render(<SquareAvatar src="/logos/acme.png" alt="Acme" fit="contain" padded />);
    expect(classesOf(screen.getByRole('img', { name: 'Acme' }))).toEqual(
      expect.arrayContaining(['!h-full', '!w-full', '!object-contain']),
    );
  });
});
