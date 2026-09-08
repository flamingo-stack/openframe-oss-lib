import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useMarqueeSync } from '../marquee-wall';

/**
 * The pair contract of `useMarqueeSync`: exactly one driver while any wall is
 * mounted, promotion when the driver leaves, and a position that survives the
 * hand-over so a re-elected driver never snaps the pair back to 0.
 *
 * These exercise the controller the way <MarqueeWall> does — register a member,
 * subscribe to the election, publish from the driver — without standing up the
 * rAF engine, which is what the walls own rather than the pair.
 */
function makeMember() {
  return { apply: vi.fn() };
}

function controller() {
  return renderHook(() => useMarqueeSync()).result.current;
}

describe('useMarqueeSync election', () => {
  it('gives the driver seat to the first member to register', () => {
    const sync = controller();
    const a = makeMember();
    const b = makeMember();

    sync.register(a);
    sync.register(b);

    expect(sync.isDriver(a)).toBe(true);
    expect(sync.isDriver(b)).toBe(false);
  });

  it('fans a published position out to every member, driver included', () => {
    const sync = controller();
    const a = makeMember();
    const b = makeMember();
    sync.register(a);
    sync.register(b);

    sync.publish(42);

    expect(a.apply).toHaveBeenCalledWith(42);
    expect(b.apply).toHaveBeenCalledWith(42);
    expect(sync.readPosition()).toBe(42);
  });

  it('promotes a survivor — and keeps the position — when the driver unmounts', () => {
    const sync = controller();
    const a = makeMember();
    const b = makeMember();
    const unregisterA = sync.register(a);
    sync.register(b);
    sync.publish(120);

    unregisterA();

    expect(sync.isDriver(b)).toBe(true);
    // The promoted driver seeds its engine from here; losing it would snap the
    // pair back to 0 on every hand-over.
    expect(sync.readPosition()).toBe(120);

    // The old driver is out of the fan-out entirely.
    b.apply.mockClear();
    a.apply.mockClear();
    sync.publish(130);
    expect(b.apply).toHaveBeenCalledWith(130);
    expect(a.apply).not.toHaveBeenCalled();
  });

  it('notifies subscribers on promotion and never on a non-driver leaving', () => {
    const sync = controller();
    const a = makeMember();
    const b = makeMember();
    const onChange = vi.fn();

    const unregisterA = sync.register(a);
    const unregisterB = sync.register(b);
    sync.subscribe(onChange);

    // b is not the driver, so its departure changes no seat.
    unregisterB();
    expect(onChange).not.toHaveBeenCalled();

    // a is, so its departure does — even though there is no survivor.
    unregisterA();
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(sync.isDriver(a)).toBe(false);
  });

  it('lets a late joiner drive once the pair has emptied out', () => {
    const sync = controller();
    const a = makeMember();
    const unregisterA = sync.register(a);
    unregisterA();

    const c = makeMember();
    sync.register(c);

    expect(sync.isDriver(c)).toBe(true);
  });

  it('does not disturb the seat when a late wall joins a driven pair', () => {
    const sync = controller();
    const a = makeMember();
    const onChange = vi.fn();
    sync.register(a);
    sync.subscribe(onChange);

    const c = makeMember();
    sync.register(c);

    expect(sync.isDriver(a)).toBe(true);
    expect(sync.isDriver(c)).toBe(false);
    expect(onChange).not.toHaveBeenCalled();

    // ...but it does start receiving the driver's positions immediately.
    sync.publish(7);
    expect(c.apply).toHaveBeenCalledWith(7);
  });

  it('stops notifying an unsubscribed member (a wall unmounting alongside the driver)', () => {
    const sync = controller();
    const a = makeMember();
    const b = makeMember();
    const onChangeB = vi.fn();
    const unregisterA = sync.register(a);
    sync.register(b);
    const unsubscribeB = sync.subscribe(onChangeB);

    // React tears down the store subscription before the registration effect,
    // so a peer leaving in the same commit must not be poked.
    unsubscribeB();
    unregisterA();

    expect(onChangeB).not.toHaveBeenCalled();
  });
});
