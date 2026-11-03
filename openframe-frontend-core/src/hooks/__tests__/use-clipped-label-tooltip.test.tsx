import { render, renderHook, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { HOVER_MEDIA_QUERY, useClippedLabelTooltip } from '../ui/use-clipped-label-tooltip';
import { useMediaQuery } from '../ui/use-media-query';

// jsdom lays nothing out: the test says whether the text overflows its box.
function layout(scrollWidth: number, clientWidth: number) {
  Object.defineProperty(HTMLElement.prototype, 'scrollWidth', { configurable: true, get: () => scrollWidth });
  Object.defineProperty(HTMLElement.prototype, 'clientWidth', { configurable: true, get: () => clientWidth });
}

/** The device's pointer: one that can hover (a mouse), or none (a touch screen). */
function pointer(canHover: boolean) {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: canHover && query === HOVER_MEDIA_QUERY,
    media: query,
    onchange: null,
    addEventListener() {},
    removeEventListener() {},
    addListener() {},
    removeListener() {},
    dispatchEvent: () => false,
  }));
}

afterEach(() => {
  vi.unstubAllGlobals();
  delete (HTMLElement.prototype as unknown as Record<string, unknown>).scrollWidth;
  delete (HTMLElement.prototype as unknown as Record<string, unknown>).clientWidth;
});

function Label({ text }: { text: string }) {
  const { ref, enabled } = useClippedLabelTooltip<HTMLSpanElement>(text);
  return (
    <span ref={ref} data-tooltip={enabled ? 'on' : 'off'}>
      {text}
    </span>
  );
}

describe('useClippedLabelTooltip', () => {
  it('asks for `(hover: hover) and (pointer: fine)`: a pointer that can hover', () => {
    expect(HOVER_MEDIA_QUERY).toBe('(hover: hover) and (pointer: fine)');
  });

  it('enables the tooltip only while the text is clipped', () => {
    pointer(true);
    layout(300, 100);
    const { unmount } = render(<Label text="A long label" />);
    expect(screen.getByText('A long label')).toHaveAttribute('data-tooltip', 'on');
    unmount();

    layout(100, 100);
    render(<Label text="A long label" />);
    expect(screen.getByText('A long label')).toHaveAttribute('data-tooltip', 'off');
  });

  it('never enables it on a device without hover, however clipped', () => {
    pointer(false);
    layout(300, 100);
    render(<Label text="A long label" />);
    expect(screen.getByText('A long label')).toHaveAttribute('data-tooltip', 'off');
  });
});

describe('useMediaQuery', () => {
  it('answers the query and follows it', () => {
    pointer(true);
    const { result } = renderHook(() => useMediaQuery(HOVER_MEDIA_QUERY));
    expect(result.current).toBe(true);
    const other = renderHook(() => useMediaQuery('(min-width: 9999px)'));
    expect(other.result.current).toBe(false);
  });

  it('never answers in an environment without matchMedia, instead of throwing', () => {
    vi.stubGlobal('matchMedia', undefined);
    const { result } = renderHook(() => useMediaQuery(HOVER_MEDIA_QUERY));
    expect(result.current).toBeUndefined();
  });
});
