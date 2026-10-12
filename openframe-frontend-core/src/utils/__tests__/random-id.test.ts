import { afterEach, describe, expect, it, vi } from 'vitest';
import { randomId } from '../random-id';

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe('randomId', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('is a version 4 UUID', () => {
    expect(randomId()).toMatch(UUID_V4);
  });

  it('is a version 4 UUID in a runtime that predates randomUUID', () => {
    vi.stubGlobal('crypto', { getRandomValues: (bytes: Uint8Array) => bytes.fill(171) });
    expect(randomId()).toMatch(UUID_V4);
  });

  it('is still a version 4 UUID in a runtime with no crypto at all', () => {
    vi.stubGlobal('crypto', undefined);
    const ids = new Set(Array.from({ length: 50 }, () => randomId()));
    for (const id of ids) expect(id).toMatch(UUID_V4);
    expect(ids.size).toBe(50);
  });
});
