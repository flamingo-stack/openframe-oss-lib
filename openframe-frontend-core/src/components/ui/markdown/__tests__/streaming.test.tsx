import { render, act } from '@testing-library/react';
/**
 * Streaming-path tests for the unified markdown engine (plan §D1):
 * atomic-block splitting, fence tail-completion, card-block cache
 * exclusion, and — critically — that the COMPLETION render (streaming
 * flipped off) equals the whole-document parse for every cross-block
 * construct (late reference defs, loose-list numbering, footnote-ish
 * splits, blockquote-internal blank lines, streamed tables).
 */
import type React from 'react';
import type { Components } from 'react-markdown';
import { describe, it, expect, vi } from 'vitest';
import type { MdRenderProps } from '../base-components';
import { MarkdownEngine } from '../engine';
import { splitStreamingBlocks, completeStreamingTail } from '../streaming';

vi.mock('mermaid', () => ({
  default: {
    initialize: vi.fn(),
    // Promise-returning without `async`: the real `mermaid.render` is async and
    // the component awaits it, so the mock must keep that contract.
    render: vi.fn(() => Promise.resolve({ svg: '<svg data-mock-mermaid="true"></svg>' })),
  },
}));

async function renderHtml(ui: React.ReactElement): Promise<string> {
  // `render` commits inside its own `act`. The second, async `act` exists
  // only to drain what that commit queued (the mermaid dynamic-import chain).
  const { container } = render(ui);
  await act(async () => {
    await new Promise(r => setTimeout(r, 0));
  });
  return container.innerHTML;
}

