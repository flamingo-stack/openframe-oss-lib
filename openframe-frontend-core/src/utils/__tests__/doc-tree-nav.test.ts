import { describe, expect, it } from 'vitest';
import type { DocNode } from '../../types/doc-source';
import { rootDocumentPath } from '../doc-tree-nav';

const file = (path: string, documentType?: DocNode['documentType']): DocNode => ({
  id: path,
  name: path,
  slug: path,
  path,
  type: 'file',
  documentType,
});
const folder = (path: string, children: DocNode[]): DocNode => ({
  id: path,
  name: path,
  slug: path,
  path,
  type: 'folder',
  children,
});

describe('rootDocumentPath', () => {
  it('shows the folder index when the root has one', () => {
    expect(rootDocumentPath([folder('a', [file('a/x', 'pdf')]), file('README.md')])).toBe('README.md');
  });

  it('shows the first document when the root has no index, its own files before its folders', () => {
    expect(rootDocumentPath([folder('a', [file('a/x', 'pdf')]), file('deck', 'figma')])).toBe('deck');
    expect(rootDocumentPath([folder('time-off', [file('time-off/policy-2027'), file('time-off/policy-2026')])])).toBe(
      'time-off/policy-2027',
    );
  });

  it('never shows a diagram source, and is null for a tree with no document', () => {
    expect(rootDocumentPath([folder('a', [file('a/flow.mmd')])])).toBeNull();
    expect(rootDocumentPath([folder('empty', [])])).toBeNull();
    expect(rootDocumentPath([])).toBeNull();
  });
});
