import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { DataTable } from '../components/ui/data-table';
import { Tag } from '../components/ui/tag';

/**
 * The classes of one part of the cell (`data-part`), read off the markup: the part's shrink rule is exactly what ships
 * in its class attribute.
 */
function partClasses(container: HTMLElement, part: string): string {
  const tag = new RegExp(`<[a-z]+[^>]*\\bdata-part="${part}"[^>]*>`).exec(container.innerHTML)?.[0] ?? '';
  return /\bclass="([^"]*)"/.exec(tag)?.[1] ?? '';
}

/**
 * A grid-table cell is ONE line. jsdom has no layout, so these lock what makes it one line: which part may shrink
 * (and is cut with an ellipsis) and which part never does, for each of the cell's shapes.
 */
describe('DataTable.Cell', () => {
  it('cuts the main text on one line and keeps a short secondary text whole beside it', () => {
    const { container } = render(<DataTable.Cell text="Romans-MacBook-Pro.local" secondary="v2.4.1" />);

    const main = screen.getByText('Romans-MacBook-Pro.local');
    expect(main.className).toContain('truncate');
    expect(main.className).not.toMatch(/line-clamp/);
    expect(main.parentElement?.className ?? '').toContain('flex-1');

    expect(screen.getByText('v2.4.1')).toBeTruthy();
    const secondary = partClasses(container, 'secondary');
    expect(secondary).toContain('shrink-0');
    expect(secondary).toContain('whitespace-nowrap');
  });

  it('cuts a long secondary text once the main text is down to its first characters', () => {
    const { container } = render(
      <DataTable.Cell text="Roman Khutornoy" secondary="roman.khutornoy@greenvalleymanufacturing.com" />,
    );

    // The main text is the first to give way (the larger shrink factor), and stops at its minimum.
    const mainBox = screen.getByText('Roman Khutornoy').parentElement?.className ?? '';
    expect(mainBox).toContain('flex-[1_9999_auto]');
    expect(mainBox).toContain('min-w-[9ch]');

    // From there the secondary text is cut with an ellipsis: it never pushes the main text out of the cell.
    const secondaryText = screen.getByText('roman.khutornoy@greenvalleymanufacturing.com');
    expect(secondaryText.className).toContain('truncate');
    expect(secondaryText.className).toContain('text-ods-text-secondary');
    const secondary = partClasses(container, 'secondary');
    expect(secondary).toContain('min-w-0');
    expect(secondary).toContain('shrink');
    expect(secondary).not.toContain('shrink-0');
  });

  it('never shrinks a main text that is already at its minimum: the long secondary text beside it is what is cut', () => {
    render(<DataTable.Cell text="Kept" secondary="Kept by Jerome Park · Legal hold until the audit closes" />);

    const mainBox = screen.getByText('Kept').parentElement?.className ?? '';
    expect(mainBox).toContain('flex-[1_0_auto]');
    expect(mainBox).not.toContain('min-w-[9ch]');
    expect(screen.getByText(/Legal hold/).className).toContain('truncate');
  });

  it('keeps a secondary text of 8 characters whole and cuts one of 9', () => {
    const { container, rerender } = render(<DataTable.Cell text="Romans-MacBook-Pro.local" secondary="12:34:56" />);
    expect(partClasses(container, 'secondary')).toContain('shrink-0');
    expect(screen.getByText('Romans-MacBook-Pro.local').parentElement?.className ?? '').toContain('flex-1');

    rerender(<DataTable.Cell text="Romans-MacBook-Pro.local" secondary="12:34:567" />);
    expect(partClasses(container, 'secondary')).not.toContain('shrink-0');
    expect(screen.getByText('12:34:567').className).toContain('truncate');
    expect(screen.getByText('Romans-MacBook-Pro.local').parentElement?.className ?? '').toContain('flex-[1_9999_auto]');
  });

  it('never shrinks a main text of 9 characters beside a long secondary text, and shrinks one of 10', () => {
    const secondary = 'roman.khutornoy@greenvalleymanufacturing.com';
    const { rerender } = render(<DataTable.Cell text="123456789" secondary={secondary} />);
    const nine = screen.getByText('123456789').parentElement?.className ?? '';
    expect(nine).toContain('flex-[1_0_auto]');
    expect(nine).not.toContain('min-w-[9ch]');

    rerender(<DataTable.Cell text="1234567890" secondary={secondary} />);
    const ten = screen.getByText('1234567890').parentElement?.className ?? '';
    expect(ten).toContain('flex-[1_9999_auto]');
    expect(ten).toContain('min-w-[9ch]');
  });

  it('lets the main text take the line when there is no secondary text', () => {
    render(<DataTable.Cell text="Dell OptiPlex 7090 Small Form Factor" />);
    const mainBox = screen.getByText('Dell OptiPlex 7090 Small Form Factor').parentElement?.className ?? '';
    expect(mainBox).toContain('flex-1');
    expect(mainBox).not.toContain('flex-[1_9999_auto]');
  });

  it('mutes the main text on request and leaves it primary otherwise', () => {
    const { rerender } = render(<DataTable.Cell text="12 Nov 2026" tone="secondary" />);
    expect(screen.getByText('12 Nov 2026').className).toContain('text-ods-text-secondary');

    rerender(<DataTable.Cell text="12 Nov 2026" />);
    expect(screen.getByText('12 Nov 2026').className).toContain('text-ods-text-primary');
    expect(screen.getByText('12 Nov 2026').className).not.toContain('text-ods-text-secondary');
  });

  it('never shrinks a tag: with no main text the secondary text is the part that is cut', () => {
    const { container } = render(
      <DataTable.Cell tag={<Tag label="Offline" variant="error" />} secondary="1 hour ago" />,
    );

    expect(screen.getByText('Offline')).toBeTruthy();
    expect(partClasses(container, 'tag')).toContain('shrink-0');

    const secondary = partClasses(container, 'secondary');
    expect(secondary).toContain('truncate');
    expect(secondary).toContain('min-w-0');
    expect(secondary).not.toContain('shrink-0');
  });

  it('draws the tags that do not fit as one +N tag', () => {
    render(<DataTable.Cell tag={<Tag label="prod" />} moreTags={['edge', 'gpu', 'pci']} />);

    expect(screen.getByText('+3')).toBeTruthy();
    // The hidden labels live in the tooltip, not in the line.
    expect(screen.queryByText('edge')).toBeNull();
  });

  it('draws no +N tag for an empty list', () => {
    render(<DataTable.Cell text="srv-db-prod-02" moreTags={[]} />);
    expect(screen.queryByText('+0')).toBeNull();
  });

  it('draws each leading mark at its own size, never shrinking', () => {
    const { container, rerender } = render(
      <DataTable.Cell leading={{ type: 'icon', icon: <svg data-testid="icon" /> }} text="Device" />,
    );
    expect(screen.getByTestId('icon')).toBeTruthy();
    expect(partClasses(container, 'leading')).toContain('size-5');
    expect(partClasses(container, 'leading')).toContain('shrink-0');

    rerender(<DataTable.Cell leading={{ type: 'image', alt: 'TechFlow Solutions' }} text="TechFlow Solutions" />);
    expect(partClasses(container, 'leading')).toContain('h-8 w-8');
    expect(partClasses(container, 'leading')).toContain('rounded-sm');
    expect(partClasses(container, 'leading')).toContain('shrink-0');

    rerender(<DataTable.Cell leading={{ type: 'avatar', name: 'Jerome Park' }} text="Jerome Park" />);
    expect(partClasses(container, 'leading')).toContain('h-8 w-8');
    expect(partClasses(container, 'leading')).toContain('rounded-full');
    // No picture: the avatar falls back to the person's initials.
    expect(screen.getByText('JP')).toBeTruthy();
  });

  it('keeps a trailing mark at the end of the line, never shrinking', () => {
    const { container } = render(<DataTable.Cell text="Device" trailing={<i data-testid="dot" />} />);
    expect(screen.getByTestId('dot')).toBeTruthy();
    expect(partClasses(container, 'trailing')).toContain('shrink-0');
    // The trailing part is the last thing in the cell's markup.
    expect(container.innerHTML).toMatch(/data-part="trailing"[^>]*><i data-testid="dot"><\/i><\/span><\/div>$/);
  });

  it('draws the secondary text in the warning colour on request, short or long, and in the secondary one otherwise', () => {
    render(
      <>
        <DataTable.Cell text="118 of 120" secondary="2 unused" />
        <DataTable.Cell text="100 of 120" secondary="20 left" secondaryTone="warning" />
        <DataTable.Cell text="Acme" secondary="30 of 412 unattributed" secondaryTone="warning" />
      </>,
    );

    expect(screen.getByText('2 unused').className).toContain('text-ods-text-secondary');
    expect(screen.getByText('2 unused').className).not.toContain('text-ods-warning');
    // Short: the part itself carries the colour.
    expect(screen.getByText('20 left').className).toContain('text-ods-warning');
    expect(screen.getByText('20 left').className).not.toContain('text-ods-text-secondary');
    // Long: the cut text carries it.
    expect(screen.getByText('30 of 412 unattributed').className).toContain('text-ods-warning');
  });
});