describe('splitStreamingBlocks', () => {
  it('splits plain paragraphs at blank lines', () => {
    const blocks = splitStreamingBlocks('para one\n\npara two\n\npara three');
    expect(blocks.map(b => b.memoizable)).toEqual([true, true, false]);
    expect(blocks[0].text).toContain('para one');
    expect(blocks[2].text).toContain('para three');
  });

  it('never cuts inside a fenced code block', () => {
    const blocks = splitStreamingBlocks('```js\ncode\n\nmore code\n```\n\nafter');
    expect(blocks).toHaveLength(2);
    expect(blocks[0].text).toContain('more code');
  });

  it('never cuts a loose ordered list apart', () => {
    const md = '1. first\n\n2. second\n\n3. third';
    const blocks = splitStreamingBlocks(md);
    expect(blocks).toHaveLength(1);
  });

  it('never cuts a multi-paragraph blockquote apart', () => {
    const md = '> first para\n\n> second para';
    expect(splitStreamingBlocks(md)).toHaveLength(1);
  });

  it('does not cut before an indented continuation line', () => {
    const md = '- item one\n\n  continuation of item one\n\nnext para';
    const blocks = splitStreamingBlocks(md);
    expect(blocks[0].text).toContain('continuation');
  });

  it('marks card:// and mention:// blocks non-memoizable (stale-card fix)', () => {
    const blocks = splitStreamingBlocks(
      'plain text block\n\nSee [card://blog:x] here\n\nCheck @device:r1 via mention\n\ntail',
    );
    expect(blocks.map(b => b.memoizable)).toEqual([true, false, true, false]);
    // mention text without mention:// scheme stays memoizable; the scheme
    // appears post-remark, so the splitter keys on the raw marker too:
    const withScheme = splitStreamingBlocks('a [x](mention://device:r1) link\n\ntail');
    expect(withScheme[0].memoizable).toBe(false);
  });

  it('marks reference-definition/use and footnote blocks non-memoizable', () => {
    const blocks = splitStreamingBlocks(
      'See [text][ref] please\n\n[ref]: https://example.com\n\nA footnote[^1] here\n\ntail',
    );
    expect(blocks.map(b => b.memoizable)).toEqual([false, false, false, false]);
  });

  it('keys blocks by position so identical blocks never alias', () => {
    const blocks = splitStreamingBlocks('---\n\n---\n\nend');
    expect(blocks.map(b => b.index)).toEqual([0, 1, 2]);
  });

  // --- fence-marker fidelity (reviewer-reported failures) ---
  it('does not let ~~~ close a ``` fence', () => {
    const md = '```text\nline\n~~~\n\nstill in code\n```\n\nafter';
    const blocks = splitStreamingBlocks(md);
    // The whole code block stays ONE unit; only the trailing prose splits.
    expect(blocks).toHaveLength(2);
    expect(blocks[0].text).toContain('still in code');
    expect(blocks[1].text.trim()).toBe('after');
  });

  it('does not let ``` close a ~~~ fence', () => {
    const blocks = splitStreamingBlocks('~~~text\nline\n```\n\nstill in code\n~~~\n\nafter');
    expect(blocks).toHaveLength(2);
    expect(blocks[0].text).toContain('still in code');
  });

  it('ignores fences inside 4-space-indented code (CommonMark caps indent at 3)', () => {
    const blocks = splitStreamingBlocks('    ```\n    not a fence\n\nreal para\n\ntail');
    expect(blocks.length).toBeGreaterThan(1);
    expect(blocks.some(b => b.text.includes('real para'))).toBe(true);
  });

  it('requires the closer to be at least as long as the opener', () => {
    // The inner ``` is CONTENT of the ````-opened block.
    const blocks = splitStreamingBlocks('````\n```\n\ninner\n````\n\nafter');
    expect(blocks).toHaveLength(2);
    expect(blocks[0].text).toContain('inner');
  });

  // --- raw HTML block integrity ---
  it('never cuts inside an unbalanced raw HTML block', () => {
    const blocks = splitStreamingBlocks('<details>\n<summary>More</summary>\n\nbody text\n\n</details>\n\ntail');
    expect(blocks).toHaveLength(2);
    expect(blocks[0].text).toContain('body text');
    expect(blocks[0].text).toContain('</details>');
    // Raw HTML units are never cached.
    expect(blocks.every(b => !b.memoizable)).toBe(true);
  });

  it('never cuts inside a MULTI-LINE start tag', () => {
    // `HTML_TAG_RE` needs `>` on the same line, so `<div\n class="x">` never
    // opened the container: the splitter cut at every blank line and marked
    // the fragments memoizable — the container's body escaped the div and
    // the broken render got cached.
    const blocks = splitStreamingBlocks('<div\n  class="x">\n\nbody\n\n</div>\n\nafter');
    expect(blocks).toHaveLength(2);
    expect(blocks[0].text).toContain('body');
    expect(blocks[0].text).toContain('</div>');
    expect(blocks.every(b => !b.memoizable)).toBe(true);
  });

  it('releases the latch when a container closes MID-LINE', () => {
    // A close tag not at column 0..3 (`some text </details>`) never
    // decremented, so `htmlDepth` latched >0 and the whole rest of the
    // message collapsed into ONE non-memoizable unit for the rest of the
    // stream.
    const blocks = splitStreamingBlocks('<details>\nstuff\n\nsome text </details>\n\nafter\n\nmore\n\ntail');
    expect(blocks).toHaveLength(4);
    expect(blocks[0].text).toContain('</details>');
    expect(blocks[0].memoizable).toBe(false);
    // Cutting resumed — the plain paragraphs after the container cache again.
    expect(blocks.map(b => b.memoizable)).toEqual([false, true, true, false]);
  });

  it('sees raw HTML indented to a list item content column', () => {
    // The old column-0..3 gate missed this entirely, so the unit was marked
    // memoizable despite containing raw HTML.
    const blocks = splitStreamingBlocks('1.  step\n\n    <details>\n    <summary>x</summary>\n    </details>\n\ntail');
    expect(blocks[0].text).toContain('<details>');
    expect(blocks[0].memoizable).toBe(false);
  });

  it('caps the latch so an unclosed container cannot disable cutting forever', () => {
    const paras = Array.from({ length: 300 }, (_, i) => `para ${i}`).join('\n\n');
    const blocks = splitStreamingBlocks(`<div>\n\n${paras}`);
    // Past the cap the splitter resumes cutting…
    expect(blocks.length).toBeGreaterThan(1);
    // …but nothing inside the still-open container is ever cached.
    expect(blocks.every(b => !b.memoizable)).toBe(true);
  });

  it('reports each unit’s document-wide startLine', () => {
    const blocks = splitStreamingBlocks('one\n\ntwo\n\nthree');
    expect(blocks.map(b => b.startLine)).toEqual([1, 3, 5]);
  });
});

