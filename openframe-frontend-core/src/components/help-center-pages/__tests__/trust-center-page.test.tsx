import { readFileSync } from 'node:fs';
import path from 'node:path';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setMockSearchParams } from '../../../../vitest.setup';
import {
  TRUST_CENTER_TAGLINE,
  TRUST_CENTER_TITLE,
  TRUST_CENTER_API_PATH,
  TRUST_DOCUMENT_REQUEST_PREFIX,
  filterTrustControlDomains,
  trustCenterSearchUrl,
  trustDocumentContactReason,
  type TrustCenterPublic,
  type TrustCenterDocument,
} from '../../../types/trust-center';
import { TRUST_CENTER_FIXTURE_WINDOW_MS, makeTrustCenterData } from '../__fixtures__/trust-center';
import { TrustCenterPage } from '../trust-center-page';
import { highlight } from '../trust-center-sections';

// The real ContactForm needs the endpoints + chat runtimes; the page only
// decides WHAT it is handed, so a stub that echoes its props is the honest
// seam for "the modal pre-fills the reason and stays on the page".
vi.mock('../../contact/contact-form', () => ({
  ContactForm: (props: {
    defaultValues?: { helpCategory?: string; message?: string };
    hideFields?: readonly string[];
    successRedirectUrl?: string;
    onSubmitSuccess?: () => void;
  }) => (
    <div data-testid="contact-form">
      <span data-testid="reason">{props.defaultValues?.helpCategory}</span>
      <span data-testid="message">{props.defaultValues?.message}</span>
      <span data-testid="hidden">{(props.hideFields ?? []).join('|')}</span>
      <span data-testid="redirect">{JSON.stringify(props.successRedirectUrl)}</span>
      <button type="button" onClick={props.onSubmitSuccess}>
        stub-submit
      </button>
    </div>
  ),
}));

const WINDOW_MS = TRUST_CENTER_FIXTURE_WINDOW_MS;
const makeData = makeTrustCenterData;

const fetchMock = vi.fn<typeof fetch>();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
  setMockSearchParams(new URLSearchParams());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

/** Stands in for the hub route: answers `?q=` with the SERVER's filter over `data`, and records each search. */
function serveControlsSearch(data: TrustCenterPublic): string[] {
  const asked: string[] = [];
  fetchMock.mockImplementation(input => {
    const url = new URL(
      typeof input === 'string' ? input : input instanceof URL ? input.href : input.url,
      'http://hub',
    );
    const query = url.searchParams.get('q') ?? '';
    asked.push(query);
    return Promise.resolve(
      jsonResponse({ query, controlDomains: filterTrustControlDomains(data.controlDomains, query) }),
    );
  });
  return asked;
}

function typeSearch(value: string) {
  fireEvent.change(screen.getByPlaceholderText('Search controls'), { target: { value } });
}

