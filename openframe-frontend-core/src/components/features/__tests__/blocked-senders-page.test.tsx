import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mockReplace, setMockSearchParams } from '../../../../vitest.setup';
import { EndpointsRuntimeContext, type EndpointsRuntime } from '../../../contexts/endpoints-runtime-context';
import {
  BLOCKED_SENDERS_API_PATH,
  type BlockedSenderRow,
  type BlockedSendersListResponse,
  type BlockedSendersOverview,
  type BlockedSendersPageResult as WirePage,
  type SenderSuggestionRow,
  blockedSendersUrl,
  blockedSenderSuggestionUrl,
} from '../../../types/blocked-senders';
import { LoadingScope } from '../../ui/loading-scope';
import { BlockedSendersPage } from '../blocked-senders';

const ENDPOINT = '/api/admin/spam?env=qa';

const OVERVIEW: BlockedSendersOverview = {
  counts: { domains: 2, emails: 0, suggestions: 1, submissions: 3 },
  autoBlock: { enabled: true, dryRun: true },
  suggestBar: 4,
  blockBar: 8,
  blockMinStrong: 1,
};

const domain = (value: string, source: BlockedSenderRow['source']): BlockedSenderRow => ({
  value,
  kind: 'domain',
  reason: `Reason for ${value}`,
  addedBy: 'staff@flamingo.cx',
  createdAt: '2026-11-05T10:00:00Z',
  source,
});

const page = <T,>(items: T[]): WirePage<T> => ({
  items,
  page: 1,
  pageSize: 20,
  totalCount: items.length,
  totalPages: 1,
});

const DOMAINS: BlockedSendersListResponse = page([
  domain('mailinator.com', 'manual'),
  domain('seo-boost.example', 'auto'),
]);

const EMAILS: BlockedSendersListResponse = page<BlockedSenderRow>([]);

