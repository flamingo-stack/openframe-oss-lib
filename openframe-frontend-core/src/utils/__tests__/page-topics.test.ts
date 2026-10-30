import { describe, expect, it } from 'vitest';
import { pageTopicFor, type PageTopics } from '../page-topics';

const TOPICS: PageTopics = {
  '/': 'home',
  '/pricing': 'pricing',
  '/blog': 'blog',
  '/blog/[slug]': 'blog_post',
  '/roadmap': 'roadmap',
  '/roadmap-and-releases': 'roadmap-and-releases',
  '/admin/performance/employee/[id]/who-am-i': 'who-am-i',
  '/help-center/legal/[docType]': '[docType]',
};

describe('pageTopicFor', () => {
  it('reads the home page from `/` only', () => {
    expect(pageTopicFor('/', TOPICS)).toBe('home');
    expect(pageTopicFor('/unknown', TOPICS)).toBeNull();
    expect(pageTopicFor('/', { '/pricing': 'pricing' })).toBeNull();
  });

  it('covers a route and every page under it', () => {
    expect(pageTopicFor('/pricing', TOPICS)).toBe('pricing');
    expect(pageTopicFor('/pricing/calculator', TOPICS)).toBe('pricing');
    expect(pageTopicFor('/pricing?plan=yearly#faq', TOPICS)).toBe('pricing');
  });

  it('never reads a longer route name as a shorter one', () => {
    expect(pageTopicFor('/roadmap-and-releases', TOPICS)).toBe('roadmap-and-releases');
    expect(pageTopicFor('/roadmap', TOPICS)).toBe('roadmap');
  });

  it('prefers the more specific route: a record page over its list page', () => {
    expect(pageTopicFor('/blog', TOPICS)).toBe('blog');
    expect(pageTopicFor('/blog/how-we-ship', TOPICS)).toBe('blog_post');
  });

  it('matches a `[name]` segment anywhere in a route', () => {
    expect(pageTopicFor('/admin/performance/employee/42/who-am-i', TOPICS)).toBe('who-am-i');
    expect(pageTopicFor('/admin/performance/employee/42', TOPICS)).toBeNull();
  });

  it("names a segment's value as the topic when the topic is that segment's name", () => {
    expect(pageTopicFor('/help-center/legal/privacy-policy', TOPICS)).toBe('privacy-policy');
    expect(pageTopicFor('/help-center/legal', TOPICS)).toBeNull();
  });

  it('reads a segment with a malformed escape as written instead of throwing', () => {
    expect(pageTopicFor('/blog/%E0%A4%A', TOPICS)).toBe('blog_post');
    expect(pageTopicFor('/help-center/legal/%ZZ', TOPICS)).toBe('%ZZ');
  });

  it('prefers a literal segment over a `[name]` one at the same depth', () => {
    expect(pageTopicFor('/blog/new', { '/blog/[slug]': 'blog_post', '/blog/new': 'new-post' })).toBe('new-post');
  });
});
