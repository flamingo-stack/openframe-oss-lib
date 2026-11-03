import { describe, expect, it } from 'vitest';
import type { ChatCitation, ChatPart, ChatSourcePart } from '../../../../chat-protocol/chat-message';
import { FALLBACK_TOP_RETRIEVED, groupedRowLabels, sourceRowInputOf, splitCitedSources } from '../cited-sources';

const blog = (id: string): ChatSourcePart => ({
  type: 'source-url',
  sourceId: `record://blog_post/${id}`,
  url: `https://www.flamingo.run/blog/${id}`,
  title: `Post ${id}`,
});
const release = (id: string): ChatSourcePart => ({
  type: 'source-url',
  sourceId: `record://product_release/${id}`,
  url: `https://www.flamingo.run/releases/${id}`,
  title: `Release ${id}`,
});
const collection = (type: string, title: string): ChatSourcePart => ({
  type: 'source-document',
  sourceId: `record://${type}`,
  mediaType: 'text/plain',
  title,
});
const citation = (source: ChatSourcePart, endIndex?: number): ChatCitation => ({
  source:
    source.type === 'source-url'
      ? { type: 'source', sourceType: 'url', id: source.sourceId, url: source.url, title: source.title }
      : {
          type: 'source',
          sourceType: 'document',
          id: source.sourceId,
          mediaType: source.mediaType,
          title: source.title,
        },
  ...(endIndex !== undefined ? { endIndex } : {}),
});
const text = (value: string, citations?: ChatCitation[]): ChatPart => ({
  type: 'text',
  text: value,
  ...(citations ? { citations } : {}),
});
const ids = (groups: ReturnType<typeof splitCitedSources>['cited']) =>
  groups.flatMap(group => group.rows.map(row => row.sourceId));

describe('splitCitedSources', () => {
  const cards = (...records: string[]): ChatPart => ({ type: 'data-record-cards', data: { records } });

  it('a record shown only as a card is cited: a card has no number or link of its own to say so', () => {
    const [a, b, c, d] = [blog('a'), blog('b'), blog('c'), blog('d')];
    const { cited, uncited } = splitCitedSources([a, b, c, d, cards(d.sourceId), text('That guide covers it.')]);
    expect(ids(cited)).toEqual([d.sourceId]);
    expect(ids(uncited)).toEqual([a.sourceId, b.sourceId, c.sourceId]);
    expect(cited[0].rows[0].number).toBeUndefined();
  });

  it('cards come after the citations and the links, in the order they show, each once', () => {
    const [a, b, c, d] = [blog('a'), blog('b'), blog('c'), blog('d')];
    const { cited } = splitCitedSources([
      a,
      b,
      c,
      d,
      cards(d.sourceId, c.sourceId),
      text('One. See [B](record://blog_post/b).', [citation(a, 4)]),
      cards(c.sourceId, a.sourceId),
    ]);
    expect(ids(cited)).toEqual([a.sourceId, b.sourceId, d.sourceId, c.sourceId]);
  });

  it('a card reads a record in the spelling a source part gave it', () => {
    const paren: ChatSourcePart = { ...blog('a'), sourceId: 'record://blog_post/a%28b%29' };
    expect(ids(splitCitedSources([paren, cards('record://blog_post/a(b)')]).cited)).toEqual([paren.sourceId]);
  });

  it('a card of a record nothing retrieved names no row', () => {
    const a = blog('a');
    const { cited, uncited } = splitCitedSources([a, cards('record://blog_post/other')]);
    expect(cited).toEqual([]);
    expect(ids(uncited)).toEqual([a.sourceId]);
  });

  it('a card leaves a cited collection`s other records alone, as a citation does', () => {
    const [a, b] = [blog('a'), blog('b')];
    const posts = collection('blog_post', 'Blog posts');
    const { cited, uncited } = splitCitedSources([a, b, posts, cards(b.sourceId), text('Two.', [citation(posts, 4)])]);
    expect(ids(cited)).toEqual([b.sourceId]);
    expect(ids(uncited)).toEqual([a.sourceId]);
  });

  it('leaves nothing to draw for a message with no sources', () => {
    expect(splitCitedSources([text('Hello')])).toEqual({ cited: [], uncited: [] });
  });

  it('orders the cited by reading order, not by the order the sources arrived', () => {
    const [a, b, c] = [blog('a'), release('b'), blog('c')];
    const { cited, uncited } = splitCitedSources([a, b, c, text('One. Two.', [citation(c, 4), citation(b, 9)])]);
    expect(ids(cited)).toEqual([c.sourceId, b.sourceId]);
    expect(ids(uncited)).toEqual([a.sourceId]);
    expect(cited[0].rows[0].number).toBe(1);
    expect(cited[1].rows[0].number).toBe(2);
  });

  it('a citation with only endIndex, or none, still reads in order: absent sorts at the part end', () => {
    const [a, b] = [blog('a'), release('b')];
    const { cited } = splitCitedSources([a, b, text('One. Two.', [citation(b), citation(a, 4)])]);
    expect(ids(cited)).toEqual([a.sourceId, b.sourceId]);
  });

  it('then the records the text links, in text order, each once, with no number', () => {
    const [a, b] = [blog('a'), release('b')];
    const { cited, uncited } = splitCitedSources([
      a,
      b,
      text(
        'See [B](record://product_release/b), and [A](record://blog_post/a) and [B again](record://product_release/b).',
      ),
    ]);
    expect(ids(cited)).toEqual([b.sourceId, a.sourceId]);
    expect(cited.flatMap(group => group.rows).every(row => row.number === undefined)).toBe(true);
    expect(uncited).toEqual([]);
  });

  it('a record both cited and linked keeps its number and its place', () => {
    const [a, b] = [blog('a'), release('b')];
    const { cited } = splitCitedSources([a, b, text('[B](record://product_release/b) One.', [citation(a, 30)])]);
    expect(ids(cited)).toEqual([a.sourceId, b.sourceId]);
    expect(cited[0].rows[0].number).toBe(1);
  });

  it('a link to a record nobody retrieved is no row', () => {
    const a = blog('a');
    const { cited, uncited } = splitCitedSources([a, text('See [Old](record://blog_post/old).')]);
    expect(cited).toEqual([]);
    expect(ids(uncited)).toEqual([a.sourceId]);
  });

  it('a cited collection marks its type cited, each row answering to its number, and is no row itself', () => {
    const posts = [blog('a'), blog('b'), blog('c')];
    const header = collection('blog_post', 'Blog posts');
    const { cited, uncited } = splitCitedSources([...posts, release('x'), header, text('All.', [citation(header, 4)])]);
    expect(cited).toHaveLength(1);
    expect(cited[0].label).toBe('Blog Posts (3 records)');
    expect(cited[0].rows.map(row => row.number)).toEqual([1, 1, 1]);
    expect(ids(uncited)).toEqual(['record://product_release/x']);
  });

  it('a cited collection leaves its type alone once a record of it is individually cited', () => {
    const [a, b] = [blog('a'), blog('b')];
    const header = collection('blog_post', 'Blog posts');
    const { cited, uncited } = splitCitedSources([
      a,
      b,
      header,
      text('One. All.', [citation(a, 4), citation(header, 9)]),
    ]);
    expect(ids(cited)).toEqual([a.sourceId]);
    expect(ids(uncited)).toEqual([b.sourceId]);
  });

  it('or linked', () => {
    const [a, b] = [blog('a'), blog('b')];
    const header = collection('blog_post', 'Blog posts');
    const { cited, uncited } = splitCitedSources([
      a,
      b,
      header,
      text('See [A](record://blog_post/a).', [citation(header, 5)]),
    ]);
    expect(ids(cited)).toEqual([a.sourceId]);
    expect(ids(uncited)).toEqual([b.sourceId]);
  });

  it('never draws a video or a collection as a row', () => {
    const video: ChatSourcePart = {
      type: 'source-url',
      sourceId: 'record://video/mux-abc',
      url: 'https://x.test/v',
      title: 'V',
    };
    const { cited, uncited } = splitCitedSources([
      video,
      collection('blog_post', 'Blog posts'),
      text('Hi.', [citation(video, 3)]),
    ]);
    expect(cited).toEqual([]);
    expect(uncited).toEqual([]);
  });

  it('a table partly cited is two chips, the cited rows and the rest', () => {
    const [a, b] = [blog('a'), blog('b')];
    const { cited, uncited } = splitCitedSources([a, b, text('One.', [citation(a, 4)])]);
    expect(cited[0].label).toBe('Blog Posts (1 record)');
    expect(uncited[0].label).toBe('Blog Posts (1 record)');
  });

  it('matches a linked alias type to its canonical source', () => {
    const a = blog('a');
    const { cited } = splitCitedSources([a, text('See [A](record://blog_post_existing/a).')]);
    expect(ids(cited)).toEqual([a.sourceId]);
  });

  it('keeps FALLBACK_TOP_RETRIEVED for the strip of an answer that cited nothing', () => {
    expect(FALLBACK_TOP_RETRIEVED).toBe(3);
  });
});

