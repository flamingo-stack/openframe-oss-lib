import { render, screen } from '@testing-library/react';
import { createRef } from 'react';
import { describe, expect, it } from 'vitest';

import { BUTTON_KIND_CLASS, Button } from '../button';
import { Label } from '../label';
import { TabSelector } from '../tab-selector';

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
    expect(BUTTON_KIND_CLASS.row).toContain('data-[state=active]:bg-ods-bg-hover');
    expect(BUTTON_KIND_CLASS.tab).toContain('data-[state=active]:text-ods-text-primary');
    expect(BUTTON_KIND_CLASS.field).toContain('data-[invalid]:border-ods-error');
  });

  it('a selected row named with a tone draws that tone, held under the cursor (a chat list)', () => {
    render(
      <Button variant="row" type="button" data-state="active" data-tone="accent">
        Chat
      </Button>,
    );
    const row = screen.getByRole('button', { name: 'Chat' });
    expect(row.getAttribute('data-tone')).toBe('accent');
    expect(row.className).toContain('data-[tone=accent]:data-[state=active]:bg-ods-accent-secondary');
    expect(row.className).toContain('data-[tone=accent]:data-[state=active]:hover:bg-ods-accent-secondary');
  });

  it('the navigation rail marks the current page with the accent fill, text, glyph and bar', () => {
    for (const cls of [
      'data-[state=active]:bg-ods-open-yellow-light',
      'data-[state=active]:text-ods-accent',
      '[&_svg]:data-[state=active]:fill-ods-accent',
      'data-[state=active]:before:bg-ods-accent',
      'aria-busy:after:opacity-100',
    ]) {
      expect(BUTTON_KIND_CLASS.rail).toContain(cls);
    }
  });

  it('a field holds its open accent under the cursor and draws a chosen option from `aria-selected`', () => {
    expect(BUTTON_KIND_CLASS.field).toContain('enabled:data-[state=open]:hover:border-ods-accent');
    expect(BUTTON_KIND_CLASS.field).toContain('aria-selected:bg-ods-open-yellow-light');
    expect(BUTTON_KIND_CLASS.field).toContain('data-[invalid]:data-[state=open]:border-ods-error');
  });

  it('the current header cell takes the pressed surface and the primary text', () => {
    expect(BUTTON_KIND_CLASS.cell).toContain('data-[state=active]:bg-ods-bg-active');
    expect(BUTTON_KIND_CLASS.cell).toContain('data-[state=active]:text-ods-text-primary');
  });
});

describe('TabSelector segments', () => {
  const items = [
    { id: 'signup', label: 'Sign Up' },
    { id: 'login', label: 'Login' },
  ];

  it.each([
    [
      'primary',
      'accent',
      [
        'data-[tone=accent]:data-[state=active]:bg-ods-accent',
        'data-[tone=accent]:data-[state=active]:text-ods-text-on-accent',
      ],
    ],
    ['secondary', null, ['data-[state=active]:bg-ods-bg-surface', 'data-[state=active]:text-ods-text-primary']],
  ] as const)('`%s` fills the selected segment (tone %s)', (variant, tone, fill) => {
    render(<TabSelector value="login" onValueChange={() => {}} items={items} variant={variant} />);
    const active = screen.getByRole('button', { name: 'Login' });
    const idle = screen.getByRole('button', { name: 'Sign Up' });
    expect(active.getAttribute('data-state')).toBe('active');
    expect(active.getAttribute('aria-pressed')).toBe('true');
    expect(active.getAttribute('data-tone')).toBe(tone);
    expect(idle.getAttribute('data-state')).toBeNull();
    for (const cls of [...fill, 'rounded-xs', 'p-[var(--spacing-system-xsf)]', 'text-h4', 'hover:bg-ods-bg-hover']) {
      expect(active.className).toContain(cls);
    }
    // The disabled selected segment keeps the raised surface, with secondary text.
    expect(active.className).toContain('disabled:data-[state=active]:bg-ods-bg-surface');
    expect(active.className).toContain('disabled:data-[state=active]:text-ods-text-secondary');
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
