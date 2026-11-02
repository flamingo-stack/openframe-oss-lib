/** The numbers a reader sees, and where a chip lands in a render-only copy of the markdown. */

import { describe, expect, it } from 'vitest';
import type { ChatCitation, ChatPart, ChatTextPart } from '../chat-message';
import { citationHref, citationNumbers, parseCitationHref, textWithCitationChips } from '../citations';

const source = (id: string): ChatCitation['source'] => ({
  type: 'source',
  sourceType: 'url',
  id,
  url: 'https://x.test',
});
const cite = (id: string, endIndex?: number): ChatCitation => ({
  source: source(id),
  ...(endIndex !== undefined ? { endIndex } : {}),
});

/** The text with a citation at each `^`, removed from it, in the order written. */
function marked(text: string, ...ids: string[]): ChatTextPart {
  const citations: ChatCitation[] = [];
  let out = '';
  for (const char of text) {
    if (char === '^') citations.push(cite(ids[citations.length], out.length));
    else out += char;
  }
  return { type: 'text', text: out, citations };
}

const chip = (number: number): string => `[${number}](#citation-${number})`;

function drawn(part: ChatTextPart): string {
  return textWithCitationChips(part, citationNumbers([part]));
}

describe('citationNumbers', () => {
  it('is 1-based, in reading order, one number per source', () => {
    const parts: ChatPart[] = [
      { type: 'source-url', sourceId: 'c', url: 'https://x.test' },
      { type: 'text', text: 'aaaa bbbb', citations: [cite('b', 9), cite('a', 4), cite('a', 9)] },
      { type: 'data-record-cards', data: { records: [] } },
      { type: 'text', text: 'cccc', citations: [cite('c', 4), cite('b', 4)] },
    ];
    expect([...citationNumbers(parts)]).toEqual([
      ['a', 1],
      ['b', 2],
      ['c', 3],
    ]);
  });

  it('a citation with no endIndex sorts at the end of its part', () => {
    const parts: ChatPart[] = [{ type: 'text', text: 'aaaa', citations: [cite('late'), cite('early', 2)] }];
    expect([...citationNumbers(parts).keys()]).toEqual(['early', 'late']);
  });

  it('a collection is numbered like any source', () => {
    const parts: ChatPart[] = [{ type: 'text', text: 'aaaa', citations: [cite('record://blog_post', 4)] }];
    expect(citationNumbers(parts).get('record://blog_post')).toBe(1);
  });

  it('a record only linked in the text has no number', () => {
    const parts: ChatPart[] = [{ type: 'text', text: 'See [Atera](record://vendor/42).' }];
    expect(citationNumbers(parts).size).toBe(0);
  });
});

describe('chip hrefs', () => {
  it('round-trip', () => {
    expect(citationHref(3)).toBe('#citation-3');
    expect(parseCitationHref('#citation-3')).toBe(3);
  });

  it.each(['#citation-', '#citation-0', '#citation-x', '#other-3', 'citation-3', 3, null])('%s is no chip', href => {
    expect(parseCitationHref(href)).toBeNull();
  });
});

