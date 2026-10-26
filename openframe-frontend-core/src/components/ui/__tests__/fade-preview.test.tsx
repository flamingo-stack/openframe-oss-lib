import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
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
