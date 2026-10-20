/**
 * A skeleton never draws a skeleton surface inside another one (the standard: shapes are composed side by side,
 * never stacked). The surface also quiets any surface inside it as a safety net (`skeleton-surface.ts`); this test
 * is what keeps the net from being needed. Every exported `*Skeleton` of the main barrels that renders with its
 * default props is rendered and checked.
 */
import { render } from '@testing-library/react';
import type { ComponentType } from 'react';
import { beforeAll, describe, expect, it, vi } from 'vitest';

beforeAll(() => {
  for (const name of ['IntersectionObserver', 'ResizeObserver']) {
    vi.stubGlobal(
      name,
      class {
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    );
  }
});

const barrels = await Promise.all([
  import('../components/loading'),
  import('../components/ui'),
  import('../components/features'),
  import('../components/chat/entity-cards'),
]);
const skeletons = Object.entries(Object.assign({}, ...barrels) as Record<string, unknown>).filter(
  (entry): entry is [string, ComponentType] => /Skeleton$/.test(entry[0]) && typeof entry[1] === 'function',
);

describe('no skeleton surface inside another', () => {
  const rendered: string[] = [];
  const nested: string[] = [];
  it.each(skeletons)('%s', (name, Skeleton) => {
    {
      let html: HTMLElement;
      try {
        html = render(<Skeleton />).container;
      } catch {
        // Needs props or a provider: covered where it is used.
        return;
      }
      rendered.push(name);
      if (html.querySelector('.ods-skeleton .ods-skeleton')) nested.push(name);
      expect(nested).not.toContain(name);
    }
  });
  it('renders enough of them to mean something', () => {
    expect(rendered.length).toBeGreaterThan(30);
  });
});
