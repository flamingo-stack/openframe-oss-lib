import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useCoverImageFallback } from '../use-cover-image-fallback';

const COVER = 'https://cdn.example/cover.png';
const PLACEHOLDER = 'https://cdn.example/placeholder.png';

describe('useCoverImageFallback', () => {
  it('shows the cover first and the placeholder once the cover fails', () => {
    const { result } = renderHook(() => useCoverImageFallback(COVER, PLACEHOLDER));
    expect(result.current.src).toBe(COVER);

    act(() => result.current.onError());
    expect(result.current.src).toBe(PLACEHOLDER);
  });

  it('shows the placeholder when there is no cover', () => {
    const { result } = renderHook(() => useCoverImageFallback(null, PLACEHOLDER));
    expect(result.current.src).toBe(PLACEHOLDER);
  });
});
