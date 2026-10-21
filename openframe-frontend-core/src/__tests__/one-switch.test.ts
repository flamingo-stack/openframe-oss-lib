/**
 * ONE SWITCH, PER COMPONENT (the loading standard, rule 2): a component that switches itself (calls `useLoadingScope`)
 * is rendered as itself in a loading state, never replaced by its `<XSkeleton>` from somewhere else. The frontend's
 * page gate (`check-page-skeletons.mjs`, `foreignSkeletonRenders`) refuses the same two shapes over its own code; this
 * test holds the lib to them, so the lib cannot hand a host a parent that picks a child's skeleton:
 *
 * - `<XSkeleton>` rendered outside X's module and outside any `*Skeleton` declaration, when X switches itself;
 * - `<XSkeleton>` rendered by a `*Skeleton` declaration whose module renders `<X />` (outside its skeletons) and X
 *   switches itself: the skeleton renders `<X loading />` instead, so the two forms are one structure.
 *
 * Exempt, as in the frontend gate: a card registry entry's own `skeleton:` slot drawing the card its `render:` draws (a
 * registry hands a host the card's skeleton before it has the record). A `// loading-standard-ok: <why>` on the line or
 * one of the two above opts a render out.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

const SRC = join(__dirname, '..');
const OPT_OUT = 'loading-standard-ok:';

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap(name => {
    const path = join(dir, name);
    if (statSync(path).isDirectory())
      return name === '__tests__' || name === 'node_modules' || name.startsWith('.') ? [] : sourceFiles(path);
    return /\.tsx?$/.test(name) && !/\.(stories|test)\.tsx?$/.test(name) ? [path] : [];
  });
}

/** The name of the nearest top-level declaration above `index`, or ''. */
function enclosingDeclaration(source: string, index: number): string {
  const declarations = [
    ...source
      .slice(0, index)
      .matchAll(
        /^(?:export\s+)?(?:default\s+)?(?:async\s+)?(?:function\s*\*?\s*|const\s+|let\s+|class\s+)([A-Za-z_$][\w$]*)/gm,
      ),
  ];
  return declarations[declarations.length - 1]?.[1] ?? '';
}

const isComment = (line: string) => /^\s*(\/\/|\*|\/\*)/.test(line);

/** Every `<XSkeleton>` render that breaks the rule, as `path:line: why`. */
function foreignSkeletonRenders(files: Array<{ path: string; source: string }>): string[] {
  const declaredIn = new Map<string, Set<string>>();
  for (const { path, source } of files) {
    for (const m of source.matchAll(/\b(?:function|const|class)\s+([A-Z][A-Za-z0-9]*)\b/g)) {
      if (!declaredIn.has(m[1])) declaredIn.set(m[1], new Set());
      declaredIn.get(m[1])?.add(path);
    }
  }
  const sourceOf = new Map(files.map(({ path, source }) => [path, source]));
  const switches = (path: string) => /\buseLoadingScope\s*\(/.test(sourceOf.get(path) ?? '');
  const offenders: string[] = [];
  for (const { path, source } of files) {
    const lines = source.split('\n');
    // A `skeleton:` arrow up to its entry's `render:`, with the components that `render` draws (`XChatCard` is X's card).
    const registrySlots: Array<{ start: number; end: number; renders: Set<string> }> = [];
    for (const m of source.matchAll(/\bskeleton:\s*(?:\([^)]*\)|[A-Za-z_$][A-Za-z0-9_$]*)\s*=>/g)) {
      const start = m.index ?? 0;
      const renderAt = source.indexOf('render:', start);
      const nextSlot = source.indexOf('skeleton:', start + 1);
      if (renderAt < 0 || renderAt - start > 1500 || (nextSlot >= 0 && nextSlot < renderAt)) continue;
      const renderEnd = nextSlot >= 0 && nextSlot > renderAt ? Math.min(nextSlot, renderAt + 1500) : renderAt + 1500;
      const renders = new Set(
        [...source.slice(renderAt, renderEnd).matchAll(/<([A-Z][A-Za-z0-9]*)\b/g)].map(r => r[1].replace('Chat', '')),
      );
      registrySlots.push({ start, end: renderAt, renders });
    }
    for (const m of source.matchAll(/<([A-Z][A-Za-z0-9]*)Skeleton\b/g)) {
      const component = m[1];
      const at = m.index ?? 0;
      if (registrySlots.some(({ start, end, renders }) => at > start && at < end && renders.has(component))) continue;
      const own = [...(declaredIn.get(component) ?? []), ...(declaredIn.get(`${component}Skeleton`) ?? [])];
      if (own.includes(path)) continue;
      const modules = [...(declaredIn.get(component) ?? [])];
      // A skeleton with no component of that name (a primitive such as `TextLineSkeleton`) is not a component's switch.
      if (!modules.length || !modules.some(switches)) continue;
      const index = m.index ?? 0;
      const line = source.slice(0, index).split('\n').length;
      if (isComment(lines[line - 1]) || lines.slice(Math.max(0, line - 3), line).some(l => l.includes(OPT_OUT)))
        continue;
      const where = `${relative(SRC, path)}:${line}`;
      const enclosing = enclosingDeclaration(source, index);
      if (/Skeleton$/.test(enclosing)) {
        // A skeleton may compose a child's skeleton only when its module never renders the child itself: once the
        // loaded form renders `<X />` and X switches itself, the skeleton renders `<X loading />` too.
        const moduleRendersChild = [...source.matchAll(new RegExp(`<${component}(?=[\\s/>])`, 'g'))].some(
          r => !/Skeleton$/.test(enclosingDeclaration(source, r.index ?? 0)),
        );
        if (moduleRendersChild)
          offenders.push(
            `${where}: ${enclosing} renders <${component}Skeleton> while this module renders <${component} />`,
          );
        continue;
      }
      offenders.push(`${where}: <${component}Skeleton> rendered outside ${component}'s module`);
    }
  }
  return offenders;
}

describe('one switch per component', () => {
  it('no parent in the lib picks the skeleton of a child that switches itself', () => {
    const files = sourceFiles(SRC).map(path => ({ path, source: readFileSync(path, 'utf8') }));
    expect(foreignSkeletonRenders(files)).toEqual([]);
  });

  it('refuses both shapes on a fixture', () => {
    const child = {
      path: join(SRC, 'fixture/child.tsx'),
      source:
        'export function Child() { if (useLoadingScope()) return <ChildSkeleton />; return <b />; }\nexport function ChildSkeleton() { return <i />; }',
    };
    const parent = {
      path: join(SRC, 'fixture/parent.tsx'),
      source:
        'export function Parent() { return <Child />; }\nexport function ParentSkeleton() { return <ChildSkeleton />; }\nexport function Other({ loading }) { return loading ? <ChildSkeleton /> : <Child />; }\nconst entry = { skeleton: () => <ChildSkeleton />, render: () => <ChildChat /> };',
    };
    expect(foreignSkeletonRenders([child, parent])).toEqual([
      'fixture/parent.tsx:2: ParentSkeleton renders <ChildSkeleton> while this module renders <Child />',
      "fixture/parent.tsx:3: <ChildSkeleton> rendered outside Child's module",
    ]);
  });
});