describe('completeStreamingTail', () => {
  it('closes an unterminated fence', () => {
    expect(completeStreamingTail('text\n\n```js\nconst x =')).toMatch(/```$/);
  });
  it('leaves balanced fences alone', () => {
    const md = '```js\ncode\n```';
    expect(completeStreamingTail(md)).toBe(md);
  });
  it('does NOT touch stray emphasis/link openers (no false-positive close)', () => {
    for (const md of ['2 * 3 is six', 'a lone _ under', 'an open [ bracket', 'tick ` alone']) {
      expect(completeStreamingTail(md)).toBe(md);
    }
  });

  it('does not append a bogus fence when ``` and ~~~ both appear (closed block)', () => {
    const md = '```\n~~~\n```';
    expect(completeStreamingTail(md)).toBe(md);
  });

  it('does not append a bogus fence to a ```-block containing a ~~~ line', () => {
    const md = '```text\nline\n~~~\n\nstill in code\n```\n\nafter';
    expect(completeStreamingTail(md)).toBe(md);
  });

  it('closes an unterminated ~~~ fence with ~~~ (the RECORDED opener)', () => {
    expect(completeStreamingTail('~~~py\nx =')).toBe('~~~py\nx =\n~~~');
  });

  it('closes with a run at least as long as the opener', () => {
    expect(completeStreamingTail('````\nstuff')).toBe('````\nstuff\n````');
  });
});

