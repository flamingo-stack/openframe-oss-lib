/**
 * `FaqSection` in a page's loading state (`LoadingScope`) and while its own request is unanswered: it fetches
 * nothing in a scope and draws `FaqSectionSkeleton` (the heading real, a fixed count of question rows, no read
 * words). Outside a scope an empty answer still renders nothing.
 */

import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { PageTopicsProvider } from '../../../contexts/page-topics-context';
import type { Faq } from '../../../types/faq';
import { LoadingScope } from '../../ui/loading-scope';
import { FAQ_SECTION_SKELETON_QUESTIONS, FaqSection } from '../faq-section';

const fetchMock = vi.fn();
beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      observe() {}
      disconnect() {}
    },
  );
});
afterEach(() => vi.unstubAllGlobals());

/** Level-3 headings: every question row is one, and so is every category heading under the default `h2`. */
const level3 = () => screen.queryAllByRole('heading', { level: 3, hidden: true }).length;

const REAL = [{ id: 1, question: 'Do I pay per technician?', answer: 'No.', section: null }] as unknown as Faq[];

describe('FaqSection loading state', () => {
  it('draws its skeleton, with no request, in a loading scope', () => {
    render(
      <LoadingScope>
        <FaqSection entityType="blog_post" entityId={7} />
      </LoadingScope>,
    );
    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.getByRole('heading', { level: 2, hidden: true, name: 'Frequently Asked Questions' })).toBeTruthy();
    // One uncategorized group: only question rows.
    expect(level3()).toBe(FAQ_SECTION_SKELETON_QUESTIONS);
  });

  it('draws the categories the host usually shows, each with its heading, then the uncategorized group', () => {
    render(
      <LoadingScope>
        <FaqSection
          entityType="blog_post"
          entityId={7}
          skeletonShape={[
            { heading: true, rows: 2 },
            { heading: true, rows: 2 },
            { heading: true, rows: 1 },
            { rows: 1 },
          ]}
        />
      </LoadingScope>,
    );
    // 3 category headings + the 6 question rows the shape names.
    expect(level3()).toBe(3 + 6);
  });

  it('leaves the uncategorized group out when the host says its FAQs all have a category', () => {
    render(
      <LoadingScope>
        <FaqSection
          entityType="blog_post"
          entityId={7}
          skeletonShape={[
            { heading: true, rows: 2 },
            { heading: true, rows: 2 },
          ]}
        />
      </LoadingScope>,
    );
    expect(level3()).toBe(2 + 4);
  });

  it('draws the count of questions the instance asks for, and the topic line for real', () => {
    render(
      <PageTopicsProvider pathname="/pricing">
        <LoadingScope>
          <FaqSection showTopic minResults={3} />
        </LoadingScope>
      </PageTopicsProvider>,
    );
    expect(level3()).toBe(3);
    expect(screen.getByText('/pricing')).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('draws the skeleton in a scope even when handed FAQs (no read words while loading)', () => {
    render(
      <LoadingScope>
        <FaqSection initialFaqs={REAL} />
      </LoadingScope>,
    );
    expect(screen.queryByText('Do I pay per technician?')).toBeNull();
  });

  it('draws the same skeleton while its own request is unanswered, and says it is loading', () => {
    fetchMock.mockReturnValue(new Promise(() => {}));
    render(
      <PageTopicsProvider pathname="/pricing">
        <FaqSection minResults={3} />
      </PageTopicsProvider>,
    );
    expect(fetchMock).toHaveBeenCalled();
    expect(level3()).toBe(3);
    expect(screen.getByRole('status').textContent).toBe('Loading questions');
  });

  it('renders the FAQs it is handed outside a scope', () => {
    render(<FaqSection initialFaqs={REAL} />);
    expect(screen.getByText('Do I pay per technician?')).toBeTruthy();
  });

  it('renders nothing for an empty answer outside a scope', () => {
    render(<FaqSection initialFaqs={[]} />);
    expect(screen.queryAllByRole('heading', { hidden: true })).toHaveLength(0);
  });
});
