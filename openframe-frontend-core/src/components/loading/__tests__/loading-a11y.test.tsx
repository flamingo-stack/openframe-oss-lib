import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { LoadingRegion } from '../loading-region';
import { TextSkeleton, UnifiedSkeleton } from '../unified-skeleton';

function Counter() {
  const [count, setCount] = useState(0);
  return (
    <button type="button" onClick={() => setCount(count + 1)}>
      {count}
    </button>
  );
}

describe('skeleton accessibility', () => {
  it('hides a bar from assistive technology unless it is named', () => {
    const html = renderToString(<UnifiedSkeleton />);
    expect(html).toContain('aria-hidden="true"');
    expect(html).not.toContain('role="status"');
  });

  it('makes a named bar a status', () => {
    render(<UnifiedSkeleton aria-label="Loading avatar" />);
    expect(screen.getByRole('status', { name: 'Loading avatar' })).toBeTruthy();
  });

  it('keeps the presets silent', () => {
    const html = renderToString(<TextSkeleton.Heading />);
    expect(html).toContain('aria-hidden="true"');
    expect(html).not.toContain('role="status"');
  });

  it('announces a region of many bars once, and marks it busy', () => {
    render(
      <LoadingRegion label="Loading vendors">
        {Array.from({ length: 40 }, (_, i) => (
          <UnifiedSkeleton key={i} />
        ))}
      </LoadingRegion>,
    );
    expect(screen.getAllByRole('status')).toHaveLength(1);
    expect(screen.getByRole('status').textContent).toBe('Loading vendors');
    expect(screen.getByRole('status').parentElement?.getAttribute('aria-busy')).toBe('true');
  });

  it('draws only the container when it does not announce (a region inside a region)', () => {
    const html = renderToString(
      <LoadingRegion label="Loading vendors">
        <LoadingRegion label="Loading cards" announce={false}>
          <UnifiedSkeleton />
        </LoadingRegion>
      </LoadingRegion>,
    );
    expect(html.match(/role="status"/g)).toHaveLength(1);
    expect(html.match(/aria-busy/g)).toHaveLength(1);
    expect(html).not.toContain('Loading cards');
  });

  it('marks a container busy without a second status when told the status lives elsewhere', () => {
    const html = renderToString(<LoadingRegion status={false} />);
    expect(html).not.toContain('role="status"');
    expect(html).toContain('aria-busy="true"');
  });

  it('keeps its contents mounted when announce flips', () => {
    const { rerender } = render(
      <LoadingRegion>
        <Counter />
      </LoadingRegion>,
    );
    const button = screen.getByRole('button');
    fireEvent.click(button);

    rerender(
      <LoadingRegion announce={false}>
        <Counter />
      </LoadingRegion>,
    );
    expect(screen.getByRole('button')).toBe(button);
    expect(button.textContent).toBe('1');

    rerender(
      <LoadingRegion>
        <Counter />
      </LoadingRegion>,
    );
    expect(screen.getByRole('button')).toBe(button);
    expect(button.textContent).toBe('1');
  });
});
