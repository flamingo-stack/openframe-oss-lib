/**
 * A loading form never draws a skeleton surface inside another one (the standard: shapes are composed side by side,
 * never stacked). The surface also quiets any surface inside it as a safety net (`skeleton-surface.ts`); this test
 * is what keeps the net from being needed. Every component (and skeleton part) the main barrels export that renders
 * with no props is rendered in a loading scope, where it draws its own loading form, and checked.
 */
import { render } from '@testing-library/react';
import type { ComponentType } from 'react';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { LoadingScope } from '../components/ui/loading-scope';

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
const components = Object.entries(Object.assign({}, ...barrels) as Record<string, unknown>).filter(
  (entry): entry is [string, ComponentType] =>
    /^[A-Z]/.test(entry[0]) && !/Provider$|^Loading/.test(entry[0]) && typeof entry[1] === 'function',
);

describe('no skeleton surface inside another', () => {
  const rendered: string[] = [];
  const nested: string[] = [];
  it.each(components)('%s', (name, Component) => {
    {
      let html: HTMLElement;
      try {
        html = render(
          <LoadingScope>
            <Component />
          </LoadingScope>,
        ).container;
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
