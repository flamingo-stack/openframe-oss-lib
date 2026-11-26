import { describe, expect, it } from 'vitest';
import {
  deepestTopic,
  isPagePathTopic,
  normalizeTopic,
  pageAddressFor,
  pageTopicFor,
  sectionTopicFor,
  topicCandidates,
  topicMatchesPath,
} from '../page-topics';

describe('pageAddressFor: the address the stamp prints', () => {
  it('keeps the mount, in the form topics are compared in', () => {
    expect(pageAddressFor('/Help-Center/FAQs/?x=1#top')).toBe('/help-center/faqs');
    expect(pageAddressFor('/help-center')).toBe('/help-center');
    expect(pageAddressFor('/')).toBe('/');
    expect(pageAddressFor('')).toBe('/');
  });

  it('differs from the topic only under a mount', () => {
    expect(pageAddressFor('/help-center/roadmap')).not.toBe(
      pageTopicFor('/help-center/roadmap', { basePath: '/help-center' }),
    );
    expect(pageAddressFor('/devices')).toBe(pageTopicFor('/devices', { basePath: '/help-center' }));
  });
});

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

  it('a word is not a topic: a section is its page and anchor', () => {
    expect(isPagePathTopic('agents')).toBe(false);
    expect(topicMatchesPath('agents', '/openframe')).toBe(false);
    // Not a topic, so written for no place, itself included, and no tag can be written for it.
    expect(topicMatchesPath('agents', 'agents')).toBe(false);
    expect(topicMatchesPath('/openframe', 'agents')).toBe(false);
    expect(topicCandidates('agents')).toEqual([]);
    expect(topicCandidates('')).toEqual([]);
    expect(normalizeTopic('agents')).toBeNull();
    expect(normalizeTopic(' /OpenFrame/#Agents ')).toBe('/openframe#agents');
    expect(normalizeTopic('/pricing#not an anchor')).toBeNull();
    expect(sectionTopicFor('/Pricing/?x=1', 'AI-Token-Rates')).toBe('/pricing#ai-token-rates');
  });

  it('a section tag covers its section only; a page tag covers the page and its sections', () => {
    expect(topicMatchesPath('/openframe#agents', '/openframe#agents')).toBe(true);
    expect(topicMatchesPath('/openframe#agents', '/openframe')).toBe(false);
    expect(topicMatchesPath('/openframe#agents', '/openframe#pricing')).toBe(false);
    expect(topicMatchesPath('/openframe', '/openframe#agents')).toBe(true);
    expect(topicMatchesPath('/', '/#agents')).toBe(true);
    expect(topicMatchesPath('/', '/pricing#pricing')).toBe(false);
    expect(topicCandidates('/pricing#ai-token-rates')).toEqual(['/pricing#ai-token-rates', '/pricing']);
    expect(deepestTopic(['/pricing', '/pricing#ai-token-rates'], '/pricing#ai-token-rates')).toBe(
      '/pricing#ai-token-rates',
    );
    expect(deepestTopic(['/pricing', '/pricing#ai-token-rates'], '/pricing')).toBe('/pricing');
  });

  it('lists the candidates deepest first, and picks the deepest tag', () => {
    expect(topicCandidates('/blog/my-post')).toEqual(['/blog/my-post', '/blog']);
    expect(topicCandidates('/')).toEqual(['/']);
    expect(deepestTopic(['/blog', '/blog/my-post', '/pricing'], '/blog/my-post')).toBe('/blog/my-post');
    expect(deepestTopic(['/blog', '/pricing'], '/blog/other-post')).toBe('/blog');
    expect(deepestTopic(['/pricing'], '/blog')).toBeNull();
  });
});
