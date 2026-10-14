import { describe, expect, it } from 'vitest';
import {
  authoredRelTokens,
  findMarkdownLinkAt,
  formatMarkdownLink,
  isNofollowRel,
  renderedLinkRel,
} from '../markdown-link';

describe('renderedLinkRel', () => {
  it("keeps today's output for a link with no authored rel", () => {
    expect(renderedLinkRel(undefined, true)).toBe('noopener noreferrer');
    expect(renderedLinkRel(undefined, false)).toBeUndefined();
  });

  it('adds nofollow before noopener noreferrer', () => {
    expect(renderedLinkRel('nofollow', true)).toBe('nofollow noopener noreferrer');
    expect(renderedLinkRel(['NoFollow'], true)).toBe('nofollow noopener noreferrer');
  });

  it('keeps only the SEO tokens an author may set', () => {
    expect(renderedLinkRel('me opener nofollow', false)).toBe('nofollow');
    expect(renderedLinkRel('sponsored ugc nofollow', false)).toBe('nofollow ugc sponsored');
    expect(authoredRelTokens('external me')).toEqual([]);
  });
});

describe('findMarkdownLinkAt', () => {
  const text = 'See [the docs](https://example.com/a) and <a href="https://x.com/b?a=1&amp;c=2" rel="nofollow">X</a>.';

  it('finds a markdown link under the caret', () => {
    const at = text.indexOf('docs');
    expect(findMarkdownLinkAt(text, at)).toEqual({
      start: 4,
      end: 37,
      text: 'the docs',
      url: 'https://example.com/a',
      rel: [],
    });
  });

  it('finds an HTML anchor and reads its nofollow', () => {
    const link = findMarkdownLinkAt(text, text.indexOf('>X<') + 1);
    expect(link).toMatchObject({ text: 'X', url: 'https://x.com/b?a=1&c=2', rel: ['nofollow'] });
    if (!link) return;
    expect(text.slice(link.start, link.end)).toBe('<a href="https://x.com/b?a=1&amp;c=2" rel="nofollow">X</a>');
  });

  it('returns null outside a link, and for an image', () => {
    expect(findMarkdownLinkAt(text, 1)).toBeNull();
    expect(findMarkdownLinkAt('![alt](https://e.com/i.png)', 3)).toBeNull();
  });

  it('needs the whole selection inside the link', () => {
    expect(findMarkdownLinkAt(text, 0, 10)).toBeNull();
  });
});

describe('formatMarkdownLink', () => {
  it('writes a followed link as markdown', () => {
    expect(formatMarkdownLink({ text: 'a [b]', url: 'https://e.com/x y', rel: [] })).toBe(
      '[a \\[b\\]](https://e.com/x%20y)',
    );
  });

  it('writes a nofollow link as an HTML anchor, escaped', () => {
    expect(formatMarkdownLink({ text: 'R&D <x>', url: 'https://e.com/?a="1"', rel: ['nofollow'] })).toBe(
      '<a href="https://e.com/?a=&quot;1&quot;" rel="nofollow">R&amp;D &lt;x&gt;</a>',
    );
  });

  it('escapes < in a followed link so its text is never read as an HTML tag', () => {
    const written = formatMarkdownLink({ text: 'see <notes>', url: 'https://e.com', rel: [] });
    expect(written).toBe('[see \\<notes>](https://e.com)');
    expect(findMarkdownLinkAt(written, 2)).toMatchObject({ text: 'see <notes>', rel: [] });
  });

  it('uses the URL as the text when the text is empty', () => {
    expect(formatMarkdownLink({ text: '', url: 'https://e.com', rel: [] })).toBe('[https://e.com](https://e.com)');
  });

  it('writes sponsored, ugc and combined values as one rel', () => {
    expect(formatMarkdownLink({ text: 'Ad', url: 'https://e.com', rel: ['sponsored'] })).toBe(
      '<a href="https://e.com" rel="sponsored">Ad</a>',
    );
    expect(formatMarkdownLink({ text: 'c', url: 'https://e.com', rel: ['ugc', 'nofollow'] })).toBe(
      '<a href="https://e.com" rel="nofollow ugc">c</a>',
    );
  });

  it('round-trips through findMarkdownLinkAt for every choice', () => {
    const choices: Parameters<typeof formatMarkdownLink>[0]['rel'][] = [
      [],
      ['nofollow'],
      ['sponsored'],
      ['ugc'],
      ['nofollow', 'ugc'],
    ];
    for (const rel of choices) {
      const written = formatMarkdownLink({ text: 'a [b] & c', url: 'https://e.com/p?q=1&r=2', rel });
      const read = findMarkdownLinkAt(written, 2);
      expect(read).toMatchObject({ text: 'a [b] & c', url: 'https://e.com/p?q=1&r=2', rel });
      expect(isNofollowRel(rel)).toBe(rel.includes('nofollow'));
    }
  });
});
