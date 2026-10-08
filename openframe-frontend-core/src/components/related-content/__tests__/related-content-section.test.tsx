import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ContentRef } from '../../../types/content-ref';
import { GROUP_PAGE_SIZE, RelatedContentSection } from '../related-content-section';

const fetchMock = vi.fn<typeof fetch>();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const REFS: ContentRef[] = Array.from({ length: 30 }, (_, i) => ({
  type: 'case_study',
  id: String(i + 1),
  slug: `case-${i + 1}`,
  url: `/case-studies/case-${i + 1}`,
  title: `Case ${i + 1}`,
  visibility: 'public' as const,
  display_order: i,
}));

const idsOf = (input: string | URL | Request) =>
  new URL(String(input), 'http://hub').searchParams.get('ids')?.split(',') ?? [];

describe('RelatedContentSection group paging', () => {
  it('requests only the ids of the page on screen, and pages back without a request', async () => {
    fetchMock.mockImplementation(input =>
      Promise.resolve(
        new Response(JSON.stringify({ items: idsOf(input).map(id => ({ id: Number(id), title: `Case ${id}` })) }), {
          headers: { 'content-type': 'application/json' },
        }),
      ),
    );
    render(<RelatedContentSection contentRefs={REFS} />);

    expect(await screen.findByText('Case 1')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Page 2' }));
    expect(await screen.findByText('Case 13')).toBeInTheDocument();
    expect(fetchMock.mock.calls.map(([input]) => idsOf(input))).toEqual([
      REFS.slice(0, GROUP_PAGE_SIZE).map(r => r.id),
      REFS.slice(GROUP_PAGE_SIZE, 2 * GROUP_PAGE_SIZE).map(r => r.id),
    ]);

    fireEvent.click(screen.getByRole('button', { name: 'Page 1' }));
    expect(screen.getByText('Case 1')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