describe('MarkdownEngine streaming vs completion equivalence', () => {
  const textOf = (html: string) =>
    html
      .replace(/<style[\s\S]*?<\/style>/, '')
      .replace(/<[^>]+>/g, '')
      .replace(/\s+/g, '');

  const CASES: Record<string, { md: string; transientTextDivergence?: boolean }> = {
    'loose list keeps numbering': { md: '1. first\n\n2. second\n\n3. third' },
    // Reference links are the DOCUMENTED acceptable mid-stream transient:
    // the use renders literally until the def arrives; completion self-heals.
    'late reference definition resolves': {
      md: 'See [the docs][ref] now.\n\n[ref]: https://example.com/late',
      transientTextDivergence: true,
    },
    'blockquote with internal blank line': { md: '> first\n>\n> second' },
    'gfm table': { md: '| A | B |\n|---|---|\n| 1 | 2 |' },
    'multi-block document': { md: '# Title\n\npara one\n\n- a\n- b\n\npara two' },
  };

  for (const [name, { md, transientTextDivergence }] of Object.entries(CASES)) {
    it(`completion render equals whole-document parse: ${name}`, async () => {
      const streamingHtml = await renderHtml(<MarkdownEngine content={md} streaming />);
      const completedHtml = await renderHtml(<MarkdownEngine content={md} streaming={false} />);
      const wholeHtml = await renderHtml(<MarkdownEngine content={md} />);
      // Completion IS the authoritative whole-document parse — always.
      expect(completedHtml).toBe(wholeHtml);
      // Asserted in BOTH directions rather than skipped for the flagged case:
      // a `transientTextDivergence` entry that quietly starts matching means
      // the flag is stale, and a skipped assertion would never say so.
      expect(textOf(streamingHtml) === textOf(wholeHtml), `${name}: mid-stream text vs whole-document text`).toBe(
        !transientTextDivergence,
      );
    });
  }

  /**
   * The `textOf` comparison above cannot see this class of divergence: when a
   * list is cut apart, every remaining item becomes its own `<ol>`/`<ul>` with
   * no `start`, so the TEXT is identical while the visible ordinals restart at
   * "1." for every item. The assertion therefore has to be on list STRUCTURE.
   *
   * The shape is the single most common assistant answer — numbered steps whose
   * items carry a code fence, a second paragraph, a table, or a nested list — and
   * the broken units were `memoizable`, so the wrong render was CACHED for the
   * rest of the turn rather than self-healing on the next token.
   */
  const LIST_CONTINUATION_CASES: Record<string, string> = {
    'ordered list with per-item code fences': '1. Install:\n\n   ```bash\n   npm i\n   ```\n\n2. Run it.\n\n3. Done.\n',
    'ordered list with 4-space-indented fences': '1. Install:\n\n    ```bash\n    npm i\n    ```\n\n2. Run it.\n',
    'list item with a second paragraph': '- item\n\n  second para of item\n\n- item2\n',
    'list item with a table continuation': '1. Options:\n\n   | a | b |\n   |---|---|\n   | 1 | 2 |\n\n2. Next step.\n',
    'list item with a nested sublist': '- item\n    - nested\n\n- item2\n',
    'a list that follows an unrelated paragraph': '- one\n\n- two\n\nplain para\n\n- three\n\n  cont\n\n- four\n',
  };

  for (const [name, md] of Object.entries(LIST_CONTINUATION_CASES)) {
    it(`never cuts a list apart mid-stream: ${name}`, async () => {
      const streamingHtml = await renderHtml(<MarkdownEngine content={md} streaming />);
      const wholeHtml = await renderHtml(<MarkdownEngine content={md} />);
      const listCount = (html: string) => (html.match(/<[ou]l[\s>]/g) ?? []).length;
      expect(listCount(streamingHtml)).toBe(listCount(wholeHtml));
      expect(textOf(streamingHtml)).toBe(textOf(wholeHtml));
    });
  }

  it('splits a list with a continuation block into ONE unit', () => {
    const md = '1. Install:\n\n   ```bash\n   npm i\n   ```\n\n2. Run it.\n\n3. Done.\n';
    expect(splitStreamingBlocks(md)).toHaveLength(1);
  });

  it('still cuts between a list and a genuinely separate following block', () => {
    // The guard must not become "never cut once a list appeared" — a paragraph
    // after a list is a real boundary and its unit must stay memoizable.
    const blocks = splitStreamingBlocks('- one\n\n- two\n\nplain para\n\ntail para\n');
    expect(blocks.length).toBeGreaterThan(1);
    expect(blocks[0].text).toContain('- one');
    expect(blocks[0].memoizable).toBe(true);
  });

  it('streaming wrapper is aria-live polite', async () => {
    const html = await renderHtml(<MarkdownEngine content={'hello'} streaming />);
    expect(html).toContain('aria-live="polite"');
    const done = await renderHtml(<MarkdownEngine content={'hello'} />);
    expect(done).not.toContain('aria-live');
  });

  it('raw HTML block renders identically mid-stream and completed', async () => {
    const md = '<details>\n<summary>More</summary>\n\nbody text\n\n</details>\n\ntail';
    const streamingHtml = await renderHtml(<MarkdownEngine content={md} streaming />);
    const wholeHtml = await renderHtml(<MarkdownEngine content={md} />);
    // Strip only the streaming aria-live wrapper; the disclosure widget and
    // its body must be structurally identical (body INSIDE <details>, the
    // closing tag not dropped).
    const stripWrapper = (html: string) =>
      html
        .replace('<div aria-live="polite" aria-relevant="additions text">', '')
        .replace('</div></article>', '</article>');
    expect(streamingHtml).toContain('<details');
    expect(streamingHtml).toContain('body text');
    expect(stripWrapper(streamingHtml).replace(/\s+/g, '')).toBe(stripWrapper(wholeHtml).replace(/\s+/g, ''));
  });

  it('unterminated fence at the tail renders as code, not swallowed prose', async () => {
    const html = await renderHtml(<MarkdownEngine content={'intro\n\n```js\nconst partial ='} streaming />);
    expect(html).toContain('code-block-container');
    // hljs wraps tokens in spans — compare tag-stripped text.
    expect(html.replace(/<[^>]+>/g, '')).toContain('const partial =');
  });
});

