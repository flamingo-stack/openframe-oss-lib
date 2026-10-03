import type { ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { accentSentenceMarks, SectionHeading } from './page-heading';

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

  it('walks fragments and elements', () => {
    expect(html(accentSentenceMarks(<p>Try it. Break it.</p>, 'pink'))).toBe(
      '<p>Try it<span class="pink">.</span> Break it<span class="pink">.</span></p>',
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

  it('the section heading colours the marks inside its title and its closing mark', () => {
    expect(html(<SectionHeading title="Remote all year. Together once a year" />)).toContain(
      `Remote all year${mark('.')} Together once a year${mark('.')}`,
    );
  });
});
