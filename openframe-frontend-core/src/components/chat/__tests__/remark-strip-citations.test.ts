import type { Root } from 'mdast';
import { unified } from 'unified';
import { describe, expect, it } from 'vitest';
import { remarkStripCitations } from '../remark-strip-citations';

describe('remarkStripCitations', () => {
  it('removes a citation-only list without leaving broken punctuation', () => {
    const tree: Root = {
      type: 'root',
      children: [
        {
          type: 'paragraph',
          children: [{ type: 'text', value: 'Sources [1], [2], and [3] are cited.' }],
        },
      ],
    };

    const result = unified().use(remarkStripCitations).runSync(tree);

    expect(result).toMatchObject({
      children: [
        {
          children: [{ type: 'text', value: 'Sources are cited.' }],
        },
      ],
    });
  });

  it('keeps prose punctuation while removing individual citations', () => {
    const tree: Root = {
      type: 'root',
      children: [
        {
          type: 'paragraph',
          children: [{ type: 'text', value: 'Install on Windows [1], verify the service [2], and confirm Devices [3].' }],
        },
      ],
    };

    const result = unified().use(remarkStripCitations).runSync(tree);

    expect(result).toMatchObject({
      children: [
        {
          children: [{ type: 'text', value: 'Install on Windows, verify the service, and confirm Devices.' }],
        },
      ],
    });
  });
});