describe('textWithCitationChips', () => {
  it('returns the text itself when nothing is cited', () => {
    const part: ChatTextPart = { type: 'text', text: 'Plain.' };
    expect(textWithCitationChips(part, new Map())).toBe('Plain.');
  });

  it('inserts a chip at the citation`s end', () => {
    expect(drawn(marked('One sentence.^ Another.', 'a'))).toBe(`One sentence. ${chip(1)} Another.`);
  });

  it('`endIndex` alone is enough', () => {
    const part: ChatTextPart = { type: 'text', text: 'One.', citations: [{ source: source('a'), endIndex: 4 }] };
    expect(drawn(part)).toBe(`One. ${chip(1)}`);
  });

  it('no `endIndex` sits at the end of the part', () => {
    const part: ChatTextPart = { type: 'text', text: 'One.', citations: [{ source: source('a'), startIndex: 0 }] };
    expect(drawn(part)).toBe(`One. ${chip(1)}`);
  });

  it('a collection draws like a record', () => {
    expect(drawn(marked('37 posts.^', 'record://blog_post'))).toBe(`37 posts. ${chip(1)}`);
  });

  it('skips a source with no number', () => {
    const part = marked('One.^', 'a');
    expect(textWithCitationChips(part, new Map())).toBe('One.');
  });

  it('a citation at the very start draws before the text, with the space after it', () => {
    expect(drawn(marked('^Starts with a chip.', 'a'))).toBe(`${chip(1)} Starts with a chip.`);
  });

  describe('trailing whitespace', () => {
    it('goes before a trailing space', () => {
      expect(drawn(marked('One. ^Two.', 'a'))).toBe(`One. ${chip(1)} Two.`);
    });

    it('goes before a trailing newline, and keeps a hard break after it', () => {
      expect(drawn(marked('One.  \n^Two.', 'a'))).toBe(`One. ${chip(1)}  \nTwo.`);
    });

    it('goes before the blank line that ends a paragraph', () => {
      expect(drawn(marked('One.\n\n^Two.', 'a'))).toBe(`One. ${chip(1)}\n\nTwo.`);
    });
  });

  describe('code span', () => {
    it('moves past a span it lands inside', () => {
      expect(drawn(marked('Run `npm ^install` now.', 'a'))).toBe(`Run \`npm install\` ${chip(1)} now.`);
    });

    it('a chip right after a span stays there', () => {
      expect(drawn(marked('Run `npm i`^ now.', 'a'))).toBe(`Run \`npm i\` ${chip(1)} now.`);
    });

    it('matches a run of the same length', () => {
      expect(drawn(marked('Run ``a ` ^b`` now.', 'a'))).toBe(`Run \`\`a \` b\`\` ${chip(1)} now.`);
    });

    it('an unclosed backtick protects nothing', () => {
      expect(drawn(marked('A ` tick.^ More.', 'a'))).toBe(`A \` tick. ${chip(1)} More.`);
    });

    it('a span never crosses a blank line', () => {
      expect(drawn(marked('A ` tick.^\n\nB ` more.', 'a'))).toBe(`A \` tick. ${chip(1)}\n\nB \` more.`);
    });
  });

  describe('fence', () => {
    const fenced = '```bash\nnpm i\n```';

    it('moves past a fence it lands inside, onto a line of its own', () => {
      const part = marked(`Run:\n\`\`\`bash\nnpm ^i\n\`\`\`\nThen go.`, 'a');
      expect(drawn(part)).toBe(`Run:\n${fenced}\n\n${chip(1)}\n\nThen go.`);
    });

    it('a chip at the fence`s end keeps the closing line a closing line', () => {
      expect(drawn(marked(`${fenced}^`, 'a'))).toBe(`${fenced}\n\n${chip(1)}`);
    });

    it('a citation right after the fence, past its newline, is the same place', () => {
      expect(drawn(marked(`${fenced}\n^Then.`, 'a'))).toBe(`${fenced}\n\n${chip(1)}\n\nThen.`);
    });

    it('reads tilde fences and an indented fence', () => {
      expect(drawn(marked('~~~\na^\n~~~', 'a'))).toBe(`~~~\na\n~~~\n\n${chip(1)}`);
      expect(drawn(marked('- item\n  ```\n  a^\n  ```', 'a'))).toBe(`- item\n  \`\`\`\n  a\n  \`\`\`\n\n${chip(1)}`);
    });

    it('a fence that never closes has no place after it: the chip stays out', () => {
      expect(drawn(marked('```\ncode^', 'a'))).toBe('```\ncode');
    });

    it('a text before a fence keeps its own place', () => {
      expect(drawn(marked(`Run:^\n${fenced}`, 'a'))).toBe(`Run: ${chip(1)}\n${fenced}`);
    });
  });

  describe('link', () => {
    it('moves past a link it lands inside the label of', () => {
      expect(drawn(marked('See [the ^guide](https://x.test/a) now.', 'a'))).toBe(
        `See [the guide](https://x.test/a) ${chip(1)} now.`,
      );
    });

    it('moves past a link it lands inside the destination of', () => {
      expect(drawn(marked('See [g](https://x.test/^a) now.', 'a'))).toBe(`See [g](https://x.test/a) ${chip(1)} now.`);
    });

    it('moves past a record link', () => {
      expect(drawn(marked('See [Atera^](record://vendor/42).', 'a'))).toBe(
        `See [Atera](record://vendor/42) ${chip(1)}.`,
      );
    });

    it('reads a nested label and parentheses in a destination', () => {
      expect(drawn(marked('[a [b^] c](https://x.test/(d)) e', 'a'))).toBe(`[a [b] c](https://x.test/(d)) ${chip(1)} e`);
    });

    it('moves past an image and an autolink', () => {
      expect(drawn(marked('![a^](x.png) b', 'a'))).toBe(`![a](x.png) ${chip(1)} b`);
      expect(drawn(marked('<https://x.^test> b', 'a'))).toBe(`<https://x.test> ${chip(1)} b`);
    });

    it('moves past a bare url', () => {
      expect(drawn(marked('Go to https://x.test/^a now.', 'a'))).toBe(`Go to https://x.test/a ${chip(1)} now.`);
    });

    it('an escaped bracket opens no link', () => {
      expect(drawn(marked('A \\[b^ c\\](d) e', 'a'))).toBe(`A \\[b ${chip(1)} c\\](d) e`);
    });
  });

  describe('emphasis', () => {
    it('goes after a closing run, not inside it', () => {
      expect(drawn(marked('A **bold^** word.', 'a'))).toBe(`A **bold** ${chip(1)} word.`);
      expect(drawn(marked('A **bold*^* word.', 'a'))).toBe(`A **bold** ${chip(1)} word.`);
    });

    it('leaves an underscore inside a word alone', () => {
      expect(drawn(marked('snake^_case', 'a'))).toBe(`snake ${chip(1)}_case`);
    });
  });

  describe('table', () => {
    const table = '| A | B |\n| - | - |\n| x | y |';

    it('stays in the cell when it lands mid-row', () => {
      expect(drawn(marked('| A | B |\n| - | - |\n| x^ | y |', 'a'))).toBe(`| A | B |\n| - | - |\n| x ${chip(1)} | y |`);
    });

    it('moves inside the last cell from past a row`s closing pipe', () => {
      expect(drawn(marked(`${table}^`, 'a'))).toBe(`| A | B |\n| - | - |\n| x | y ${chip(1)} |`);
    });

    it('from the start of the next row, goes back into the row it cites', () => {
      expect(drawn(marked('| A |\n| - |\n| x |\n^| y |\n', 'a'))).toBe(`| A |\n| - |\n| x ${chip(1)} |\n| y |\n`);
    });

    it('never lands in the delimiter row', () => {
      expect(drawn(marked('| A | B |\n| -^ | - |\n| x | y |', 'a'))).toBe(`| A | B ${chip(1)} |\n| - | - |\n| x | y |`);
    });

    it('a table with no outer pipes keeps its chip at the end of the line', () => {
      expect(drawn(marked('A | B\n- | -\nx | y^', 'a'))).toBe(`A | B\n- | -\nx | y ${chip(1)}`);
    });
  });

  describe('list', () => {
    it('stays on its item', () => {
      expect(drawn(marked('- One.^\n- Two.^\n', 'a', 'b'))).toBe(`- One. ${chip(1)}\n- Two. ${chip(2)}\n`);
    });

    it('from the start of the next item, goes back to the end of its own', () => {
      expect(drawn(marked('- One.\n^- Two.', 'a'))).toBe(`- One. ${chip(1)}\n- Two.`);
    });

    it('a source draws once per item, not once per list', () => {
      expect(drawn(marked('- One.^\n- Two.^', 'a', 'a'))).toBe(`- One. ${chip(1)}\n- Two. ${chip(1)}`);
    });
  });

  describe('a source once per paragraph', () => {
    it('keeps the first of a source in a paragraph', () => {
      expect(drawn(marked('One.^ Two.^', 'a', 'a'))).toBe(`One. ${chip(1)} Two.`);
    });

    it('draws it again in the next paragraph', () => {
      expect(drawn(marked('One.^\n\nTwo.^', 'a', 'a'))).toBe(`One. ${chip(1)}\n\nTwo. ${chip(1)}`);
    });

    it('two sources at one place both draw, in number order', () => {
      expect(drawn(marked('One.^^', 'a', 'b'))).toBe(`One. ${chip(1)} ${chip(2)}`);
    });

    it('the same source cited twice at one place draws once', () => {
      expect(drawn(marked('One.^^', 'a', 'a'))).toBe(`One. ${chip(1)}`);
    });
  });

  it('numbers come from the message, not the part', () => {
    const first: ChatTextPart = { type: 'text', text: 'One.', citations: [cite('a', 4)] };
    const second: ChatTextPart = { type: 'text', text: 'Two.', citations: [cite('b', 4)] };
    const numbers = citationNumbers([first, second]);
    expect(textWithCitationChips(second, numbers)).toBe(`Two. ${chip(2)}`);
  });

  it('a position past the end is the end', () => {
    expect(textWithCitationChips({ type: 'text', text: 'One.', citations: [cite('a', 99)] }, new Map([['a', 1]]))).toBe(
      `One. ${chip(1)}`,
    );
  });
});
