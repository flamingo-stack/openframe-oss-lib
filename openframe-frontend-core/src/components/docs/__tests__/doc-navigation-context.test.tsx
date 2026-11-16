import { renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { DocNode } from '../../../types/doc-source';
import { DocNavigationProvider, type DocNavigator, useDocNavigation } from '../doc-navigation-context';

const nodeFor = (path: string) => ({ path }) as unknown as DocNode;

function navigatorAt(baseRoute: string, paths: string[]) {
  const selectNode = vi.fn();
  const navigator: DocNavigator = {
    baseRoute,
    findNodeByPath: path => (paths.includes(path) ? nodeFor(path) : null),
    selectNode,
  };
  return { navigator, selectNode };
}

const wrapper = ({ children }: { children: ReactNode }) => <DocNavigationProvider>{children}</DocNavigationProvider>;

describe('DocNavigationProvider', () => {
  it('finds a route under a baseRoute by the tree path after it, decoded', () => {
    const { result } = renderHook(() => useDocNavigation(), { wrapper });
    const { navigator, selectNode } = navigatorAt('/knowledge-base', ['docs/my guide.md']);
    result.current.register(navigator);
    expect(result.current.navigate('/knowledge-base/docs/my%20guide.md?x=1#top')).toBe(true);
    expect(selectNode).toHaveBeenCalledWith(nodeFor('docs/my guide.md'));
  });

  it('a longer baseRoute wins over its parent', () => {
    const { result } = renderHook(() => useDocNavigation(), { wrapper });
    const parent = navigatorAt('/docs', ['nested/a.md']);
    const child = navigatorAt('/docs/nested', ['a.md']);
    result.current.register(parent.navigator);
    result.current.register(child.navigator);
    expect(result.current.navigate('/docs/nested/a.md')).toBe(true);
    expect(child.selectNode).toHaveBeenCalled();
    expect(parent.selectNode).not.toHaveBeenCalled();
  });

  it('answers false for a route under a baseRoute the tree does not hold, leaving it a link', () => {
    const { result } = renderHook(() => useDocNavigation(), { wrapper });
    const { navigator, selectNode } = navigatorAt('/knowledge-base', ['a.md']);
    result.current.register(navigator);
    expect(result.current.navigate('/knowledge-base/missing.md')).toBe(false);
    expect(result.current.navigate('/knowledge-base/%E0%A4%A')).toBe(false);
    expect(selectNode).not.toHaveBeenCalled();
  });

  it('the single navigator takes a storage path, and two navigators take none', () => {
    const { result } = renderHook(() => useDocNavigation(), { wrapper });
    const first = navigatorAt('/knowledge-base', ['a.md']);
    const unregister = result.current.register(first.navigator);
    expect(result.current.navigate('a.md')).toBe(true);
    expect(first.selectNode).toHaveBeenCalledTimes(1);

    const second = navigatorAt('/data-room', ['a.md']);
    result.current.register(second.navigator);
    expect(result.current.navigate('a.md')).toBe(false);
    unregister();
    expect(result.current.navigate('a.md')).toBe(true);
    expect(second.selectNode).toHaveBeenCalledTimes(1);
  });
});
