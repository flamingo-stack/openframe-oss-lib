/**
 * The inline tokens (`@marker:id`, `[card://type:id]`) in every markdown shape a model writes them in, through the
 * SAME parse the chat body runs (CommonMark + GFM). Each case pins what the body draws AND what the pre-scans read
 * (`scanChatTokens`), because the two used to be separate regexes that disagreed.
 */

import type { Link, Nodes, Root } from 'mdast';
import remarkGfm from 'remark-gfm';
import remarkParse from 'remark-parse';
import { unified } from 'unified';
import { describe, expect, it } from 'vitest';
import { type ChatToken, parseTokenHref, remarkCardLinks, remarkMentionChips, scanChatTokens } from '../inline-tokens';

const ID = '6aad91a3b776f95ad7491bd9';

/** The hrefs the body draws, in order, and whether any is nested in another link. */
function body(markdown: string): { hrefs: string[]; nested: boolean } {
  const processor = unified().use(remarkParse).use(remarkGfm).use(remarkCardLinks).use(remarkMentionChips);
  const tree = processor.runSync(processor.parse(markdown), markdown) as Root;
  const hrefs: string[] = [];
  let nested = false;
  const visit = (node: Nodes, inLink: boolean) => {
    if (node.type === 'link') {
      hrefs.push((node as Link).url);
      if (inLink) nested = true;
    }
    if ('children' in node) for (const c of node.children as Nodes[]) visit(c, inLink || node.type === 'link');
  };
  visit(tree, false);
  return { hrefs, nested };
}

function tokens(markdown: string): ChatToken[] {
  return scanChatTokens(markdown, ['mention', 'card']);
}

describe('tokens the body draws', () => {
  it.each([
    ['plain text', `see @script:${ID} now`],
    ['bold', `see **@script:${ID}** now`],
    ['a code span that is exactly the token', `see \`@script:${ID}\` now`],
    ['a link whose text is exactly the token', `see [@script:${ID}](/scripts/details?id=x) now`],
    ['a table cell', `| a | b |\n|---|---|\n| @script:${ID} | x |`],
    ['inside parentheses', `things like @script:${ID} (Write marker file), and more`],
  ])('a mention in %s', (_name, markdown) => {
    const drawn = body(markdown);
    expect(drawn.hrefs).toEqual([`mention://script:${ID}`]);
    expect(drawn.nested).toBe(false);
    expect(tokens(markdown).map(t => `${t.type}:${t.id}`)).toEqual([`script:${ID}`]);
  });

  it.each([
    ['plain text', 'see [card://webinar:42] now', 'webinar:42'],
    ['a code span', 'see `[card://webinar:42]` now', 'webinar:42'],
    ['a link whose text is the marker', 'see [card://webinar:42](https://example.com) now', 'webinar:42'],
    ['a link written with the scheme', 'see [the webinar](card://webinar:42) now', 'webinar:42'],
    ['an angle autolink', 'see <card://webinar:42> now', 'webinar:42'],
    ['an id markdown reads as emphasis', 'see [card://blog:a*b*c] now', 'blog:abc'],
    ['an id GFM autolinks as an e-mail', 'see [card://tenant:owner@acme.com] now', 'tenant:owner@acme.com'],
    ['an id GFM autolinks as a URL', 'see [card://doc:https://acme.com/a] now', 'doc:https://acme.com/a'],
    ['an id holding a colon', 'see [card://doc:urn:x:1] now', 'doc:urn:x:1'],
  ])('a card marker in %s', (_name, markdown, key) => {
    const drawn = body(markdown);
    expect(drawn.hrefs).toEqual([`card://${key}`]);
    expect(drawn.nested).toBe(false);
    expect(tokens(markdown).map(t => `${t.type}:${t.id}`)).toEqual([key]);
  });

  it('never nests a link: a token inside a link with other text stays that link’s text', () => {
    for (const markdown of [
      `[see @script:${ID}](https://example.com)`,
      '[see [card://webinar:42]](https://example.com)',
      `https://example.com/@script:${ID}`,
    ]) {
      const drawn = body(markdown);
      expect(drawn.nested, markdown).toBe(false);
      expect(tokens(markdown), markdown).toEqual([]);
    }
  });

  it('leaves code blocks alone', () => {
    const markdown = `\`\`\`\n@script:${ID} [card://webinar:42]\n\`\`\`\n`;
    expect(body(markdown).hrefs).toEqual([]);
    expect(tokens(markdown)).toEqual([]);
  });

  it('is never a mention mid-word', () => {
    expect(tokens('mail bob@script:5 now')).toEqual([]);
  });
});

describe('the source range each token replaced', () => {
  it('covers what the model wrote around the token, so a cut there leaves no stray markdown', () => {
    for (const [markdown, literal] of [
      ['see [card://webinar:42] now', '[card://webinar:42]'],
      ['see `[card://webinar:42]` now', '`[card://webinar:42]`'],
      ['see [card://webinar:42](https://example.com) now', '[card://webinar:42](https://example.com)'],
      ['see [card://tenant:owner@acme.com] now', '[card://tenant:owner@acme.com]'],
      [`a @script:a, @script:${ID} b`, `@script:${ID}`],
    ]) {
      const found = tokens(markdown);
      const last = found[found.length - 1];
      expect(last?.range, markdown).not.toBeNull();
      const [start, end] = last?.range ?? [0, 0];
      expect(markdown.slice(start, end), markdown).toBe(literal);
    }
  });

  it('may only be cut directly in a paragraph, not in a table cell or a heading', () => {
    expect(tokens('see [card://webinar:42] now')[0].splittable).toBe(true);
    expect(tokens('- see [card://webinar:42] now')[0].splittable).toBe(true);
    expect(tokens('| a |\n|---|\n| [card://webinar:42] |')[0].splittable).toBe(false);
    expect(tokens('## See [card://webinar:42]')[0].splittable).toBe(false);
    expect(tokens('see **[card://webinar:42]** now')[0].splittable).toBe(false);
  });
});

describe('parseTokenHref', () => {
  it('splits at the first colon and decodes the id the HTML step encoded', () => {
    expect(parseTokenHref('card', 'card://doc:urn:x:1')).toEqual({ type: 'doc', id: 'urn:x:1' });
    expect(parseTokenHref('card', 'card://blog:my%20slug')).toEqual({ type: 'blog', id: 'my slug' });
    expect(parseTokenHref('mention', `mention://script:${ID}`)).toEqual({ type: 'script', id: ID });
    expect(parseTokenHref('mention', 'card://blog:1')).toBeNull();
    expect(parseTokenHref('card', 'card://blog:100%')).toEqual({ type: 'blog', id: '100%' });
  });
});