const SUGGESTION: SenderSuggestionRow = {
  id: 7,
  sender: 'growth-leads.example',
  kind: 'domain',
  score: 12,
  strongSignals: 2,
  submissionCount: 5,
  signals: [
    { id: 'burst', strength: 'strong', points: 3, label: 'Burst', evidence: '5 contact forms in 22 min' },
    { id: 'new_domain', strength: 'medium', points: 2, label: 'New domain', evidence: 'registered 12 days ago' },
  ],
  state: 'would_block',
  verdict: 'Over the block bar (8) with a strong signal: auto-block would block this (dry run).',
  suggestedReason: 'Auto-blocked: 5 submissions in 22 min, domain registered 12 days ago.',
  lastSubmissionAt: '2026-11-06T10:00:00Z',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

const fetchMock = vi.fn<typeof fetch>();

/** Answers every GET by its path; a write answers 200 unless the test says otherwise. */
function serve(overrides: { emails?: BlockedSendersListResponse; write?: () => Response } = {}) {
  const answer = (input: Parameters<typeof fetch>[0], init?: RequestInit): Response => {
    const url = String(input);
    if (init?.method && init.method !== 'GET') return overrides.write ? overrides.write() : json({ ok: true });
    const path = url.split('?')[0];
    if (path.endsWith('/overview')) return json(OVERVIEW);
    if (path.endsWith('/domains')) return json(DOMAINS);
    if (path.endsWith('/emails')) return json(overrides.emails ?? EMAILS);
    if (path.endsWith('/suggestions')) return json(page([SUGGESTION]));
    if (path.endsWith('/submissions')) return json(page([]));
    return json({ error: 'not found' }, 404);
  };
  fetchMock.mockImplementation((input, init) => Promise.resolve(answer(input, init)));
}

const requested = () => fetchMock.mock.calls.map(([input, init]) => ({ url: String(input), init }));

beforeEach(() => {
  fetchMock.mockReset();
  mockReplace.mockReset();
  vi.stubGlobal('fetch', fetchMock);
  setMockSearchParams(new URLSearchParams());
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe('blockedSendersUrl', () => {
  it("keeps the endpoint's own query and leaves out empty params", () => {
    expect(blockedSendersUrl(ENDPOINT, 'domains', { q: 'seo', page: 2, empty: '', none: null })).toBe(
      '/api/admin/spam/domains?env=qa&q=seo&page=2',
    );
    expect(blockedSendersUrl(BLOCKED_SENDERS_API_PATH, 'overview')).toBe('/api/admin/spam/overview');
    expect(blockedSenderSuggestionUrl(ENDPOINT, 7, 'not-spam')).toBe('/api/admin/spam/suggestions/7/not-spam?env=qa');
  });
});

describe('BlockedSendersPage', () => {
  it('lists the blocked domains with the tab counts, every row releasable, and no banner or block form', async () => {
    serve();
    render(<BlockedSendersPage endpoint={ENDPOINT} />);

    expect(await screen.findByText('seo-boost.example')).toBeInTheDocument();
    expect(screen.getByText('mailinator.com')).toBeInTheDocument();
    expect(screen.queryByRole('note')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Block domain' })).not.toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /^Release / })).toHaveLength(2);
    expect(screen.queryByText(/Blocked by configuration/i)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Domains (2)' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Suggestions (1)' })).toBeInTheDocument();

    const urls = requested().map(r => r.url);
    expect(urls).toContain('/api/admin/spam/overview?env=qa');
    expect(urls).toContain('/api/admin/spam/domains?env=qa&pageSize=20');
  });

  it('draws its own loading form in a loading scope and reads nothing', () => {
    serve();
    render(
      <LoadingScope>
        <BlockedSendersPage endpoint={ENDPOINT} />
      </LoadingScope>,
    );
    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.getByText('Blocked submissions')).toBeInTheDocument();
    expect(screen.queryByText('mailinator.com')).not.toBeInTheDocument();
  });

  it('reads the endpoint from the runtime when no prop names one', async () => {
    serve();
    const runtime = { blockedSendersUrl: '/proxy/spam' } as EndpointsRuntime;
    render(
      <EndpointsRuntimeContext.Provider value={runtime}>
        <BlockedSendersPage />
      </EndpointsRuntimeContext.Provider>,
    );
    await screen.findByText('mailinator.com');
    expect(requested().map(r => r.url)).toContain('/proxy/spam/overview');
  });

  it("reads the open list and the tab counts again when the host's refresh key changes", async () => {
    serve();
    const { rerender } = render(<BlockedSendersPage endpoint={ENDPOINT} />);
    await screen.findByText('mailinator.com');
    const reads = () =>
      requested()
        .filter(r => !r.init?.method || r.init.method === 'GET')
        .map(r => r.url.split('?')[0]);
    const before = reads().length;

    rerender(<BlockedSendersPage endpoint={ENDPOINT} refreshKey={1} />);

    await waitFor(() => expect(reads().length).toBeGreaterThanOrEqual(before + 2));
    const after = reads().slice(before);
    expect(after).toContain('/api/admin/spam/overview');
    expect(after).toContain('/api/admin/spam/domains');
  });

  it('keeps the list and says so when a reload after a change fails', async () => {
    serve();
    render(<BlockedSendersPage endpoint={ENDPOINT} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Release seo-boost.example' }));
    // From now on the domains list answers an error: the release lands, the reload that follows it does not.
    const healthy = fetchMock.getMockImplementation();
    fetchMock.mockImplementation((input, init) => {
      if (String(input).split('?')[0].endsWith('/domains') && (!init?.method || init.method === 'GET')) {
        return Promise.resolve(json({ error: 'down' }, 503));
      }
      return healthy ? healthy(input, init) : Promise.resolve(json({ ok: true }));
    });
    const dialog = await screen.findByRole('alertdialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Release' }));

    expect(
      await screen.findByText(/Could not read the blocked domains\. What is shown may be out of date\./),
    ).toBeInTheDocument();
    expect(screen.getByText('mailinator.com')).toBeInTheDocument();
  });

  it('releases a row after a confirmation', async () => {
    serve();
    render(<BlockedSendersPage endpoint={ENDPOINT} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Release seo-boost.example' }));

    const dialog = await screen.findByRole('alertdialog');
    expect(dialog).toHaveTextContent('Release seo-boost.example?');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Release' }));

    await waitFor(() => expect(requested().some(r => r.init?.method === 'DELETE')).toBe(true));
    expect(requested().find(r => r.init?.method === 'DELETE')?.url).toBe(
      '/api/admin/spam/domains?env=qa&value=seo-boost.example',
    );
  });

  it('lists the blocked addresses on the Emails tab, with no availability notice', async () => {
    setMockSearchParams(new URLSearchParams('tab=emails'));
    serve();
    render(<BlockedSendersPage endpoint={ENDPOINT} />);

    expect(await screen.findByText('No blocked addresses')).toBeInTheDocument();
    expect(screen.getByText('Every address you block is listed here.')).toBeInTheDocument();
    expect(screen.queryByText(/not available/i)).not.toBeInTheDocument();
  });

  it('switching tabs puts the tab in the address and starts its list from the top', async () => {
    setMockSearchParams(new URLSearchParams('q=seo&page=2'));
    serve();
    render(<BlockedSendersPage endpoint={ENDPOINT} />);
    await screen.findByText('mailinator.com');
    expect(requested().map(r => r.url)).toContain('/api/admin/spam/domains?env=qa&q=seo&page=2&pageSize=20');

    fireEvent.click(screen.getByRole('button', { name: 'Suggestions (1)' }));
    await waitFor(() => expect(mockReplace).toHaveBeenCalled());
    const href = String(mockReplace.mock.calls[mockReplace.mock.calls.length - 1]?.[0]);
    expect(href).toContain('tab=suggestions');
    expect(href).not.toContain('q=');
    expect(href).not.toContain('page=');
  });

  it('blocks a suggestion with its reason prefilled and editable, or marks it not spam', async () => {
    setMockSearchParams(new URLSearchParams('tab=suggestions'));
    serve();
    render(<BlockedSendersPage endpoint={ENDPOINT} />);

    expect(await screen.findByText('growth-leads.example')).toBeInTheDocument();
    expect(screen.getByText('5 contact forms in 22 min')).toBeInTheDocument();
    expect(screen.getByText(SUGGESTION.verdict)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Block domain' }));
    const dialog = await screen.findByRole('alertdialog');
    const reason = within(dialog).getByLabelText('Reason (required)');
    expect(reason).toHaveValue(SUGGESTION.suggestedReason);
    fireEvent.change(reason, { target: { value: 'Link spam' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Block domain' }));

    await waitFor(() => expect(requested().some(r => r.url.includes('/suggestions/7/block'))).toBe(true));
    const post = requested().find(r => r.url.includes('/suggestions/7/block'));
    expect(post?.url).toBe('/api/admin/spam/suggestions/7/block?env=qa');
    expect(JSON.parse(String(post?.init?.body))).toEqual({ reason: 'Link spam' });

    fireEvent.click(await screen.findByRole('button', { name: 'Not spam' }));
    await waitFor(() =>
      expect(requested().some(r => r.url === '/api/admin/spam/suggestions/7/not-spam?env=qa')).toBe(true),
    );
  });

  it('keeps the block dialog and the typed reason when the block fails, so it can be sent again', async () => {
    setMockSearchParams(new URLSearchParams('tab=suggestions'));
    serve({ write: () => json({ error: 'OpenFrame unreachable', code: 'UPSTREAM' }, 502) });
    render(<BlockedSendersPage endpoint={ENDPOINT} />);

    fireEvent.click(await screen.findByRole('button', { name: 'Block domain' }));
    const dialog = await screen.findByRole('alertdialog');
    fireEvent.change(within(dialog).getByLabelText('Reason (required)'), { target: { value: 'Link spam' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Block domain' }));

    await waitFor(() => expect(requested().some(r => r.url.includes('/suggestions/7/block'))).toBe(true));
    await waitFor(() => expect(within(dialog).getByRole('button', { name: 'Block domain' })).not.toBeDisabled());
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
    expect(within(screen.getByRole('alertdialog')).getByLabelText('Reason (required)')).toHaveValue('Link spam');
  });
});
