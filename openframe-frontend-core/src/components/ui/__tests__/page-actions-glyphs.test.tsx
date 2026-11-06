/**
 * A page's action glyphs are 16px, 24px from the content area's md (the "…" menu's rows on
 * the window's md), whatever size the caller drew them at: an `h-6 w-6` glyph and a
 * `size={24}` one used to land at 16x24 and 24px in the same menu, and at 20px beside a
 * 24px Mingo segment in the header. The phone's bottom bar spaces its buttons 16px apart.
 */

import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { type PageActionButton, PageActions } from '../page-actions';

const ACTIONS: PageActionButton[] = [
  { label: 'Archive', variant: 'outline', onClick: () => {}, icon: <svg className="h-6 w-6" /> },
  {
    label: 'Add Schedule',
    variant: 'outline',
    onClick: () => {},
    icon: <svg width={24} height={24} />,
    iconAction: { icon: <svg className="h-6 w-6" />, 'aria-label': 'Generate with AI', onClick: () => {} },
  },
];

/** The 16px-to-24px scales: on a header glyph's wrapper, and on a menu row's glyph slot. */
const HEADER_GLYPH = '[&&_svg]:h-4 [&&_svg]:w-4 content-md:[&&_svg]:h-6 content-md:[&&_svg]:w-6';
const ROW_GLYPH = '[&_svg]:h-4 [&_svg]:w-4 md:[&_svg]:h-6 md:[&_svg]:w-6';

/** A class string as serialized markup carries it (`&` is escaped in attribute values). */
const inMarkup = (classes: string) => classes.replace(/&/g, '&amp;');

describe('PageActions glyphs', () => {
  it('scale every header button glyph, the split segment included', () => {
    render(<PageActions variant="icon-buttons" actions={ACTIONS} />);
    // jsdom applies no media queries: the desktop buttons render beside the mobile trigger.
    expect(screen.getAllByRole('button', { name: 'Archive' })[0].innerHTML).toContain(inMarkup(HEADER_GLYPH));
    expect(screen.getAllByRole('button', { name: 'Add Schedule' })[0].innerHTML).toContain(inMarkup(HEADER_GLYPH));
    expect(screen.getAllByRole('button', { name: 'Generate with AI' })[0].innerHTML).toContain(inMarkup(HEADER_GLYPH));
  });

  it("scale the '…' menu rows' glyphs, the trailing action's included", () => {
    render(<PageActions variant="icon-buttons" actions={ACTIONS} />);
    const triggers = screen.getAllByLabelText('More actions');
    // Radix opens dropdown menus on pointerdown, not click.
    fireEvent.pointerDown(triggers[triggers.length - 1], { button: 0, pointerType: 'mouse' });
    const menu = screen.getByRole('menu');
    expect(within(menu).getByRole('menuitem', { name: 'Archive' }).innerHTML).toContain(inMarkup(ROW_GLYPH));
    expect(within(menu).getByRole('menuitem', { name: 'Add Schedule' }).innerHTML).toContain(inMarkup(ROW_GLYPH));
    expect(within(menu).getByRole('button', { name: 'Generate with AI' }).className).toContain(ROW_GLYPH);
  });

  it("space the phone's bottom bar buttons 16px apart (`l`)", () => {
    render(
      <PageActions
        variant="primary-buttons"
        actions={[
          { label: 'Test Script', variant: 'outline', onClick: () => {} },
          { label: 'Save Script', onClick: () => {} },
        ]}
      />,
    );
    const bar = screen.getByTestId('mobile-action-bar');
    expect(bar).toHaveClass('gap-[var(--spacing-system-l)]');
    expect(bar).not.toHaveClass('gap-[var(--spacing-system-xs)]');
  });
});
