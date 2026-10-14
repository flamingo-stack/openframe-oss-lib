import { describe, expect, it } from 'vitest';
import { formatMarkdownLink } from '../markdown-link';
import { markdownToPlainText, stripInlineMarkdown } from '../markdown-to-plain';

const ARTICLE = `# Getting Started
Install with **npm** or \`yarn\`.

- Clone the repo
- Run \`npm install\`

> A quote with a <a href="https://e.com" rel="nofollow">partner</a> &amp; more.

| Tier | Price |
|---|---|
| Basic | $1 |
| Pro | $2 |

\`\`\`bash
npm run dev
\`\`\`
![logo](https://e.com/l.png) Last line.`;

describe('markdownToPlainText: markdown syntax', () => {
  it('reads an article as its text, one block per paragraph', () => {
    expect(markdownToPlainText(ARTICLE)).toBe(
      [
        'Getting Started',
        '',
        'Install with npm or yarn.',
        '',
        'Clone the repo',
        'Run npm install',
        '',
        'A quote with a partner & more.',
        '',
        'Tier\tPrice',
        'Basic\t$1',
        'Pro\t$2',
        '',
        'Last line.',
      ].join('\n'),
    );
  });

  it('collapses to one line in preview mode', () => {
    expect(markdownToPlainText(ARTICLE, { mode: 'preview' })).toBe(
      'Getting Started Install with npm or yarn. Clone the repo Run npm install A quote with a partner & more. Tier Price Basic $1 Pro $2 Last line.',
    );
  });

  it('keeps every table row on its own line, header row included', () => {
    expect(markdownToPlainText('| Q | A |\n|---|---|\n| What | Logs |', { mode: 'preview' })).toBe('Q A What Logs');
    expect(markdownToPlainText('| Q | A |\n|---|---|\n| What | Logs |')).toBe('Q\tA\nWhat\tLogs');
  });

  it('keeps a single line break inside a paragraph, as the renderer does', () => {
    expect(markdownToPlainText('First line\nsecond line')).toBe('First line\nsecond line');
  });

  it('caps the length when asked', () => {
    expect(markdownToPlainText('**Hello** world', { mode: 'preview', maxChars: 5 })).toBe('Hello');
  });
});

describe('markdownToPlainText: raw HTML', () => {
  it('keeps the text of an HTML link, like a markdown link', () => {
    const md = 'See [the docs](https://e.com/a) and <a href="https://e.com/b" rel="nofollow">a partner</a> here.';
    expect(markdownToPlainText(md, { mode: 'preview' })).toBe('See the docs and a partner here.');
  });

  it('reads every link the editors write as its text', () => {
    for (const rel of [[], ['nofollow'], ['sponsored'], ['ugc']] as const) {
      const link = formatMarkdownLink({ text: 'R&D <notes>', url: 'https://e.com/?a=1&b=2', rel: [...rel] });
      expect(markdownToPlainText(`Read ${link} today.`, { mode: 'preview' })).toBe('Read R&D <notes> today.');
    }
  });

  it('drops script and style content, comments and tags, and keeps inline text', () => {
    const md =
      '<div class="takeaway">Key <strong>point</strong></div>\n\n<!-- note --><script>alert(1)</script><style>p{}</style>';
    expect(markdownToPlainText(md, { mode: 'preview' })).toBe('Key point');
  });

  it('turns <br> into a line break in article mode', () => {
    expect(markdownToPlainText('First line<br>second line<br/>third')).toBe('First line\nsecond line\nthird');
  });

  it('leaves inline code and comparisons alone', () => {
    expect(markdownToPlainText('Use `<div>` when a < b and c > d.', { mode: 'preview' })).toBe(
      'Use <div> when a < b and c > d.',
    );
    expect(markdownToPlainText('Run `Hide -Title "*HP*USB*"` now.', { mode: 'preview' })).toBe(
      'Run Hide -Title "*HP*USB*" now.',
    );
  });

  it('decodes entities and resolves escapes', () => {
    expect(markdownToPlainText('Tom &amp; Jerry &lt;3 &quot;cartoons&quot; \\*not italic\\*')).toBe(
      'Tom & Jerry <3 "cartoons" *not italic*',
    );
  });
});

describe('stripInlineMarkdown', () => {
  // Heading ids are built on it: its output must never change.
  it('is unchanged', () => {
    expect(stripInlineMarkdown('See **[the docs](https://e.com)** and `code` *here*')).toBe(
      'See the docs and code here',
    );
  });
});
