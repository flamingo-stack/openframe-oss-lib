import { describe, expect, it } from 'vitest';
import { deepestTopic, isPagePathTopic, pageTopicFor, topicCandidates, topicMatchesPath } from '../page-topics';

describe('pageTopicFor: a page asks with its path', () => {
  it('drops the query, the hash and a trailing slash, lowercased and decoded', () => {
    expect(pageTopicFor('/Blog/My-Post/?x=1#faq')).toBe('/blog/my-post');
    expect(pageTopicFor('/caf%C3%A9')).toBe('/café');
    expect(pageTopicFor('/')).toBe('/');
    expect(pageTopicFor('')).toBe('/');
  });

  it('reads a segment with a malformed escape as written instead of throwing', () => {
    expect(pageTopicFor('/blog/%E0%A4%A')).toBe('/blog/%e0%a4%a');
  });

  it("asks without the host's mount, and leaves a path outside it as it is", () => {
    const options = { basePath: '/help-center' };
    expect(pageTopicFor('/help-center/roadmap', options)).toBe('/roadmap');
    expect(pageTopicFor('/help-center/releases/detail?slug=x', options)).toBe('/releases/detail');
    expect(pageTopicFor('/help-center', options)).toBe('/');
    expect(pageTopicFor('/devices', options)).toBe('/devices');
    expect(pageTopicFor('/help-centerx/roadmap', options)).toBe('/help-centerx/roadmap');
  });
});

describe('which tags are written for a page', () => {
  it('matches the path itself and its parents; the home tag only the home page', () => {
    expect(topicMatchesPath('/blog', '/blog')).toBe(true);
    expect(topicMatchesPath('/blog', '/blog/my-post')).toBe(true);
    expect(topicMatchesPath('/blog', '/blogs')).toBe(false);
    expect(topicMatchesPath('/blog/my-post', '/blog')).toBe(false);
    expect(topicMatchesPath('/', '/')).toBe(true);
    expect(topicMatchesPath('/', '/pricing')).toBe(false);
  });

  it('never matches a section word to a page', () => {
    expect(isPagePathTopic('agents')).toBe(false);
    expect(topicMatchesPath('agents', '/openframe')).toBe(false);
  });

  it('lists the candidates deepest first, and picks the deepest tag', () => {
    expect(topicCandidates('/blog/my-post')).toEqual(['/blog/my-post', '/blog']);
    expect(topicCandidates('/')).toEqual(['/']);
    expect(deepestTopic(['/blog', '/blog/my-post', '/pricing'], '/blog/my-post')).toBe('/blog/my-post');
    expect(deepestTopic(['/blog', '/pricing'], '/blog/other-post')).toBe('/blog');
    expect(deepestTopic(['/pricing'], '/blog')).toBeNull();
  });
});
