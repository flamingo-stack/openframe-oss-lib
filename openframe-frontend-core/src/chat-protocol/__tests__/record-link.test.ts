/**
 * The record link grammar: one markdown link per record (`[name](record://type/id)`). The hub and the Java agent
 * mirror it to check the links an answer writes, so its edges are pinned here.
 */

import { describe, expect, it } from 'vitest';
import { extractRecordLinks, parseRecordHref, recordHref, unlinkUnknownRecords } from '../record-link';

const ID = '6aad91a3b776f95ad7491bd9';

describe('recordHref / parseRecordHref', () => {
  it.each([
    ['script', ID],
    ['onboarding_guide', 'mac-guide'],
    ['markdown', 'docs/setup.v2.md'],
    ['blog', 'a slug (draft)'],
    ['doc', 'urn:x:1'],
    ['scheduledScript', 'é-ü'],
  ])('round-trips %s:%s', (type, id) => {
    expect(parseRecordHref(recordHref(type, id))).toEqual({ type, id });
  });

  it('reads an id the model left unencoded: the type ends at the first slash', () => {
    expect(parseRecordHref('record://markdown/docs/setup.md')).toEqual({ type: 'markdown', id: 'docs/setup.md' });
  });

  it.each(['card://blog:1', 'record://', 'record://blog', 'record://blog/', 'record:///1', 'record://1x/2', 42])(
    'is not a record: %s',
    href => {
      expect(parseRecordHref(href)).toBeNull();
    },
  );
});

describe('extractRecordLinks', () => {
  it('finds each link with its name and position', () => {
    const text = `Run [Patch script](record://script/${ID}) on [Mac guide](<record://onboarding_guide/mac-guide>).`;
    const links = extractRecordLinks(text);
    expect(links.map(l => [l.type, l.id, l.label])).toEqual([
      ['script', ID, 'Patch script'],
      ['onboarding_guide', 'mac-guide', 'Mac guide'],
    ]);
    expect(text.slice(links[0].start, links[0].end)).toBe(`[Patch script](record://script/${ID})`);
  });

  it('reads escaped brackets in a name and ignores other links', () => {
    const text = '[a \\[b\\]](record://blog/x) and [docs](https://example.com)';
    expect(extractRecordLinks(text).map(l => l.label)).toEqual(['a [b]']);
  });
});

describe('unlinkUnknownRecords', () => {
  const allowed = (r: { type: string; id: string }) => r.type === 'script' && r.id === ID;

  it('keeps an offered record and turns any other into its plain name', () => {
    const text = `[Patch script](record://script/${ID}) and [Ghost](record://script/000000000000000000000000).`;
    expect(unlinkUnknownRecords(text, allowed)).toBe(`[Patch script](record://script/${ID}) and Ghost.`);
  });

  it('leaves a text with no record link as it is', () => {
    expect(unlinkUnknownRecords('see [docs](https://example.com)', allowed)).toBe('see [docs](https://example.com)');
  });
});
