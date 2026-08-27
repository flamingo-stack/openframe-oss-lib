import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { RELATED_CARD_REGISTRY, type RelatedCardContext } from '../card-registry';

/**
 * The rail hands each registry entry an UNVALIDATED row — the fetch is
 * `useSelfFetch<unknown>` and the row's shape is decided at runtime by the
 * ref's type. These cover the decode seam that replaced the old `item: any`:
 * a real row must reach its card intact, and a broken row must degrade to a
 * placeholder rather than render the literal text "undefined" (the "vundefined"
 * version-pill class of bug).
 */

const CTX: RelatedCardContext = {
  size: 'default',
  legacySize: 'default',
  href: 'https://example.com/x',
  targetPlatform: null,
  linkProps: { href: 'https://example.com/x' },
  anchorAttrs: {},
  placeholderUrl: undefined,
  extras: {
    programConfigs: {
      podcast: {
        type: 'podcast',
        labels: {
          singular: 'Episode',
          plural: 'Episodes',
          upcoming: 'Latest Episode',
          upcomingSection: 'Upcoming Episodes',
          archive: 'All Episodes',
          empty: 'No episodes yet',
        },
        dateField: 'date',
        table: 'podcast_episodes',
        apiEndpoint: '/api/podcasts',
        icon: null,
        externalLinkLabel: 'Listen on Podbean',
        detailRoute: '/podcasts',
      },
    },
  },
};

const ROWS: Record<string, unknown> = {
  blog_post_existing: {
    id: 1,
    title: 'Blog Title',
    slug: 'b',
    summary: 's',
    featured_image: null,
    published_at: '2026-01-01',
    author_name: 'A',
    author_avatar: null,
    categories: [{ name: 'News', slug: 'news' }],
    tags: [],
  },
  case_study: { id: 2, title: 'Case Title', summary: 's', msp: { name: 'Acme' }, user: { full_name: 'Jo' } },
  customer_interview: { id: 3, title: 'Interview Title', video_summary: 'v', msp: { name: 'Acme' } },
  product_release: { title: 'Release Title', version: '1.2.3', summary: 's', release_date: '2026-01-01' },
  podcast: { id: 'p1', title: 'Podcast Title', description: 'd', cover_url: null, date: '2026-01-01' },
  investor_update: { id: 'i1', title: 'Update Title', update_number: 4, strategic_update: 'st' },
  onboarding_guide: { id: 'g1', title: 'Guide Title', section: 'Start', step_order: 1, content: 'c' },
  what_i_shipped: { title: 'Shipped Title', summary: 's', entry_month: '2026-01-01' },
  how_i_work: { title: 'How Title', summary: 's', session_date: '2026-01-01' },
  roadmap_item: { id: 'r1', title: 'Roadmap Title', description: 'd', status: 'open', quarter: 'Q1' },
};

describe('RELATED_CARD_REGISTRY', () => {
  it('decodes a realistic row into each registered card', () => {
    for (const [type, row] of Object.entries(ROWS)) {
      const entry = RELATED_CARD_REGISTRY[type];
      expect(entry, type).toBeTruthy();
      const { unmount } = render(<div>{entry.render(row, CTX)}</div>);
      expect(screen.queryAllByText(/Title/).length, type).toBeGreaterThan(0);
      unmount();
    }
  });

  it('never renders the literal "undefined" for a malformed row', () => {
    // Programs are excluded: `<ProgramCard>` formats `item.date` unguarded, so
    // a row without one throws `RangeError: Invalid time value` out of
    // date-fns. That predates this registry (a raw row with no `date` reached
    // the same `new Date(undefined)`) and belongs to the card, not the decode.
    const programTypes = new Set(['podcast', 'webinar', 'event']);
    const junkRows: unknown[] = [null, undefined, 'a string', 42, { title: 7, categories: 'nope', upvotes: 'x' }];
    for (const [type, entry] of Object.entries(RELATED_CARD_REGISTRY)) {
      if (programTypes.has(type)) continue;
      for (const row of junkRows) {
        const { unmount } = render(<div>{entry.render(row, CTX)}</div>);
        expect(document.body.textContent, type).not.toContain('undefined');
        unmount();
      }
    }
  });

  it('renders a skeleton for every registered type', () => {
    for (const [type, entry] of Object.entries(RELATED_CARD_REGISTRY)) {
      const { unmount } = render(<div data-testid="skeleton-host">{entry.skeleton('default')}</div>);
      expect(screen.getByTestId('skeleton-host').hasChildNodes(), type).toBe(true);
      unmount();
    }
  });
});