// ---------------------------------------------------------------------------
// Atomic-block memo (regression: the memo never hit)
// ---------------------------------------------------------------------------
describe('streaming atomic-block memoization', () => {
  /**
   * Module-scope so the override map's IDENTITY is stable across rerenders —
   * otherwise the test would be measuring its own instability instead of the
   * engine's. The counter proves memo HITS: without it, DOM reconciliation
   * reuses the same nodes either way, so node identity alone cannot fail.
   */
  let paragraphRenders = 0;
  const COUNTING_OVERRIDES: Partial<Components> = {
    p: ({ children }: MdRenderProps<'p'>) => {
      paragraphRenders++;
      return <p>{children}</p>;
    },
  };

  it('does NOT re-render completed blocks when the tail grows', async () => {
    const base = 'alpha para\n\nbeta para\n\ngamma tail';
    paragraphRenders = 0;

    const { container, rerender } = render(
      <MarkdownEngine content={base} streaming componentOverrides={COUNTING_OVERRIDES} />,
    );
    await act(async () => {
      await new Promise(r => setTimeout(r, 0));
    });

    const firstParagraph = container.querySelector('p');
    expect(firstParagraph?.textContent).toBe('alpha para');
    expect(paragraphRenders).toBe(3);

    const before = paragraphRenders;
    await act(async () => {
      rerender(<MarkdownEngine content={`${base} and more`} streaming componentOverrides={COUNTING_OVERRIDES} />);
      await new Promise(r => setTimeout(r, 0));
    });

    // Only the live tail may re-parse. Before the NO_BROKEN_LINKS fix the
    // `components` memo re-created every render, so all THREE re-rendered.
    expect(paragraphRenders - before).toBe(1);
    // …and the completed block's DOM node is the very same element.
    expect(Object.is(container.querySelector('p'), firstParagraph)).toBe(true);
  });

  it('survives heading ids: appending prose does not bust the block memo', async () => {
    // The heading-id map is rebuilt on EVERY token (its input is the growing
    // `processedContent`). It therefore reaches the heading renderers via
    // CONTEXT, never through the `components` memo — otherwise its changing
    // identity would re-create `components` per token and every completed
    // block's `memo` would bail, exactly the regression above.
    const base = '## Setup\n\nalpha para\n\nbeta para\n\ngamma tail';
    paragraphRenders = 0;

    const { container, rerender } = render(
      <MarkdownEngine content={base} streaming componentOverrides={COUNTING_OVERRIDES} />,
    );
    await act(async () => {
      await new Promise(r => setTimeout(r, 0));
    });
    const firstParagraph = container.querySelector('p');
    const before = paragraphRenders;

    await act(async () => {
      rerender(<MarkdownEngine content={`${base} and more`} streaming componentOverrides={COUNTING_OVERRIDES} />);
      await new Promise(r => setTimeout(r, 0));
    });
    expect(paragraphRenders - before).toBe(1);
    expect(Object.is(container.querySelector('p'), firstParagraph)).toBe(true);

    // A tail that DOES add a heading still gets correct, unique ids.
    await act(async () => {
      rerender(
        <MarkdownEngine content={`${base}\n\n## Setup\n\nsecond`} streaming componentOverrides={COUNTING_OVERRIDES} />,
      );
      await new Promise(r => setTimeout(r, 0));
    });
    const ids = Array.from(container.querySelectorAll('h2')).map(el => el.id);
    expect(ids).toEqual(['setup', 'setup-2']);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
