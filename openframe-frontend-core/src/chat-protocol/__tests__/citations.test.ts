/** The numbers a reader sees, and where a chip lands in a render-only copy of the markdown. */

import remarkGfm from 'remark-gfm';
import remarkParse from 'remark-parse';
import { unified } from 'unified';
import { describe, expect, it } from 'vitest';
import type { ChatCitation, ChatPart, ChatTextPart } from '../chat-message';
import { citationNumbers, parseCitationHref, textWithCitationChips } from '../citations';

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
    const [href] = /#citation-\d+/.exec(drawn(marked('Priced.^', 'a'))) ?? [];
    expect(href).toBe('#citation-1');
    expect(parseCitationHref(href)).toBe(1);
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
      expect(drawn(marked('Run `npm ^install` now.', 'a'))).toBe(`Run \`npm install\` now. ${chip(1)}`);
    });

    it('from right after a span, goes on to the end of the sentence', () => {
      expect(drawn(marked('Run `npm i`^ now.', 'a'))).toBe(`Run \`npm i\` now. ${chip(1)}`);
    });

    it('matches a run of the same length', () => {
      expect(drawn(marked('Run ``a ` ^b`` now.', 'a'))).toBe(`Run \`\`a \` b\`\` now. ${chip(1)}`);
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
      expect(drawn(marked('  ```\n  a^\n  ```', 'a'))).toBe(`  \`\`\`\n  a\n  \`\`\`\n\n${chip(1)}`);
    });

    it('a fence that never closes has no place after it: the chip stays out', () => {
      expect(drawn(marked('```\ncode^', 'a'))).toBe('```\ncode');
    });

    it('a text before a fence keeps its own place', () => {
      expect(drawn(marked(`Run:^\n${fenced}`, 'a'))).toBe(`Run: ${chip(1)}\n${fenced}`);
    });

    describe('opened on a list marker`s line', () => {
      it.each([
        ['a numbered step', '1. ```bash\n   npm i\n   ```\n2. Run it.'],
        ['a bullet', '- ```bash\n  npm i\n  ```\n- Run it.'],
        ['in a quote', '> - ```bash\n>   npm i\n>   ```\n> - Run it.'],
      ])('%s: its closing line closes it, so every later citation keeps its chip', (_name, list) => {
        const out = drawn(
          marked(`Steps:\n\n${list}^\n\nThe next paragraph says more.^\n\nAnd the last one.^`, 'a', 'b', 'c'),
        );
        expect(out).toContain(
          `${list} ${chip(1)}\n\nThe next paragraph says more. ${chip(2)}\n\nAnd the last one. ${chip(3)}`,
        );
      });

      it('a citation inside it leaves the code', () => {
        const out = drawn(marked('1. ```bash\n   npm ^i\n   ```\n2. Next.', 'a'));
        expect(out).toContain('1. ```bash\n   npm i\n   ```\n');
        expect(out).not.toContain(`npm i ${chip(1)}`);
        expect(out.split(chip(1))).toHaveLength(2);
      });

      it('later fences still pair up: a chip goes after the sentence it cites, not past another fence', () => {
        const part = marked(
          'Before.^\n\n- ```bash\n  npm i\n  ```\n\nAfter one.^\n\n```bash\nnpm t\n```\n\nAfter two.^',
          'a',
          'b',
          'c',
        );
        expect(drawn(part)).toBe(
          `Before. ${chip(1)}\n\n- \`\`\`bash\n  npm i\n  \`\`\`\n\nAfter one. ${chip(2)}\n\n\`\`\`bash\nnpm t\n\`\`\`\n\nAfter two. ${chip(3)}`,
        );
      });
    });

    describe('ended by its container, with no closing line', () => {
      it('the next item ends a fence in an item', () => {
        const part = marked('- ```\n  code\n- Next.^', 'a');
        expect(drawn(part)).toBe(`- \`\`\`\n  code\n- Next. ${chip(1)}`);
      });

      it('a line outside the quote ends a fence in a quote', () => {
        const part = marked('> ```\n> code\n\nAfter.^', 'a');
        expect(drawn(part)).toBe(`> \`\`\`\n> code\n\nAfter. ${chip(1)}`);
      });

      it('a less indented fence line is no closing line, it opens one', () => {
        // The item ended at that line, so the fence after it is the document's and never closes: no place after it.
        expect(drawn(marked('- ```\n  code\n```\nAfter.^', 'a'))).toBe('- ```\n  code\n```\nAfter.');
      });
    });

    it('a list marker with no fence after it, and a marker inside a fence, change nothing', () => {
      expect(drawn(marked('- a^\n- b', 'a'))).toBe(`- a ${chip(1)}\n- b`);
      const inCode = '```\n- ```\n```';
      expect(drawn(marked(`${inCode}\n\nAfter.^`, 'a'))).toBe(`${inCode}\n\nAfter. ${chip(1)}`);
    });
  });

  describe('indented code', () => {
    it('moves past a block it lands inside, onto a line of its own', () => {
      expect(drawn(marked('Text.\n\n    code. more^ code\n\nNext.', 'a'))).toBe(
        `Text.\n\n    code. more code\n\n${chip(1)}\n\n\nNext.`,
      );
    });

    it('holds its blank lines, and ends at its last line', () => {
      expect(drawn(marked('Text.\n\n    a^\n\n    b\n\nNext.', 'a'))).toBe(
        `Text.\n\n    a\n\n    b\n\n${chip(1)}\n\n\nNext.`,
      );
    });

    it('in a list item: the chip stays in the item, under the code', () => {
      expect(drawn(marked('- item\n\n      code^ here\n\n- next', 'a'))).toBe(
        `- item\n\n      code here\n  ${chip(1)}\n\n- next`,
      );
    });

    it('in a quote: the chip stays in the quote', () => {
      expect(drawn(marked('> text\n>\n>     code^ here\n>\n> more', 'a'))).toBe(
        `> text\n>\n>     code here\n> ${chip(1)}\n>\n> more`,
      );
    });

    it('a list item`s own continuation is no code', () => {
      expect(drawn(marked('- item\n\n    more^ text\n- next', 'a'))).toBe(`- item\n\n    more text ${chip(1)}\n- next`);
      expect(drawn(marked('1. item\n\n    more^ text', 'a'))).toBe(`1. item\n\n    more text ${chip(1)}`);
    });

    it('an indented line under a paragraph is the paragraph', () => {
      expect(drawn(marked('Text\n    more^ text', 'a'))).toBe(`Text\n    more text ${chip(1)}`);
      expect(drawn(marked('- item\n      more^ text', 'a'))).toBe(`- item\n      more text ${chip(1)}`);
    });

    it('right after a heading or a fence it is code again', () => {
      expect(drawn(marked('# T\n    code^ here', 'a'))).toBe(`# T\n    code here\n\n${chip(1)}`);
      expect(drawn(marked('```\nx\n```\n    code^ here', 'a'))).toBe(`\`\`\`\nx\n\`\`\`\n    code here\n\n${chip(1)}`);
    });

    it.each([
      ['alone', 'Text.\n\n    code. more code\n\nNext.'],
      ['two runs', '    a\n\n    b\n\nNext.'],
      ['in a list', '- item\n\n      code here\n\n- next'],
      ['in an ordered list', '1. item\n\n       code here\n2. next'],
      ['in a quote', '> text\n>\n>     code here\n>\n> more'],
      ['a continuation that is no code', '- item\n\n    more text\n- next'],
    ])('%s, at every place a citation can end', (_name, text) => {
      expect(expectChipsToLeaveItAlone(text)).toBe(text.length + 1);
    });
  });

  describe('link', () => {
    it('moves past a link it lands inside the label of', () => {
      expect(drawn(marked('See [the ^guide](https://x.test/a) now.', 'a'))).toBe(
        `See [the guide](https://x.test/a) now. ${chip(1)}`,
      );
    });

    it('moves past a link it lands inside the destination of', () => {
      expect(drawn(marked('See [g](https://x.test/^a) now.', 'a'))).toBe(`See [g](https://x.test/a) now. ${chip(1)}`);
    });

    it('moves past a record link', () => {
      expect(drawn(marked('See [Atera^](record://vendor/42).', 'a'))).toBe(
        `See [Atera](record://vendor/42). ${chip(1)}`,
      );
    });

    it('reads a nested label and parentheses in a destination', () => {
      expect(drawn(marked('[a [b^] c](https://x.test/(d)) e', 'a'))).toBe(`[a [b] c](https://x.test/(d)) e ${chip(1)}`);
    });

    it('moves past an image and an autolink', () => {
      expect(drawn(marked('![a^](x.png) b', 'a'))).toBe(`![a](x.png) b ${chip(1)}`);
      expect(drawn(marked('<https://x.^test> b', 'a'))).toBe(`<https://x.test> b ${chip(1)}`);
    });

    it('moves past a bare url', () => {
      expect(drawn(marked('Go to https://x.test/^a now.', 'a'))).toBe(`Go to https://x.test/a now. ${chip(1)}`);
    });

    it('an escaped bracket opens no link', () => {
      expect(drawn(marked('A \\[b^ c\\](d) e', 'a'))).toBe(`A \\[b c\\](d) e ${chip(1)}`);
    });
  });

  describe('emphasis', () => {
    it('goes after a closing run, not inside it', () => {
      expect(drawn(marked('A **bold sentence.^** Next.', 'a'))).toBe(`A **bold sentence.** ${chip(1)} Next.`);
      expect(drawn(marked('A **bold sentence.*^* Next.', 'a'))).toBe(`A **bold sentence.** ${chip(1)} Next.`);
      expect(drawn(marked('A **bold^** word.', 'a'))).toBe(`A **bold** word. ${chip(1)}`);
      expect(drawn(marked('A **bold phrase^**', 'a'))).toBe(`A **bold phrase** ${chip(1)}`);
    });

    it('leaves an underscore inside a word alone', () => {
      expect(drawn(marked('snake^_case', 'a'))).toBe(`snake_case ${chip(1)}`);
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

  describe('the end of the sentence', () => {
    // The answers of two real turns (`e2e/browser/f1.body.txt` and `y2.body.txt`), with their real citation offsets.
    it('a number no longer lands before a comma', () => {
      const text =
        "OpenFrame costs $1.00 per device per month billed monthly, or $0.80 per device per month billed yearly (20% less), far below Atera's per-user plans starting at $139/month, as shown on the [OpenFrame pricing](record://openframe_price/plan) record and the [Atera](record://vendor/299) vendor listing; the [Solo MSP endpoint cleanup case study](record://case_study/72) shows an MSP who found that value worthwhile even on its own.";
      const part: ChatTextPart = {
        type: 'text',
        text,
        citations: [{ source: source('record://openframe_price/plan'), startIndex: 0, endIndex: 113 }],
      };
      expect(text[113]).toBe(',');
      expect(drawn(part)).toBe(`${text} ${chip(1)}`);
    });

    it('two sentences, one split across three wire parts, each number at its own end', () => {
      const first =
        'OpenFrame covers remote access, patching, device inventory, scripting, security rules, help desk, logs and client docs, built on tools like MeshCentral and Fleet MDM, with Fae and Mingo as AI agents, per the [Platform overview](record://site_page/openframe).';
      const second = ' It costs $1.00 per device per month billed monthly, or $0.80 per device per month billed yearly';
      const third = ', and offers a 14 day free trial with no card required';
      const fourth = ', per [OpenFrame pricing](record://openframe_price/plan).';
      const part: ChatTextPart = {
        type: 'text',
        text: first + second + third + fourth,
        citations: [
          { source: source('record://site_page/openframe'), startIndex: 0, endIndex: 198 },
          { source: source('record://openframe_price/plan'), startIndex: first.length, endIndex: first.length + 96 },
          {
            source: source('record://openframe_price/plan'),
            startIndex: first.length + second.length + 5,
            endIndex: first.length + second.length + 54,
          },
        ],
      };
      expect(drawn(part)).toBe(`${first} ${chip(1)}${second}${third}${fourth} ${chip(2)}`);
    });

    it.each([
      ['a decimal', 'It costs^ $1.00 today. Next.', `It costs $1.00 today. ${chip(1)} Next.`],
      ['a version', 'Runs^ on v1.2.3 now. Next.', `Runs on v1.2.3 now. ${chip(1)} Next.`],
      ['a domain', 'Hosted^ on flamingo.run now. Next.', `Hosted on flamingo.run now. ${chip(1)} Next.`],
      [
        'an abbreviation',
        'Tools^, e.g. Fleet, i.e. MDM, vs. others. Next.',
        `Tools, e.g. Fleet, i.e. MDM, vs. others. ${chip(1)} Next.`,
      ],
      ['an escaped mark', 'Item^ 1\\. stays. Next.', `Item 1\\. stays. ${chip(1)} Next.`],
    ])('%s ends no sentence', (_name, text, expected) => {
      expect(drawn(marked(text, 'a'))).toBe(expected);
    });

    it.each([
      ['a full stop', 'Ends^ here. Next.', `Ends here. ${chip(1)} Next.`],
      ['a question mark', 'Does^ it? Next.', `Does it? ${chip(1)} Next.`],
      ['an exclamation mark', 'It^ does! Next.', `It does! ${chip(1)} Next.`],
      ['a closing quote', 'He said^ "go." Next.', `He said "go." ${chip(1)} Next.`],
      ['a curly quote', 'He said^ “go.” Next.', `He said “go.” ${chip(1)} Next.`],
      ['a closing bracket', 'Some^ text (a note.) Next.', `Some text (a note.) ${chip(1)} Next.`],
      ['the end of the text', 'Ends^ here.', `Ends here. ${chip(1)}`],
      ['a version that ends it', 'Upgrade^ to v1.2.3.', `Upgrade to v1.2.3. ${chip(1)}`],
      ['a bare url that ends it', 'See^ https://x.test/a. Next.', `See https://x.test/a. ${chip(1)} Next.`],
    ])('%s ends one', (_name, text, expected) => {
      expect(drawn(marked(text, 'a'))).toBe(expected);
    });

    it('a citation that already ends its sentence stays, closers and all', () => {
      expect(drawn(marked('He said "go.^" Next.', 'a'))).toBe(`He said "go." ${chip(1)} Next.`);
      expect(drawn(marked('He said "go."^ Next.', 'a'))).toBe(`He said "go." ${chip(1)} Next.`);
      expect(drawn(marked('One.^ Two. Three.', 'a'))).toBe(`One. ${chip(1)} Two. Three.`);
    });

    it('a mark inside code or a link is no end', () => {
      expect(drawn(marked('Run^ `a. b` and [c. d](https://x.test) now. Next.', 'a'))).toBe(
        `Run \`a. b\` and [c. d](https://x.test) now. ${chip(1)} Next.`,
      );
    });

    it('with no end on the line, the end of the line, before a hard break too', () => {
      expect(drawn(marked('No mark^ on this line\nNext.', 'a'))).toBe(`No mark on this line ${chip(1)}\nNext.`);
      expect(drawn(marked('No mark^ here  \nNext.', 'a'))).toBe(`No mark here ${chip(1)}  \nNext.`);
    });

    it('never past a line: a soft wrap ends the walk, and so does a link that crosses one', () => {
      expect(drawn(marked('One^\ntwo. Three.', 'a'))).toBe(`One ${chip(1)}\ntwo. Three.`);
      expect(drawn(marked('See^ [a\nb](https://x.test). Next.', 'a'))).toBe(
        `See ${chip(1)} [a\nb](https://x.test). Next.`,
      );
    });

    it('never past a cell of a table', () => {
      expect(drawn(marked('| One^ two | three. |\n|---|---|\n| c | d |', 'a'))).toBe(
        `| One two ${chip(1)} | three. |\n|---|---|\n| c | d |`,
      );
      expect(drawn(marked('| One^. Two | b |\n|---|---|\n| c | d |', 'a'))).toBe(
        `| One. ${chip(1)} Two | b |\n|---|---|\n| c | d |`,
      );
      expect(drawn(marked('| One |^ two |\n|---|---|\n| c | d |', 'a'))).toBe(
        `| One | ${chip(1)} two |\n|---|---|\n| c | d |`,
      );
    });

    it('never past a list item', () => {
      expect(drawn(marked('- One^ thing\n- Two.\n', 'a'))).toBe(`- One thing ${chip(1)}\n- Two.\n`);
    });

    it('in a heading, before its closing hashes', () => {
      expect(drawn(marked('## A^ heading ##\n\nb', 'a'))).toBe(`## A heading ${chip(1)} ##\n\nb`);
    });

    it('two citations in one sentence meet at its end, as numbers in order', () => {
      expect(drawn(marked('One^ two^ three. Next.', 'a', 'b'))).toBe(`One two three. ${chip(1)} ${chip(2)} Next.`);
      expect(drawn(marked('One^ two^ three^ four. Next.', 'a', 'b', 'a'))).toBe(
        `One two three four. ${chip(1)} ${chip(2)} Next.`,
      );
    });

    it('moves a chip and not a number: reading order is still where the citations end', () => {
      const part = marked('One^ two^ three. Four^.', 'b', 'a', 'c');
      expect([...citationNumbers([part])]).toEqual([
        ['b', 1],
        ['a', 2],
        ['c', 3],
      ]);
      expect(drawn(part)).toBe(`One two three. ${chip(1)} ${chip(2)} Four. ${chip(3)}`);
    });

    it('a citation at the very start stays where nothing is before it', () => {
      expect(drawn(marked('^Starts here. Next.', 'a'))).toBe(`${chip(1)} Starts here. Next.`);
    });
  });

  describe('a source once per paragraph', () => {
    it('keeps the first of a source in a paragraph', () => {
      expect(drawn(marked('One.^ Two.^', 'a', 'a'))).toBe(`One. ${chip(1)} Two.`);
    });

    it('draws it again in the next paragraph', () => {
      expect(drawn(marked('One.^\n\nTwo.^', 'a', 'a'))).toBe(`One. ${chip(1)}\n\nTwo. ${chip(1)}`);
    });

    it('a soft-wrapped line is the same paragraph', () => {
      expect(drawn(marked('One line^\nsame paragraph.^', 'a', 'a'))).toBe(`One line ${chip(1)}\nsame paragraph.`);
      expect(drawn(marked('> One line^\n> same quote.^', 'a', 'a'))).toBe(`> One line ${chip(1)}\n> same quote.`);
    });

    it('a list item`s wrapped line belongs to it, and the next item is its own', () => {
      expect(drawn(marked('- One^\n  wrapped.^\n- Two.^', 'a', 'a', 'a'))).toBe(
        `- One ${chip(1)}\n  wrapped.\n- Two. ${chip(1)}`,
      );
      expect(drawn(marked('1. One.^\n2) Two.^', 'a', 'a'))).toBe(`1. One. ${chip(1)}\n2) Two. ${chip(1)}`);
    });

    it('a table row is its own, with or without a leading pipe', () => {
      expect(drawn(marked('| a^ | b |\n|---|---|\n| c^ | d |', 'a', 'a'))).toBe(
        `| a ${chip(1)} | b |\n|---|---|\n| c ${chip(1)} | d |`,
      );
      expect(drawn(marked('a^ | b\n--|--\nc^ | d', 'a', 'a'))).toBe(`a ${chip(1)} | b\n--|--\nc ${chip(1)} | d`);
    });

    it('a heading is its own, and so is what follows a fence', () => {
      expect(drawn(marked('# Title^\nText.^', 'a', 'a'))).toBe(`# Title ${chip(1)}\nText. ${chip(1)}`);
      expect(drawn(marked('Before.^\n```\ncode\n```\nAfter.^', 'a', 'a'))).toBe(
        `Before. ${chip(1)}\n\`\`\`\ncode\n\`\`\`\nAfter. ${chip(1)}`,
      );
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

interface MarkdownNode {
  type: string;
  value?: string;
  url?: string;
  depth?: number;
  children?: MarkdownNode[];
}

const markdownParser = unified().use(remarkParse).use(remarkGfm);
const isChip = (node: MarkdownNode): boolean => node.type === 'link' && parseCitationHref(node.url) !== null;

function chipsIn(node: MarkdownNode): number {
  return (isChip(node) ? 1 : 0) + (node.children ?? []).reduce((sum, child) => sum + chipsIn(child), 0);
}

/** What the reader sees of a tree with the chips left out: its blocks, their text, and no paragraph a chip stood alone in. */
function structureWithoutChips(node: MarkdownNode): unknown {
  const children: Array<Record<string, unknown>> = [];
  for (const child of node.children ?? []) {
    if (isChip(child)) continue;
    if (child.type === 'text') {
      const last = children[children.length - 1];
      const value = child.value ?? '';
      if (last?.type === 'text') last.value = `${String(last.value)}${value}`;
      else children.push({ type: 'text', value });
    } else {
      const inner = structureWithoutChips(child) as Record<string, unknown>;
      if (child.type !== 'paragraph' || (inner.children as unknown[]).length > 0) children.push(inner);
    }
  }
  for (const child of children) {
    if (child.type === 'text') child.value = String(child.value).replace(/\s+/g, ' ').trim();
  }
  return {
    type: node.type,
    ...(node.value !== undefined ? { value: node.value } : {}),
    ...(node.url !== undefined ? { url: node.url } : {}),
    ...(node.depth !== undefined ? { depth: node.depth } : {}),
    children: children.filter(child => child.type !== 'text' || child.value !== ''),
  };
}

/** A chip at every place a citation can end leaves the markdown as it was, and shows. Answers how many it tried. */
function expectChipsToLeaveItAlone(text: string): number {
  const before = structureWithoutChips(markdownParser.parse(text));
  let places = 0;
  for (let endIndex = 0; endIndex <= text.length; endIndex++) {
    const out = textWithCitationChips({ type: 'text', text, citations: [cite('a', endIndex)] }, new Map([['a', 1]]));
    const tree = markdownParser.parse(out) as MarkdownNode;
    expect({ endIndex, out, structure: structureWithoutChips(tree) }).toEqual({ endIndex, out, structure: before });
    expect({ endIndex, out, chips: chipsIn(tree) }).toEqual({ endIndex, out, chips: 1 });
    places++;
  }
  return places;
}

describe('a chip never breaks the block it lands near', () => {
  describe('a block in a list or a quote: the chip stays in what holds it', () => {
    const fence = '```bash\nnpm i\n```';
    const indented = (by: string): string => fence.split('\n').join(`\n${by}`);

    it('numbered steps stay one list', () => {
      const part = marked(
        `1. Install:\n   ${indented('   ')}^\n2. Run:\n   ${indented('   ')}^\n3. Done.^`,
        'a',
        'b',
        'c',
      );
      expect(drawn(part)).toBe(
        `1. Install:\n   ${indented('   ')}\n   ${chip(1)}\n2. Run:\n   ${indented('   ')}\n   ${chip(2)}\n3. Done. ${chip(3)}`,
      );
    });

    it('a fence opened on the marker`s line', () => {
      expect(drawn(marked(`1. ${indented('   ')}^\n2. Next.`, 'a'))).toBe(
        `1. ${indented('   ')}\n   ${chip(1)}\n2. Next.`,
      );
    });

    it('a bullet keeps the text after its fence', () => {
      const code = '```\n  code\n  ```';
      expect(drawn(marked(`- item\n  ${code}^\n  more text\n- next`, 'a'))).toBe(
        `- item\n  ${code}\n  ${chip(1)}\n  more text\n- next`,
      );
    });

    it('one quote stays one quote', () => {
      expect(drawn(marked('> Install:\n> ```bash\n> npm i\n> ```^\n> Then run it.', 'a'))).toBe(
        `> Install:\n> \`\`\`bash\n> npm i\n> \`\`\`\n> ${chip(1)}\n> Then run it.`,
      );
    });

    it('nested: an item in an item, a list in a quote', () => {
      expect(drawn(marked('- a\n  - ```\n    c^\n    ```\n  - b', 'a'))).toBe(
        `- a\n  - \`\`\`\n    c\n    \`\`\`\n    ${chip(1)}\n  - b`,
      );
      expect(drawn(marked('> - ```\n>   c^\n>   ```\n> - b', 'a'))).toBe(
        `> - \`\`\`\n>   c\n>   \`\`\`\n>   ${chip(1)}\n> - b`,
      );
    });

    it('a line outside what holds it does not fall into the chip`s paragraph', () => {
      expect(drawn(marked('- ```\n  c^\n  ```\nOutside.', 'a'))).toBe(
        `- \`\`\`\n  c\n  \`\`\`\n  ${chip(1)}\n\nOutside.`,
      );
      expect(drawn(marked('> ```\n> c^\n> ```\nOutside.', 'a'))).toBe(
        `> \`\`\`\n> c\n> \`\`\`\n> ${chip(1)}\n\nOutside.`,
      );
    });

    it('a rule under it stays a rule, and indented code stays code', () => {
      expect(drawn(marked('- ```\n  c^\n  ```\n  ---\n  more', 'a'))).toBe(
        `- \`\`\`\n  c\n  \`\`\`\n  ${chip(1)}\n\n  ---\n  more`,
      );
      expect(drawn(marked('- ```\n  c^\n  ```\n      code', 'a'))).toBe(
        `- \`\`\`\n  c\n  \`\`\`\n  ${chip(1)}\n\n      code`,
      );
    });

    it('a fence its item ended takes the chip outside the item: inside, it would be code', () => {
      const out = drawn(marked('- ```\n  c^\nOutside.', 'a'));
      expect(out).toBe(`- \`\`\`\n  c\n\n${chip(1)}\n\nOutside.`);
    });

    it('an HTML block that runs to a blank line gets one before the chip', () => {
      expect(drawn(marked('- <div>x</div>^\n- next', 'a'))).toBe(`- <div>x</div>\n\n  ${chip(1)}\n- next`);
      expect(drawn(marked('> <div>x</div>^', 'a'))).toBe(`> <div>x</div>\n>\n> ${chip(1)}`);
    });

    it('an HTML block that ends itself does not', () => {
      expect(drawn(marked('- <pre>\n  x^\n  </pre>\n- next', 'a'))).toBe(
        `- <pre>\n  x\n  </pre>\n  ${chip(1)}\n- next`,
      );
    });

    it.each([
      ['steps', '1. Install:\n   ```bash\n   npm i\n   ```\n2. Run:\n   ```bash\n   npm start\n   ```\n3. Done.'],
      ['a bullet with text after', '- item\n  ```\n  code\n  ```\n  more text\n- next'],
      ['a quote', '> Install:\n> ```bash\n> npm i\n> ```\n> Then run it.'],
      ['the end of a list', '- ```\n  code\n  ```\nOutside the list.'],
      ['the end of a quote', '> ```\n> code\n> ```\nOutside the quote.'],
      ['an item with HTML', '- <div>html</div>\n- next'],
      ['nested', '- a\n  - ```\n    c\n    ```\n  - b\n  back in a\n- d'],
    ])('%s, at every place a citation can end', (_name, text) => {
      expect(expectChipsToLeaveItAlone(text)).toBe(text.length + 1);
    });
  });

  it('a rule or a delimiter row above a fence: the chip stays out of the fence, and the fence closes', () => {
    const text = 'Run this:\n\n```bash\nnpm i\n```\n\n---\n\nThen read the guide.\n\n```bash\nnpm t\n```\n\nDone.';
    const out = drawn({ type: 'text', text, citations: [cite('a', text.indexOf('---') + 3)] });
    expect(out).toContain(`\`\`\`\n\n${chip(1)}\n`);
    expect(out).not.toContain(`\`\`\` ${chip(1)}`);
    expectChipsToLeaveItAlone(text);
  });

  describe('a citation at the very start', () => {
    it.each([
      ['a fence', '```bash\nnpm i\n```\n\nThen read.'],
      ['a heading', '# Title\n\nBody.'],
      ['a list', '- a\n- b'],
      ['an ordered list', '1. a\n2. b'],
      ['a table', '| a | b |\n|---|---|\n| c | d |'],
      ['a quote', '> quoted\n\nBody.'],
      ['a rule', '---\n\nBody.'],
      ['an HTML block', '<div>x</div>\n\nBody.'],
    ])('takes a line of its own before %s', (_name, text) => {
      expect(drawn({ type: 'text', text, citations: [cite('a', 0)] })).toBe(`${chip(1)}\n\n${text}`);
      expectChipsToLeaveItAlone(text);
    });

    it('takes a line of its own before indented code', () => {
      const text = '    code\n\nBody.';
      expect(drawn({ type: 'text', text, citations: [cite('a', 0)] })).toBe(`${chip(1)}\n\n${text}`);
    });

    it('stays beside plain text', () => {
      expect(drawn({ type: 'text', text: 'Plain.', citations: [cite('a', 0)] })).toBe(`${chip(1)} Plain.`);
    });
  });

  describe('a line that holds nothing', () => {
    it.each([
      ['a dash rule', 'a\n\n---\n\nb', 6],
      ['a star rule', 'a\n\n***\n\nb', 6],
      ['an underscore rule', 'a\n\n___\n\nb', 6],
      ['a spaced rule', 'a\n\n* * *\n\nb', 8],
      ['a reference definition', 'a [b][1]\n\n[1]: https://x.test "t"', 32],
    ])('goes back to the line above %s', (_name, text, endIndex) => {
      expect(drawn({ type: 'text', text, citations: [cite('a', endIndex)] })).toBe(
        `${text.split('\n')[0]} ${chip(1)}${text.slice(text.indexOf('\n'))}`,
      );
      expectChipsToLeaveItAlone(text);
    });

    it.each([
      ['===', 'Title\n===\n\nBody'],
      ['---', 'Title\n---\n\nBody'],
    ])('a setext underline of %s keeps its heading, with the chip in it', (_name, text) => {
      expect(drawn({ type: 'text', text, citations: [cite('a', 9)] })).toBe(`Title ${chip(1)}${text.slice(5)}`);
      expectChipsToLeaveItAlone(text);
    });

    it.each(['---', '***', '___', '[1]: https://x.test'])(
      '%s with nothing above it: a line of its own after it',
      line => {
        const text = `${line}\n\nb`;
        expect(drawn({ type: 'text', text, citations: [cite('a', line.length + 2)] })).toBe(
          `${line}\n\n${chip(1)}\n\n\nb`,
        );
        expectChipsToLeaveItAlone(text);
      },
    );

    it('a citation on a quote`s blank line goes back to the text above it', () => {
      expect(drawn({ type: 'text', text: '> text\n>\n> more', citations: [cite('a', 8)] })).toBe(
        `> text ${chip(1)}\n>\n> more`,
      );
    });

    it('steps over several', () => {
      const text = 'a\n\n---\n\n***';
      expect(drawn({ type: 'text', text, citations: [cite('a', text.length)] })).toBe(`a ${chip(1)}\n\n---\n\n***`);
    });

    it('a rule after a fence puts the chip after the fence', () => {
      const text = '```\ncode\n```\n\n---\n\nb';
      expect(drawn({ type: 'text', text, citations: [cite('a', text.indexOf('---') + 3)] })).toBe(
        `\`\`\`\ncode\n\`\`\`\n\n${chip(1)}\n\n\n---\n\nb`,
      );
    });

    it('inside a fence a rule is code', () => {
      const text = '```\na\n---\nb\n```\n\nc';
      expect(drawn({ type: 'text', text, citations: [cite('a', text.indexOf('---') + 3)] })).toBe(
        `\`\`\`\na\n---\nb\n\`\`\`\n\n${chip(1)}\n\n\nc`,
      );
    });
  });

  describe('a raw HTML block', () => {
    it.each([
      ['a block tag', '<div>block</div>\n\nb', 16],
      ['a tag alone on its line', '<span>\nx\n</span>\n\nb', 16],
      ['a comment', '<!-- a -->\n\nb', 10],
      ['a pre', '<pre>\n\nkept\n</pre>\n\nb', 18],
    ])('moves past %s, onto a line of its own', (_name, text, end) => {
      expect(drawn({ type: 'text', text, citations: [cite('a', end - 1)] })).toBe(
        `${text.slice(0, end)}\n\n${chip(1)}\n${text.slice(end)}`,
      );
      expectChipsToLeaveItAlone(text);
    });

    it('a block that never closes has no place after it', () => {
      const text = '<pre>\n\nkept';
      expect(drawn({ type: 'text', text, citations: [cite('a', text.length)] })).toBe(text);
    });

    it('an inline tag opening a paragraph is no block', () => {
      const text = '<kbd>K</kbd> opens it.\n\nb';
      expect(drawn({ type: 'text', text, citations: [cite('a', 22)] })).toBe(`<kbd>K</kbd> opens it. ${chip(1)}\n\nb`);
    });
  });

  it('stays before what has to end its line', () => {
    const heading = '## Closed ##\n\nb';
    expect(drawn({ type: 'text', text: heading, citations: [cite('a', 12)] })).toBe(`## Closed ${chip(1)} ##\n\nb`);
    expectChipsToLeaveItAlone(heading);
    const hardBreak = 'one\\\ntwo';
    expect(drawn({ type: 'text', text: hardBreak, citations: [cite('a', 4)] })).toBe(`one ${chip(1)}\\\ntwo`);
    expectChipsToLeaveItAlone(hardBreak);
  });

  it('whatever the blocks, at any seed: the markdown stays what it was', () => {
    const fragments = [
      'A plain sentence. Another one.',
      'Wrapped first line\nand its second.',
      '# Heading',
      '## Closed ##',
      'Title\n===',
      'Title\n---',
      '- one\n- two\n  continued',
      '1. first\n2. second',
      '> quoted line\n> and more',
      '| a | b |\n|---|---|\n| c | d |',
      'x | y\n--|--\n1 | 2',
      '---',
      '***',
      '___',
      '```bash\nnpm i\n---\n```',
      '~~~\ncode\n~~~',
      '<div>html</div>',
      '<!-- note -->',
      'Text with `code`, **bold**, [a link](https://x.test) and ![an image](https://x.test/a.png).',
      'See <https://auto.test> and https://bare.test/a?b=1 now.',
      'Hard break\\\nnext.',
      '[ref]: https://x.test "t"',
      '1. ```bash\n   npm i\n   ```\n2. Next.\n\nFinal para.',
      '- ```bash\n  npm i\n  ```\n- Next.\n\nFinal para.',
      '1. Install:\n   ```bash\n   npm i\n   ```\n2. Run it.',
      '- item\n  ```\n  code\n  ```\n  more text\n- next',
      '> Install:\n> ```bash\n> npm i\n> ```\n> Then run it.',
      '- <div>html</div>\n- next',
      'Before.\n\n    indented code\n\n    more of it\n\nAfter.',
      '- item\n\n      code in an item\n\n- next',
      '- item\n\n    continued, no code\n- next',
    ];
    let seed = 20261102;
    const next = (limit: number): number => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed % limit;
    };
    let places = 0;
    for (let round = 0; round < 150; round++) {
      const blocks = Array.from({ length: 1 + next(5) }, () => fragments[next(fragments.length)]);
      places += expectChipsToLeaveItAlone(blocks.join('\n\n'));
    }
    expect(places).toBeGreaterThan(1000);
  });
});
