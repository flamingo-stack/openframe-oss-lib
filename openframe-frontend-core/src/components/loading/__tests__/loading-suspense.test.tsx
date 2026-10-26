import { act, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
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

  it('live: draws the wait in a bare scope (no inert region), announced once, with a plain control still usable', () => {
    const never = new Promise<void>(() => {});
    const Reader = () => {
      throw never;
    };
    render(
      <LoadingSuspense
        live
        label="Loading the run"
        fallback={
          <>
            <Value read={() => 'unused'} />
            <button type="button">Back</button>
          </>
        }
      >
        <Reader />
      </LoadingSuspense>,
    );
    expect(screen.getByTestId('bar')).toBeTruthy();
    expect(screen.getByRole('status').textContent).toBe('Loading the run');
    // An inert region is hidden from the accessibility tree, so a reachable button proves the wait is live.
    expect(screen.getByRole('button', { name: 'Back' })).toBeTruthy();
  });

  it('gated: draws the waiting view and never renders the reader until the gate opens', () => {
    const rendered = vi.fn();
    const Reader = () => {
      rendered();
      return <span>read</span>;
    };
    const view = <Value read={() => 'unused'} />;
    const { rerender } = render(
      <LoadingSuspense gated label="Loading usage" fallback={view}>
        <Reader />
      </LoadingSuspense>,
    );
    expect(screen.getByTestId('bar')).toBeTruthy();
    expect(rendered).not.toHaveBeenCalled();

    rerender(
      <LoadingSuspense gated={false} label="Loading usage" fallback={view}>
        <Reader />
      </LoadingSuspense>,
    );
    expect(screen.getByText('read')).toBeTruthy();
    expect(rendered).toHaveBeenCalled();
  });

  it('gated + bare: the gate window draws the scope only, with no region element', () => {
    render(
      <LoadingSuspense gated bare label="Loading setup" fallback={<Value read={() => 'unused'} />}>
        <span>read</span>
      </LoadingSuspense>,
    );
    expect(screen.getByTestId('bar')).toBeTruthy();
    expect(screen.queryByRole('status')).toBeNull();
  });
});
