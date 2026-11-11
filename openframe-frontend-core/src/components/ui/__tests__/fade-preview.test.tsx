import { fireEvent, render, screen } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FADE_PREVIEW_MAX_UNMEASURED_ITEMS, FadePreview } from '../fade-preview';

const list = (count: number) => (
  <ul>
    {Array.from({ length: count }, (_, i) => (
      <li key={i}>row {i}</li>
    ))}
  </ul>
);

// The server's markup is the unmeasured state: no layout effect has run.
// React escapes `&` and `>` in an attribute, so the class is matched by its rule.
const clipRule = (visible: number) => `nth-child(n+${visible + 1})]:hidden`;

describe('FadePreview item mode in the server markup', () => {
  it.each([1, 3, FADE_PREVIEW_MAX_UNMEASURED_ITEMS])('hides the items past the first %i', visible => {
    expect(renderToString(<FadePreview visibleItems={visible}>{list(20)}</FadePreview>)).toContain(clipRule(visible));
  });

  it('adds no hiding outside item mode', () => {
    expect(renderToString(<FadePreview hiddenCount={2}>{list(4)}</FadePreview>)).not.toContain('nth-child');
  });
});

describe('FadePreview counted mode in the server markup', () => {
  it('carries the collapsed max-height, so a server-rendered list is clamped before it hydrates', () => {
    expect(renderToString(<FadePreview hiddenCount={2}>{list(4)}</FadePreview>)).toContain('max-height:120px');
    expect(
      renderToString(
        <FadePreview hiddenCount={2} collapsedHeight={160}>
          {list(4)}
        </FadePreview>,
      ),
    ).toContain('max-height:160px');
  });

  it('adds no clamp when nothing is hidden', () => {
    expect(renderToString(<FadePreview hiddenCount={0}>{list(4)}</FadePreview>)).not.toContain('max-height');
  });
});

describe('FadePreview item mode measure', () => {
  afterEach(() => vi.restoreAllMocks());

  it("holds item N's bottom plus the list's bottom border, so a bordered list of exactly N items shows whole", () => {
    // Each item is 50px tall, stacked from the top of the box.
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
      const index = this.dataset.index === undefined ? -1 : Number(this.dataset.index);
      return { top: index < 0 ? 0 : index * 50, bottom: index < 0 ? 0 : (index + 1) * 50 } as DOMRect;
    });
    render(
      <FadePreview visibleItems={2}>
        <div data-testid="list" style={{ borderBottom: '1px solid', paddingBottom: '2px' }}>
          {[0, 1].map(i => (
            <div key={i} data-index={i}>
              row {i}
            </div>
          ))}
        </div>
      </FadePreview>,
    );
    expect(screen.getByTestId('list').parentElement).toHaveStyle({ height: '103px' });
  });
});

describe('FadePreview item mode while collapsed', () => {
  it('keeps the items past N out of the tab order until the reader expands', () => {
    render(
      <FadePreview visibleItems={2}>
        <ul>
          {[0, 1, 2, 3].map(i => (
            <li key={i}>
              <a href={`#${i}`}>item {i}</a>
            </li>
          ))}
        </ul>
      </FadePreview>,
    );
    const inert = () => screen.getAllByRole('listitem', { hidden: true }).map(li => li.hasAttribute('inert'));
    expect(inert()).toEqual([false, false, true, true]);

    fireEvent.click(screen.getByRole('button', { hidden: true }));
    expect(inert()).toEqual([false, false, false, false]);
  });
});
