import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useImageFallback } from '../use-image-fallback';

describe('useImageFallback', () => {
  it('falls back to the next candidate when one fails, and to null, not back to the first, when the last fails', () => {
    const { result } = renderHook(() => useImageFallback('a', 'b'));
    expect(result.current.src).toBe('a');

    act(() => result.current.onError());
    expect(result.current.src).toBe('b');

    act(() => result.current.onError());
    expect(result.current.src).toBeNull();
  });

  it('fails the candidate it shows now when that candidate arrived after the first render', () => {
    const { result, rerender } = renderHook(({ src }) => useImageFallback(src), {
      initialProps: { src: undefined as string | undefined },
    });
    expect(result.current.src).toBeNull();

    rerender({ src: 'a' });
    expect(result.current.src).toBe('a');

    act(() => result.current.onError());
    expect(result.current.src).toBeNull();
  });
});
