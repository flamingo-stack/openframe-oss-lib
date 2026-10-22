import { act, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useLoadingScope } from '../../ui/loading-scope';
import { LoadingSuspense } from '../loading-fallback';

/** Reads its value through a promise until `resolved`, and draws a bar in a loading scope. */
function Value({ read }: { read: () => string }) {
  if (useLoadingScope()) return <span data-testid="bar" />;
  return <span>{read()}</span>;
}

describe('LoadingSuspense', () => {
  it('draws its own children in a loading scope while they suspend, then the loaded value', async () => {
    let resolve!: () => void;
    let done = false;
    const pending = new Promise<void>(r => {
      resolve = () => {
        done = true;
        r();
      };
    });
    const read = () => {
      if (!done) throw pending;
      return 'loaded';
    };

    render(
      <LoadingSuspense label="Loading the value">
        <Value read={read} />
      </LoadingSuspense>,
    );
    expect(screen.getByTestId('bar')).toBeTruthy();
    expect(screen.getByRole('status').textContent).toBe('Loading the value');

    await act(async () => {
      resolve();
      await pending;
    });
    expect(screen.getByText('loaded')).toBeTruthy();
    expect(screen.queryByTestId('bar')).toBeNull();
  });

  it('draws its fallback in the loading scope when one is given', () => {
    const never = new Promise<void>(() => {});
    const Reader = () => {
      throw never;
    };
    render(
      <LoadingSuspense label="Loading the view" fallback={<Value read={() => 'unused'} />}>
        <Reader />
      </LoadingSuspense>,
    );
    expect(screen.getByTestId('bar')).toBeTruthy();
  });
});