describe('TrustCenterPage', () => {
  it('does not fetch when initialData is given', () => {
    render(<TrustCenterPage initialData={makeData()} />);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.getByText('SOC 2 Type II')).toBeInTheDocument();
  });

  it('fetches the configured endpoint when no initialData is given', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(makeData()));
    render(<TrustCenterPage endpoint="/content/api/trust-center" />);
    await screen.findByText('SOC 2 Type II');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0][0])).toBe('/content/api/trust-center');
  });

  it('is ONE page: every section is an anchored h2, in reading order, AI first', () => {
    render(<TrustCenterPage initialData={makeData()} />);
    const headings = screen.getAllByRole('heading', { level: 2 }).map(h => h.textContent);
    expect(headings).toEqual(['AI & data use', 'Compliance', 'Controls', 'Documents', 'Subprocessors', 'Contact']);
    // Each section is a labelled landmark (a deep-linkable `#id`).
    expect(screen.getByRole('region', { name: 'Controls' })).toHaveAttribute('id', 'controls');
    expect(screen.queryByRole('tab')).toBeNull();
  });

  it('boxes the data-use commitment above the other AI practices', () => {
    render(<TrustCenterPage initialData={makeData()} />);
    expect(screen.getByText('We never use customer data to train AI models')).toBeInTheDocument();
    expect(screen.getByText('Model providers')).toBeInTheDocument();
  });

  it('compliance: one row per framework, proof before roadmap, the status ONCE as a badge, percent only when published', () => {
    const { rerender } = render(<TrustCenterPage initialData={makeData()} />);
    const compliance = within(screen.getByRole('region', { name: 'Compliance' }));
    expect(compliance.getAllByText('In progress')).toHaveLength(1);
    const names = compliance.getAllByText(/SOC 2|ISO 27001|ISO 42001/).map(node => node.textContent);
    expect(names[0]).toMatch(/SOC 2/);
    expect(compliance.getAllByText('Planned').length).toBeGreaterThan(0);
    expect(compliance.queryByText(/controls passing/)).toBeNull();

    rerender(
      <TrustCenterPage
        initialData={makeData({
          frameworks: [
            { id: 'soc2', label: 'SOC 2 Type II', status: 'certified', percent: 97, reportPeriod: 'Jan–Jun 2026' },
          ],
        })}
      />,
    );
    expect(screen.getByText('Jan–Jun 2026 · 97% of controls passing')).toBeInTheDocument();
    expect(screen.getAllByText('Certified')).toHaveLength(1);
  });

  it('questions go through the request form: no security address, no vulnerability or disclosure wording', async () => {
    render(<TrustCenterPage initialData={makeData()} />);
    expect(screen.queryByText(/vulnerab|disclosure|bug bounty|@/i)).toBeNull();
    expect(screen.queryAllByRole('link').filter(link => link.getAttribute('href')?.startsWith('mailto:'))).toEqual([]);
    fireEvent.click(screen.getByRole('button', { name: 'Get in touch' }));
    expect(await screen.findByTestId('contact-form')).toBeInTheDocument();
  });

  it('controls browse: category cards show 3 controls, "View all" opens the full category in a drawer', async () => {
    render(<TrustCenterPage initialData={makeData()} />);
    expect(screen.getByText('Encryption at rest')).toBeInTheDocument();
    expect(screen.queryByText('Logging enabled')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'View all 4 Infrastructure security controls' }));
    const drawer = await screen.findByRole('dialog');
    expect(within(drawer).getByText('Infrastructure security')).toBeInTheDocument();
    expect(within(drawer).getByText('Logging enabled')).toBeInTheDocument();
  });

  it('controls search: ONE flat grouped list with every match visible, a count, and clearing restores the grid', async () => {
    const data = makeData();
    serveControlsSearch(data);
    render(<TrustCenterPage initialData={data} />);

    typeSearch('log');
    // A match beyond the card's first 3 is shown directly — nothing to expand.
    expect(await screen.findByText(/1 of 5 controls match/)).toBeInTheDocument();
    // The match is highlighted in its own <strong>; the rest of the name follows it.
    expect(screen.getByText('Log', { selector: 'strong' })).toBeInTheDocument();
    expect(screen.getByText('ging enabled', { exact: false })).toBeInTheDocument();
    expect(screen.queryByText('Encryption at rest')).toBeNull();
    expect(screen.queryByRole('button', { name: /View all/ })).toBeNull();

    typeSearch('every user');
    expect(await screen.findByText('Unique accounts')).toBeInTheDocument();
    expect(screen.getByText(/1 of 5 controls match/)).toBeInTheDocument();

    typeSearch('zzz-nothing');
    expect(await screen.findByText('No matching controls')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Show all controls' }));
    expect(screen.getByText('Encryption at rest')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /View all/ })).toBeInTheDocument();
  });

  it('ONE access request: the hero CTA asks for all gated documents, a row asks for its own; marketing fields hidden', async () => {
    render(<TrustCenterPage initialData={makeData()} />);

    // PageLayout renders its actions once per breakpoint (desktop + mobile bar).
    fireEvent.click(screen.getAllByRole('button', { name: 'Request access' })[0]);
    let dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByTestId('reason')).toHaveTextContent(TRUST_DOCUMENT_REQUEST_PREFIX);
    expect(within(dialog).getByTestId('hidden')).toHaveTextContent('companySize|referralSource|helpCategory');
    expect(within(dialog).getByTestId('redirect')).toHaveTextContent('""');
    fireEvent.click(within(dialog).getByText('stub-submit'));
    await waitFor(() => expect(screen.queryByTestId('contact-form')).toBeNull());

    fireEvent.click(screen.getByRole('button', { name: 'Request SOC 2 report' }));
    dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByTestId('reason')).toHaveTextContent(trustDocumentContactReason('SOC 2 report'));
    expect(within(dialog).getByTestId('message')).toHaveTextContent('SOC 2 report');
  });

  it('public documents are a same-tab View link, no duplicate access label', () => {
    render(<TrustCenterPage initialData={makeData()} />);
    const view = screen.getByRole('link', { name: 'View Privacy policy' });
    expect(view).toHaveAttribute('href', '/privacy-policy');
    expect(view).not.toHaveAttribute('target', '_blank');
  });

  it('hides empty sections and the request CTA when nothing is gated', () => {
    render(
      <TrustCenterPage
        initialData={makeData({
          controlDomains: [],
          documents: [],
          subprocessors: [],
          aiPractices: [],
          faqs: [],
        })}
      />,
    );
    const headings = screen.getAllByRole('heading', { level: 2 }).map(h => h.textContent);
    expect(headings).toEqual(['Compliance', 'Contact']);
    expect(screen.queryByRole('button', { name: 'Request access' })).toBeNull();
    expect(screen.queryByText('System status')).toBeNull();
  });

  it('renders LoadError on a failed fetch and retries', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    fetchMock.mockResolvedValueOnce(jsonResponse({ error: 'boom' }, 500));
    render(<TrustCenterPage />);
    await screen.findByText('Could not load the trust center');

    fetchMock.mockResolvedValueOnce(jsonResponse(makeData()));
    fireEvent.click(screen.getByRole('button', { name: /try again/i }));
    await screen.findByText('SOC 2 Type II');
    expect(fetchMock).toHaveBeenCalledTimes(2);
    consoleError.mockRestore();
  });

  it('monitoring: monitored → paused when syncedAt is older than the window (the status line is the only claim)', () => {
    const { unmount } = render(<TrustCenterPage initialData={makeData()} />);
    expect(screen.getByText(/^Controls continuously monitored · updated/)).toBeInTheDocument();
    unmount();

    render(
      <TrustCenterPage initialData={makeData({ syncedAt: new Date(Date.now() - WINDOW_MS - 60_000).toISOString() })} />,
    );
    expect(screen.getByText(/^Monitoring paused/)).toBeInTheDocument();
    expect(screen.queryByText(/continuously monitored/)).toBeNull();
  });

  it('not connected says so plainly — never "paused", never a monitoring claim', () => {
    render(<TrustCenterPage initialData={makeData({ connected: false, syncedAt: null })} />);
    expect(screen.getByText('Live control monitoring is not enabled yet')).toBeInTheDocument();
    expect(screen.queryByText(/paused/)).toBeNull();
    expect(screen.queryByText(/continuously monitored/)).toBeNull();
  });
  it('defaults to the brand-neutral title + tagline (a host adds its brand via props)', () => {
    render(<TrustCenterPage initialData={makeData()} />);
    expect(screen.getByRole('heading', { level: 1, name: TRUST_CENTER_TITLE })).toBeInTheDocument();
    expect(screen.getAllByText(TRUST_CENTER_TAGLINE).length).toBeGreaterThan(0);
    expect(screen.queryByText(/Flamingo/)).toBeNull();
  });

  it('documentHref: the host routes a legal document to its own page; null offers a request instead', () => {
    const legalHref = (document: TrustCenterDocument) =>
      document.legalDocType ? `/legal/${document.legalDocType}` : (document.url ?? null);
    const { unmount } = render(<TrustCenterPage initialData={makeData()} documentHref={legalHref} />);
    expect(screen.getByRole('link', { name: 'View Privacy policy' })).toHaveAttribute('href', '/legal/privacy');
    unmount();

    render(<TrustCenterPage initialData={makeData()} documentHref={() => null} />);
    expect(screen.queryByRole('link', { name: 'View Privacy policy' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Request Privacy policy' })).toBeInTheDocument();
  });

  it('monitoring: the clock is re-read when the data changes — a long-open tab flips to paused on revalidation', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    try {
      const data = makeData();
      render(<TrustCenterPage initialData={data} />);
      expect(screen.getByText(/^Controls continuously monitored/)).toBeInTheDocument();

      // Hours later the tab is refocused; the revalidated copy carries the SAME (now stale) syncedAt.
      vi.setSystemTime(Date.now() + WINDOW_MS + 60 * 60 * 1000);
      fetchMock.mockResolvedValueOnce(jsonResponse(data));
      Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
      fireEvent(document, new Event('visibilitychange'));

      await screen.findByText(/^Monitoring paused/);
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(screen.queryByText(/continuously monitored/)).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it('monitoring: a tab left open with NO revalidation still flips to paused as the clock passes the window', async () => {
    vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval'] });
    try {
      render(<TrustCenterPage initialData={makeData()} />);
      expect(screen.getByText(/^Controls continuously monitored/)).toBeInTheDocument();
      await act(() => vi.advanceTimersByTimeAsync(WINDOW_MS + 60 * 1000));
      expect(screen.getByText(/^Monitoring paused/)).toBeInTheDocument();
      expect(fetchMock).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it('controls search: a match only in the description is highlighted in the description', async () => {
    const data = makeData();
    data.controlDomains[0].controls[0] = {
      id: 'c1',
      name: 'Access reviewed',
      description: 'Quarterly attestation by owners',
    };
    serveControlsSearch(data);
    render(<TrustCenterPage initialData={data} />);
    typeSearch('attest');
    expect(await screen.findByText('attest', { selector: 'strong' })).toBeInTheDocument();
  });

  it('controls drawer reads the CURRENT domains: a revalidation while open shows the new controls', async () => {
    const { rerender } = render(<TrustCenterPage initialData={makeData()} />);
    fireEvent.click(screen.getByRole('button', { name: 'View all 4 Infrastructure security controls' }));
    let drawer = await screen.findByRole('dialog');
    expect(within(drawer).queryByText('Backups tested')).toBeNull();

    const fresh = makeData();
    fresh.controlDomains[0].controls.push({ id: 'c6', name: 'Backups tested', description: null });
    rerender(<TrustCenterPage initialData={fresh} />);
    drawer = await screen.findByRole('dialog');
    expect(within(drawer).getByText('Backups tested')).toBeInTheDocument();
  });

  it('controls search highlights on the ORIGINAL text, even after a character whose lowercase is longer', async () => {
    const data = makeData();
    data.controlDomains[0].controls[3] = { id: 'c5', name: 'İİ Logging enabled', description: null };
    serveControlsSearch(data);
    render(<TrustCenterPage initialData={data} />);
    typeSearch('log');
    expect(await screen.findByText('Log', { selector: 'strong' })).toBeInTheDocument();
  });

  it('controls search is asked of the SERVER, debounced: one request for the settled query, never a client filter', async () => {
    const data = makeData();
    const asked = serveControlsSearch(data);
    render(<TrustCenterPage initialData={data} />);
    typeSearch('l');
    typeSearch('lo');
    typeSearch('log');
    // Before the answer arrives nothing is filtered in the browser: the list is loading, the grid is gone.
    expect(screen.queryByText(/controls match/)).toBeNull();
    expect(await screen.findByText(/1 of 5 controls match/)).toBeInTheDocument();
    expect(asked).toEqual(['log']);
    expect(String(fetchMock.mock.calls[0][0])).toBe(trustCenterSearchUrl(TRUST_CENTER_API_PATH, 'log'));
  });

  it('controls search: a failed search offers a retry, and the retry asks the server again', async () => {
    const data = makeData();
    fetchMock.mockResolvedValueOnce(jsonResponse({ error: 'down' }, 500));
    render(<TrustCenterPage initialData={data} />);
    typeSearch('log');
    expect(await screen.findByText('Could not search the controls')).toBeInTheDocument();
    serveControlsSearch(data);
    fireEvent.click(screen.getByRole('button', { name: /try again|retry/i }));
    expect(await screen.findByText(/1 of 5 controls match/)).toBeInTheDocument();
  });
});

describe('TrustCenterPage — reuse-only source check', () => {
  // Static on purpose: the rendered DOM legitimately contains these tags via
  // Button / DataTable / Modal. The PAGE sources must only reach them through
  // lib components (mirrors the hub's raw-html-elements rule).
  const FILES = ['trust-center-page.tsx', 'trust-center-sections.tsx'];
  const FORBIDDEN = [/<button[\s>]/, /<a\s/, /<table[\s>]/, /<time[\s>]/, /<input[\s>]/];

  it.each(FILES)('%s has no intrinsic <button>/<a>/<table>/<time>/<input>', file => {
    const source = readFileSync(path.resolve(__dirname, '..', file), 'utf8');
    for (const pattern of FORBIDDEN) {
      expect(source).not.toMatch(pattern);
    }
  });
});

describe('highlight', () => {
  /** The emphasised part of `highlight(text, query)`, or null when nothing matched. */
  function strongOf(text: string, query: string): string | null {
    render(<p>{highlight(text, query)}</p>);
    return screen.queryByText(/.+/, { selector: 'strong' })?.textContent ?? null;
  }

  it('matches regex metacharacters literally', () => {
    expect(strongOf('Copyright (c) notices', '(c)')).toBe('(c)');
  });

  it('is case-insensitive on metacharacter queries', () => {
    expect(strongOf('Tier a+b storage', 'A+B')).toBe('a+b');
  });

  it('never treats the query as a pattern', () => {
    expect(strongOf('No match here', '.*')).toBeNull();
  });

  it('keeps the match aligned after characters whose lowercase changes length', () => {
    expect(strongOf('İİ audit logging', 'LOG')).toBe('log');
  });

  it('matches a character whose lowercase changes length', () => {
    expect(strongOf('İstanbul office', 'İ')).toBe('İ');
  });

  it('returns the plain text for an empty query', () => {
    expect(strongOf('Encryption at rest', '   ')).toBeNull();
  });
});

describe('trustCenterSearchUrl', () => {
  it('adds q to a bare endpoint and to one that already carries a query string', () => {
    expect(trustCenterSearchUrl('/api/trust-center', '  a+b ')).toBe('/api/trust-center?q=a%2Bb');
    expect(trustCenterSearchUrl('/content/api/trust-center?x=1', 'log')).toBe('/content/api/trust-center?x=1&q=log');
  });
});

describe('filterTrustControlDomains (the server-side filter)', () => {
  const domains = makeTrustCenterData().controlDomains;

  it('matches metacharacters literally and case-insensitively, exactly what highlight emphasises', () => {
    const withMeta = [{ ...domains[0], controls: [{ id: 'm', name: 'Tier a+b storage', description: null }] }];
    expect(filterTrustControlDomains(withMeta, 'A+B')).toHaveLength(1);
    expect(filterTrustControlDomains(withMeta, '.*')).toHaveLength(0);
  });

  it('a whitespace-only query keeps every domain', () => {
    expect(filterTrustControlDomains(domains, '   ')).toEqual(domains);
  });
});
