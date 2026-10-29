import { describe, expect, it, vi } from 'vitest';
import { sharedTable } from '../icon-loading';

describe('a shared icon loader table', () => {
  it('is fetched once for every icon that reads it', async () => {
    const fetchTable = vi.fn(() => Promise.resolve({}));
    const table = sharedTable(fetchTable);
    await Promise.all([table(), table(), table()]);
    expect(fetchTable).toHaveBeenCalledTimes(1);
  });

  it('is fetched again after a fetch failed, so one dropped request does not fail every icon for good', async () => {
    const loaders = { RocketIcon: undefined };
    const fetchTable = vi
      .fn<() => Promise<typeof loaders>>()
      .mockRejectedValueOnce(new Error('chunk load failed'))
      .mockResolvedValueOnce(loaders);
    const table = sharedTable(fetchTable);
    await expect(table()).rejects.toThrow('chunk load failed');
    await expect(table()).resolves.toBe(loaders);
    await expect(table()).resolves.toBe(loaders);
    expect(fetchTable).toHaveBeenCalledTimes(2);
  });
});
