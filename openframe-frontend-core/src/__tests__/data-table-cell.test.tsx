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
  it('cuts the main text on one line and keeps the secondary text whole beside it', () => {
    const { container } = render(<DataTable.Cell text="Romans-MacBook-Pro.local" secondary="v2.4.1" />);

    const main = screen.getByText('Romans-MacBook-Pro.local');
    expect(main.className).toContain('truncate');
    expect(main.className).not.toMatch(/line-clamp/);

    expect(screen.getByText('v2.4.1')).toBeTruthy();
    const secondary = partClasses(container, 'secondary');
    expect(secondary).toContain('shrink-0');
    expect(secondary).toContain('whitespace-nowrap');
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
});
