import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { mockPush, mockReplace, setMockSearchParams } from '../../../../vitest.setup';
import { prefixedParamName, useApiParams } from '../use-api-params';

const schema = {
  search: { type: 'string' as const, default: '' },
  status: { type: 'array' as const, default: [] as string[] },
};

describe('prefixedParamName', () => {
  it('camelCases the name onto the prefix', () => {
    expect(prefixedParamName('cve', 'search')).toBe('cveSearch');
    expect(prefixedParamName('', 'search')).toBe('search');
    expect(prefixedParamName(undefined, 'sortBy')).toBe('sortBy');
  });
});

describe('useApiParams prefix', () => {
  it('reads its own prefixed keys under the schema names and ignores the unprefixed ones', () => {
    setMockSearchParams(new URLSearchParams('cveSearch=openssl&search=other&cveStatus=a&cveStatus=b'));
    const { result } = renderHook(() => useApiParams(schema, { prefix: 'cve' }));
    expect(result.current.params).toEqual({ search: 'openssl', status: ['a', 'b'] });
  });

  it('writes prefixed keys and keeps every other param', () => {
    setMockSearchParams(new URLSearchParams('search=other&tab=software'));
    const { result } = renderHook(() => useApiParams(schema, { prefix: 'cve' }));
    act(() => result.current.setParam('search', 'openssl'));
    expect(mockReplace).toHaveBeenCalledTimes(1);
    expect(mockReplace.mock.calls[0]?.[0]).toBe('?search=other&tab=software&cveSearch=openssl');
  });

  it('builds urlSearchParams for fetch with the schema names', () => {
    setMockSearchParams(new URLSearchParams('cveSearch=openssl'));
    const { result } = renderHook(() => useApiParams(schema, { prefix: 'cve' }));
    expect(result.current.urlSearchParams.toString()).toBe('search=openssl');
  });

  it('resetParams with a prefix clears only its own keys', () => {
    setMockSearchParams(new URLSearchParams('cveSearch=openssl&search=other'));
    const { result } = renderHook(() => useApiParams(schema, { prefix: 'cve' }));
    act(() => result.current.resetParams());
    expect(mockReplace.mock.calls[0]?.[0]).toBe('?search=other');
  });
});

describe('useApiParams history', () => {
  it('replaces by default and pushes when the write asks for it', () => {
    const { result } = renderHook(() => useApiParams(schema));
    act(() => result.current.setParam('search', 'a'));
    expect(mockReplace).toHaveBeenCalledTimes(1);
    expect(mockPush).not.toHaveBeenCalled();

    act(() => result.current.setParams({ search: 'b' }, { history: 'push' }));
    expect(mockPush).toHaveBeenCalledTimes(1);
    expect(mockPush.mock.calls[0]?.[0]).toBe('?search=b');
  });
});

describe('useApiParams resetKeys', () => {
  it('drops the pager keys in the SAME write as a filter change, pushing when it dropped one', () => {
    setMockSearchParams(new URLSearchParams('cveSearch=a&cveCursor=Y3Vyc29y&cvePage=3&tab=x'));
    const { result } = renderHook(() =>
      useApiParams(schema, { prefix: 'cve', resetKeys: ['cursor', 'page', 'dir'], resetHistory: 'push' }),
    );
    act(() => result.current.setParam('search', 'b'));
    expect(mockReplace).not.toHaveBeenCalled();
    expect(mockPush).toHaveBeenCalledTimes(1);
    expect(mockPush.mock.calls[0]?.[0]).toBe('?tab=x&cveSearch=b');
  });

  it('replaces when no pager key was in the URL (page 1)', () => {
    setMockSearchParams(new URLSearchParams('cveSearch=a'));
    const { result } = renderHook(() =>
      useApiParams(schema, { prefix: 'cve', resetKeys: ['cursor', 'page'], resetHistory: 'push' }),
    );
    act(() => result.current.setParam('search', 'b'));
    expect(mockPush).not.toHaveBeenCalled();
    expect(mockReplace.mock.calls[0]?.[0]).toBe('?cveSearch=b');
  });

  it('leaves the pager keys alone when the write changes no value', () => {
    setMockSearchParams(new URLSearchParams('cveSearch=a&cveCursor=Y3Vyc29y&cvePage=2'));
    const { result } = renderHook(() =>
      useApiParams(schema, { prefix: 'cve', resetKeys: ['cursor', 'page'], resetHistory: 'push' }),
    );
    act(() => result.current.setParam('search', 'a'));
    expect(mockPush).not.toHaveBeenCalled();
    // A same-value write may still re-order the query string (it always has); the cursor stays.
    for (const [url] of mockReplace.mock.calls) expect(String(url)).toContain('cveCursor=Y3Vyc29y');
  });

  it('keeps a base64 cursor intact through other writes', () => {
    setMockSearchParams(new URLSearchParams('cursor=YWJj%2BZGVm%2F%3D&search=a'));
    const { result } = renderHook(() => useApiParams(schema));
    act(() => result.current.setParam('status', ['x']));
    const written = new URLSearchParams(String(mockReplace.mock.calls[0]?.[0]).slice(1));
    expect(written.get('cursor')).toBe('YWJj+ZGVm/=');
  });
});
