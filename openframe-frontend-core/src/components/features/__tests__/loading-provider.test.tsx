import { act, render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { LoadingProvider, useLoading } from '../loading-provider';

describe('LoadingProvider', () => {
  it('hands out the same context value until loading changes', async () => {
    const seen: ReturnType<typeof useLoading>[] = [];
    function Probe() {
      seen.push(useLoading());
      return null;
    }
    render(
      <LoadingProvider>
        <Probe />
      </LoadingProvider>,
    );
    // The bar's own timers and re-renders must not reach the consumers.
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 700));
    });
    expect(seen).toHaveLength(1);

    act(() => seen[0].setIsLoading(true));
    expect(seen).toHaveLength(2);
    expect(seen[1].isLoading).toBe(true);
    expect(seen[1]).not.toBe(seen[0]);
  });
});
