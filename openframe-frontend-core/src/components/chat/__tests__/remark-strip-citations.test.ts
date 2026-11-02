import type { Root, Text } from 'mdast';
import type { Transformer } from 'unified';
import { describe, expect, it } from 'vitest';
import { remarkStripCitations } from '../remark-strip-citations';

/** The text of one paragraph after the plugin ran. */
function strip(value: string): string {
  const tree: Root = { type: 'root', children: [{ type: 'paragraph', children: [{ type: 'text', value }] }] };
  const transform = (remarkStripCitations as unknown as () => Transformer<Root>)();
  void transform(tree, undefined as never, () => {});
  const paragraph = tree.children[0];
  return paragraph.type === 'paragraph' ? (paragraph.children[0] as Text).value : '';
}

describe('remarkStripCitations', () => {
  // CU-17tkuw61kfy: the removed number left its space, so an answer read "…PowerShell command) ."
  it('leaves no space before the punctuation that followed a removed number', () => {
    expect(strip('run the single PowerShell command [1]. Then check Devices [2].')).toBe(
      'run the single PowerShell command. Then check Devices.',
    );
  });

  it('removes a run of numbers, as models write them', () => {
    expect(strip('an optional override [1][2]. Once installed')).toBe('an optional override. Once installed');
  });

  it('keeps one space between words around a number mid-sentence', () => {
    expect(strip('the guide [3] covers it')).toBe('the guide covers it');
  });

  it('leaves indexing in prose untouched', () => {
    expect(strip('read array[1] and foo[12]bar')).toBe('read array[1] and foo[12]bar');
  });
});
