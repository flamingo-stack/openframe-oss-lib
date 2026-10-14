import type { ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { accentSentenceMarks, HeadingLines, SectionHeading } from './page-heading';

const html = (node: ReactNode) => renderToStaticMarkup(<>{node}</>);
const mark = (text: string) => `<span class="text-ods-accent">${text}</span>`;

describe('accentSentenceMarks', () => {
  it('colours every sentence mark, not only the last', () => {
    expect(html(accentSentenceMarks('Remote all year. Together once a year.'))).toBe(
      `Remote all year${mark('.')} Together once a year${mark('.')}`,
    );
  });

  it('colours a question mark and a colon', () => {
    expect(html(accentSentenceMarks('Ready to join?'))).toBe(`Ready to join${mark('?')}`);
    expect(html(accentSentenceMarks('Open Positions:'))).toBe(`Open Positions${mark(':')}`);
  });

  it('leaves a mark inside a number or a version alone', () => {
    expect(html(accentSentenceMarks('The $6.7M seed and v1.5.0'))).toBe('The $6.7M seed and v1.5.0');
  });

  it('walks fragments and elements, in the accent of the platform it is given', () => {
    expect(html(accentSentenceMarks(<p>Try it. Break it.</p>, 'flamingo'))).toBe(
      '<p>Try it<span class="text-ods-flamingo-pink">.</span> Break it<span class="text-ods-flamingo-pink">.</span></p>',
    );
    expect(html(accentSentenceMarks('Open source.', 'openframe'))).toBe(
      'Open source<span class="text-ods-open-yellow">.</span>',
    );
  });

  it('keeps a mark the caller already coloured', () => {
    expect(
      html(
        accentSentenceMarks(
          <>
            Six rules<span className="pink">.</span> No fine print
          </>,
        ),
      ),
    ).toBe('Six rules<span class="pink">.</span> No fine print');
  });

  it('the section heading takes a platform for its eyebrow, marks and closing mark', () => {
    const out = html(<SectionHeading eyebrow="Trust" title="Open. Audited" platform="flamingo" />);
    expect(out).toContain('<span class="text-h5 text-ods-flamingo-pink">Trust</span>');
    expect(out).toContain(
      'Open<span class="text-ods-flamingo-pink">.</span> Audited<span class="text-ods-flamingo-pink">.</span>',
    );
  });

  it('the section heading colours the marks inside its title and its closing mark', () => {
    expect(html(<SectionHeading title="Remote all year. Together once a year" />)).toContain(
      `Remote all year${mark('.')} Together once a year${mark('.')}`,
    );
  });

  it('draws a heading with no eyebrow as the heading element itself', () => {
    expect(html(<SectionHeading level="page" title="Run by AI" punctuation={null} />)).toBe(
      '<div class="flex flex-col gap-[var(--spacing-system-lf)]"><h1 class="text-h1 text-ods-text-primary" data-section-heading="true">Run by AI</h1></div>',
    );
  });

  it("keeps a section heading's eyebrow beside the heading, so the heading is named by its title alone", () => {
    expect(html(<SectionHeading eyebrow="AI agents" title="Built in" punctuation={null} />)).toContain(
      '<span class="text-h5 text-ods-accent">AI agents</span><h2 class="text-h2 text-ods-text-primary" data-section-heading="true">Built in</h2>',
    );
  });

  it("makes a page heading's eyebrow part of the heading element, with the same two boxes in the stack", () => {
    const out = html(
      <SectionHeading level="page" eyebrow="Endpoint management software" title="Run by AI" punctuation={null} />,
    );
    expect(out).toContain(
      '<h1 class="contents"><span class="text-h5 text-ods-accent">Endpoint management software</span> <span class="block text-h1 text-ods-text-primary" data-section-heading="true">Run by AI</span></h1>',
    );
  });
});

/** A heading's text as search engines and screen readers read it: the markup's text, tags removed, nothing added. */
const headingText = (node: ReactNode) =>
  html(node)
    .match(/<h[1-6][^>]*>([\s\S]*)<\/h[1-6]>/)?.[1]
    .replace(/<[^>]+>/g, '');

describe("a heading's text keeps its words apart", () => {
  it('reads a page heading with an eyebrow as two phrases, not one word', () => {
    expect(
      headingText(
        <SectionHeading level="page" eyebrow="AI-native IT automation" title="Fixed on its own" punctuation={null} />,
      ),
    ).toBe('AI-native IT automation Fixed on its own');
  });

  it('puts a space before every line break, and keeps an empty line as a blank line', () => {
    expect(
      headingText(<SectionHeading title={<HeadingLines lines={['Fixed on its own.', 'Approved with one tap']} />} />),
    ).toBe('Fixed on its own. Approved with one tap.');
    expect(html(<HeadingLines lines={['A.', '', 'B.']} />)).toBe('A. <br/> <br/>B.');
  });

  it('colours the sentence marks on every line of a multi-line title', () => {
    expect(html(<SectionHeading title={<HeadingLines lines={['Fixed on its own.', 'Approved']} />} />)).toContain(
      `Fixed on its own${mark('.')} <br/>Approved${mark('.')}`,
    );
  });
});