describe('sourceRowInputOf: the standard names, in the words the resolver reads', () => {
  it('a record with a url names its owner from the url', () => {
    expect(sourceRowInputOf(blog('a'))).toEqual({
      sourceRepo: 'blog-posts',
      documentType: 'blog_post',
      id: 'a',
      title: 'Post a',
      externalUrl: 'https://www.flamingo.run/blog/a',
      targetPlatform: 'flamingo',
      path: null,
    });
  });

  it('a third party names none', () => {
    const slack: ChatSourcePart = {
      type: 'source-url',
      sourceId: 'record://slack_message/1',
      url: 'https://x.slack.com/a',
    };
    expect(sourceRowInputOf(slack)).toMatchObject({
      externalUrl: 'https://x.slack.com/a',
      targetPlatform: null,
      title: '1',
    });
  });

  it('an old doc source opens by its tree path', () => {
    const doc: ChatSourcePart = {
      type: 'source-document',
      sourceId: 'record://markdown/docs%2Fsetup.md',
      mediaType: 'text/plain',
      title: 'Setup',
      filename: 'docs/setup.md',
    };
    expect(sourceRowInputOf(doc)).toMatchObject({ id: 'docs/setup.md', externalUrl: null, path: 'docs/setup.md' });
  });
});

describe('groupedRowLabels', () => {
  it('prints a number only to tell rows of different citations apart', () => {
    expect(groupedRowLabels([{ ...blog('a'), number: 1 }, { ...blog('b'), number: 2 }, blog('c')])).toEqual([
      '[1] Post a',
      '[2] Post b',
      'Post c',
    ]);
    expect(
      groupedRowLabels([
        { ...blog('a'), number: 3 },
        { ...blog('b'), number: 3 },
      ]),
    ).toEqual(['Post a', 'Post b']);
  });
});
