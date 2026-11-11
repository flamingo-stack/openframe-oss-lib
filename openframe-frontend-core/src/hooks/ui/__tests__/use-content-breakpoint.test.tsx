import { renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import {
  ContentAreaWidthContext,
  contentBreakpointFor,
  contentStepFor,
  useContentBreakpoint,
  useContentLgUp,
  useContentMdUp,
  useContentXlUp,
  ViewportBreakpoints,
} from '../use-content-breakpoint';

function inContentArea(width: number) {
  return function ContentArea({ children }: { children: ReactNode }) {
    return <ContentAreaWidthContext.Provider value={width}>{children}</ContentAreaWidthContext.Provider>;
  };
}

describe('contentBreakpointFor', () => {
  it('steps at 720 and 1024', () => {
    expect(contentBreakpointFor(400)).toBe('mobile');
    expect(contentBreakpointFor(719)).toBe('mobile');
    expect(contentBreakpointFor(720)).toBe('tablet');
    expect(contentBreakpointFor(1023)).toBe('tablet');
    expect(contentBreakpointFor(1024)).toBe('desktop');
  });
});

describe('contentStepFor', () => {
  // What AppLayout publishes a new width on: a reader of the xl step needs that crossing too.
  it('steps at 720, 1024 and 1216', () => {
    expect([719, 720, 1023, 1024, 1215, 1216, 2000].map(contentStepFor)).toEqual([0, 1, 1, 2, 2, 3, 3]);
  });
});

describe('useContentXlUp', () => {
  it('follows the content area width inside one', () => {
    expect(renderHook(() => useContentXlUp(), { wrapper: inContentArea(1215) }).result.current).toBe(false);
    expect(renderHook(() => useContentXlUp(), { wrapper: inContentArea(1216) }).result.current).toBe(true);
  });

  it('falls back to the viewport outside a content area', () => {
    // The test setup's matchMedia matches nothing: a narrow viewport.
    expect(renderHook(() => useContentXlUp()).result.current).toBe(false);
  });
});

describe('useContentBreakpoint', () => {
  it('follows the content area width inside one', () => {
    const { result } = renderHook(() => useContentBreakpoint(), { wrapper: inContentArea(800) });
    expect(result.current).toBe('tablet');
  });

  it('derives the md / lg flags from it', () => {
    const narrow = renderHook(() => [useContentMdUp(), useContentLgUp()], { wrapper: inContentArea(560) });
    expect(narrow.result.current).toEqual([false, false]);
    const wide = renderHook(() => [useContentMdUp(), useContentLgUp()], { wrapper: inContentArea(1200) });
    expect(wide.result.current).toEqual([true, true]);
  });

  it('falls back to the viewport outside a content area', () => {
    // The test setup's matchMedia matches nothing: a narrow viewport.
    const { result } = renderHook(() => useContentBreakpoint());
    expect(result.current).toBe('mobile');
  });

  it('falls back to the viewport under ViewportBreakpoints, inside a wide content area too', () => {
    const ContentArea = inContentArea(1200);
    const { result } = renderHook(() => useContentBreakpoint(), {
      wrapper: ({ children }) => (
        <ContentArea>
          <ViewportBreakpoints>{children}</ViewportBreakpoints>
        </ContentArea>
      ),
    });
    expect(result.current).toBe('mobile');
  });
});
