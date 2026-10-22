import { render, screen } from '@testing-library/react';
import { createRef } from 'react';
import { describe, expect, it } from 'vitest';

import { BUTTON_KIND_CLASS, Button } from '../button';
import { Label } from '../label';

/**
 * Every clickable element in the lib is a `Button` and every label a `Label`. A control that is not a plain push
 * button is one of the Button's KINDS (`field`, `row`, `tab`, `chip`, `card`, `cell`): the kind owns the whole look, a
 * call site adds layout only, and the state comes from the element's attributes.
 */
describe('Button kinds', () => {
  it.each(Object.keys(BUTTON_KIND_CLASS) as (keyof typeof BUTTON_KIND_CLASS)[])(
    '`%s` draws its own box, keeps the element and adds the layout a site passes',
    kind => {
      const ref = createRef<HTMLButtonElement>();
      render(
        <Button variant={kind} ref={ref} type="button" data-state="active" className="w-full" disabled>
          Item
        </Button>,
      );
      const button = screen.getByRole('button', { name: 'Item' });
      expect(button).toBe(ref.current);
      expect(button).toBeDisabled();
      expect(button.getAttribute('data-state')).toBe('active');
      expect(button.className).toContain('w-full');
      // A kind never gets a push button's size box.
      expect(button.className).not.toContain('h-11 px-[var(--spacing-system-m)]');
    },
  );

  it('a row is marked selected through `data-state`, never a site class', () => {
    expect(BUTTON_KIND_CLASS.row).toContain('data-[state=active]:bg-ods-bg-active');
    expect(BUTTON_KIND_CLASS.tab).toContain('data-[state=active]:text-ods-text-primary');
    expect(BUTTON_KIND_CLASS.field).toContain('data-[invalid]:border-ods-error');
  });
});

describe('Label variant="surface"', () => {
  it('is a label with no typography of its own', () => {
    render(
      <Label variant="surface" htmlFor="x" className="flex gap-2" data-testid="surface">
        <input id="x" aria-label="x" />
      </Label>,
    );
    const label = screen.getByTestId('surface');
    expect(label.tagName).toBe('LABEL');
    expect(label.getAttribute('for')).toBe('x');
    expect(label.className).toBe('flex gap-2');
  });

  it('the default label keeps the one text treatment', () => {
    render(<Label>Name</Label>);
    expect(screen.getByText('Name').className).toBe('block text-ods-text-primary text-h6');
  });
});
