import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Button } from '../button';
import { SplitButton } from '../button/split-button';

/** The slot a test icon sits in: the span the button wraps the icon with. */
function slotOf(testId: string): HTMLElement {
  const slot = screen.getByTestId(testId).parentElement;
  if (!slot) throw new Error(`no slot around ${testId}`);
  return slot;
}

/**
 * An outline action draws its icon in the secondary tone beside the primary label, by default: a call site never
 * restates it, and one that names its own colour keeps it.
 */
describe('Button icon tone', () => {
  it('an outline button gives its icons the secondary tone beside a label', () => {
    render(
      <Button variant="outline" leftIcon={<svg data-testid="left" />} rightIcon={<svg data-testid="right" />}>
        Export
      </Button>,
    );
    expect(slotOf('left').className).toContain('text-ods-text-secondary');
    expect(slotOf('right').className).toContain('text-ods-text-secondary');
  });

  it('a disabled outline button gives them the disabled tone', () => {
    render(
      <Button variant="outline" disabled leftIcon={<svg data-testid="left" />}>
        Export
      </Button>,
    );
    expect(slotOf('left').className).toContain('text-ods-text-disabled');
    expect(slotOf('left').className).not.toContain('text-ods-text-secondary');
  });

  it("an icon-only outline button keeps the glyph in the button's text colour", () => {
    render(<Button variant="outline" size="icon" aria-label="Refresh" leftIcon={<svg data-testid="icon" />} />);
    expect(slotOf('icon').className).not.toContain('text-ods-');
  });

  it.each(['accent', 'transparent', 'destructive'] as const)(
    'a `%s` button leaves its icons the label colour',
    variant => {
      render(
        <Button variant={variant} leftIcon={<svg data-testid="left" />}>
          Save
        </Button>,
      );
      expect(slotOf('left').className).not.toContain('text-ods-');
    },
  );

  it('the main half of an outline split button tones its icon the same way', () => {
    render(
      <SplitButton
        variant="outline"
        leftIcon={<svg data-testid="left" />}
        iconAction={{ icon: <svg />, 'aria-label': 'More' }}
      >
        Run
      </SplitButton>,
    );
    expect(slotOf('left').className).toContain('text-ods-text-secondary');
  });
});
