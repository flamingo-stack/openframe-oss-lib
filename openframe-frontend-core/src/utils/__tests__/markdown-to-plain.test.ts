import { describe, expect, it } from 'vitest';
import { formatMarkdownLink } from '../markdown-link';
import { markdownToPlainText } from '../markdown-to-plain';

describe('markdownToPlainText: raw HTML', () => {
  it('keeps the text of an HTML link, like a markdown link', () => {
    const md = 'See [the docs](https://e.com/a) and <a href="https://e.com/b" rel="nofollow">a partner</a> here.';
    expect(markdownToPlainText(md, { mode: 'preview' })).toBe('See the docs and a partner here.');
  });

  it('reads every link the editors write as its text', () => {
    for (const rel of [[], ['nofollow'], ['sponsored'], ['ugc']] as const) {
      const link = formatMarkdownLink({ text: 'R&D notes', url: 'https://e.com/?a=1&b=2', rel: [...rel] });
      expect(markdownToPlainText(`Read ${link} today.`, { mode: 'preview' })).toBe('Read R&D notes today.');
    }
  });

  it('drops script and style content, comments and tags, and keeps inline text', () => {
    const md =
      '<div class="takeaway">Key <strong>point</strong></div><!-- note --><script>alert(1)</script><style>p{}</style>';
    expect(markdownToPlainText(md, { mode: 'preview' })).toBe('Key point');
  });

  it('turns <br> into a line break in article mode', () => {
    expect(markdownToPlainText('First line<br>second line<br/>third')).toBe('First line\nsecond line\nthird');
  });

  it('leaves inline code and comparisons alone', () => {
    expect(markdownToPlainText('Use `<div>` when a < b and c > d.', { mode: 'preview' })).toBe(
      'Use <div> when a < b and c > d.',
    );
  });

  it('decodes the common entities', () => {
    expect(markdownToPlainText('Tom &amp; Jerry &lt;3 &quot;cartoons&quot;&nbsp;&#39;n&#39; more')).toBe(
      'Tom & Jerry <3 "cartoons" \'n\' more',
    );
  });
});
