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

  it('AI statements: each Vanta FAQ as question over answer, the first marked as the commitment', () => {
    render(<TrustCenterPage initialData={makeData()} />);
    const ai = within(screen.getByRole('region', { name: 'AI & data use' }));
    expect(ai.getByText('Is customer data used to train AI models?')).toBeInTheDocument();
    expect(ai.getByText('No. We never use customer data to train AI models.')).toBeInTheDocument();
    expect(ai.getAllByRole('img', { name: 'Commitment' })).toHaveLength(1);
    expect(ai.getByText('Which AI model providers do you use?')).toBeInTheDocument();
  });

  it('no AI statements from Vanta → no AI section at all', () => {
    render(<TrustCenterPage initialData={makeData({ aiPractices: [] })} />);
    expect(screen.queryByRole('region', { name: 'AI & data use' })).toBeNull();
  });

  it("compliance: one row per Vanta framework with its description and Vanta's completion percentage — never a certification claim", () => {
    render(<TrustCenterPage initialData={makeData()} />);
    const compliance = within(screen.getByRole('region', { name: 'Compliance' }));
    expect(compliance.getByText('SOC 2 Type II')).toBeInTheDocument();
    expect(compliance.getByText('Type II audit in progress')).toBeInTheDocument();
    expect(compliance.getByText('16% complete')).toBeInTheDocument();
    // Each framework's logo comes from its standard (`soc2` → the SOC 2 badge); an unknown one keeps the shield.
    expect(compliance.getByRole('img', { name: 'AICPA SOC 2' })).toBeInTheDocument();
    expect(compliance.getByRole('img', { name: 'ISO 27001' })).toBeInTheDocument();
    expect(compliance.getByText('Not monitored yet')).toBeInTheDocument();
    expect(compliance.queryByText(/Certified/)).toBeNull();
  });

  it('questions go through the request form: no security address, no vulnerability or disclosure wording', async () => {
    render(<TrustCenterPage initialData={makeData()} />);
    expect(screen.queryByText(/vulnerab|disclosure|bug bounty|@/i)).toBeNull();
    expect(screen.queryAllByRole('link').filter(link => link.getAttribute('href')?.startsWith('mailto:'))).toEqual([]);
    fireEvent.click(screen.getByRole('button', { name: 'Get in touch' }));
    expect(await screen.findByTestId('contact-form')).toBeInTheDocument();
  });

  it('controls browse: EVERY control of every category is shown, always — no "View all", no drawer', () => {
    render(<TrustCenterPage initialData={makeData()} />);
    expect(screen.getByText('Encryption at rest')).toBeInTheDocument();
    // The 4th control of a category is on the page from the start.
    expect(screen.getByText('Logging enabled')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /View all/ })).toBeNull();
    expect(screen.queryByRole('dialog')).toBeNull();
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

    typeSearch('every user');
    expect(await screen.findByText('Unique accounts')).toBeInTheDocument();
    expect(screen.getByText(/1 of 5 controls match/)).toBeInTheDocument();

    typeSearch('zzz-nothing');
    expect(await screen.findByText('No matching controls')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Show all controls' }));
    expect(screen.getByText('Encryption at rest')).toBeInTheDocument();
    expect(screen.getByText('Logging enabled')).toBeInTheDocument();
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

  it('public documents open in a new tab (a Vanta file or an outside link), without leaving the trust center', () => {
    render(<TrustCenterPage initialData={makeData()} />);
    expect(screen.getByRole('link', { name: 'View Privacy policy' })).toHaveAttribute('target', '_blank');
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
    expect(screen.getByText('Controls continuously monitored')).toBeInTheDocument();
    // WHEN it was synced is the shared attribution line, not the status.
    expect(screen.getByText('Data synced from Vanta')).toBeInTheDocument();
    // The synced-from logo is the site icon the hub names — the llama, like the subprocessor list.
    expect(screen.getByRole('img', { name: 'Vanta' })).toHaveAttribute('src', 'https://icons.example/vanta.com.png');
    expect(screen.getByText(/^Last updated: /)).toBeInTheDocument();
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
    expect(screen.queryByText('Data synced from Vanta')).toBeNull();
  });
  it('defaults to the brand-neutral title + tagline (a host adds its brand via props)', () => {
    render(<TrustCenterPage initialData={makeData()} />);
    expect(screen.getByRole('heading', { level: 1, name: TRUST_CENTER_TITLE })).toBeInTheDocument();
    expect(screen.getAllByText(TRUST_CENTER_TAGLINE).length).toBeGreaterThan(0);
    expect(screen.queryByText(/Flamingo/)).toBeNull();
  });

  it('documents: a Vanta link opens itself, a public Vanta file opens through the hub beside the endpoint, a gated one is requested', () => {
    render(<TrustCenterPage initialData={makeData()} endpoint="/content/api/trust-center" />);
    const documents = within(screen.getByRole('region', { name: 'Documents' }));
    expect(documents.getByRole('link', { name: 'View Privacy policy' })).toHaveAttribute(
      'href',
      'https://www.example.com/privacy',
    );
    expect(documents.getByRole('link', { name: 'View Penetration test summary' })).toHaveAttribute(
      'href',
      '/content/api/trust-center/documents/res-pentest',
    );
    expect(documents.getByRole('button', { name: 'Request SOC 2 report' })).toBeInTheDocument();
    expect(documents.getByText('Latest external test')).toBeInTheDocument();
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

  it('controls: category tabs with counts; a tab shows only its category', () => {
    render(<TrustCenterPage initialData={makeData()} />);
    expect(screen.getByRole('button', { name: 'All · 5' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Identification & authentication · 1' }));
    expect(screen.getByText('Unique accounts')).toBeInTheDocument();
    expect(screen.queryByText('Encryption at rest')).toBeNull();
  });

  it('controls: searching keeps ONE fixed-height list box — skeleton rows while the answer is on its way, then the matches, with server counts on the tabs', async () => {
    const data = makeData();
    serveControlsSearch(data);
    render(<TrustCenterPage initialData={data} />);
    const box = () => screen.getByTestId('controls-list');
    const height = box().className;
    typeSearch('log');
    expect(screen.getByText(/Searching for “log”/)).toBeInTheDocument();
    expect(box().className).toBe(height);
    expect(await screen.findByText(/1 of 5 controls match/)).toBeInTheDocument();
    expect(box().className).toBe(height);
    expect(screen.getByRole('button', { name: 'All · 1' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Identification & authentication · 0' })).toBeInTheDocument();
  });

  it('subprocessors: a brand logo from the name, and the country with its flag', () => {
    render(
      <TrustCenterPage
        initialData={makeData({
          subprocessors: [
            {
              name: 'Google Cloud Platform',
              purpose: 'Hosting',
              description: null,
              location: 'United States',
              url: null,
              logoUrl: null,
            },
            {
              name: 'Acme Analytics',
              purpose: 'Analytics',
              description: null,
              location: 'Atlantis',
              url: null,
              logoUrl: null,
            },
          ],
        })}
      />,
    );
    const subprocessors = within(screen.getByRole('region', { name: 'Subprocessors' }));
    expect(subprocessors.getByRole('img', { name: 'Google Cloud Platform' })).toBeInTheDocument();
    expect(subprocessors.getByText('🇺🇸 United States')).toBeInTheDocument();
    // No brand mark and no known country: initials and the plain name.
    expect(subprocessors.getByText('Atlantis')).toBeInTheDocument();
  });

  it('subprocessors: the site icon from the website Vanta holds comes first, before any guess from the name', () => {
    render(
      <TrustCenterPage
        initialData={makeData({
          subprocessors: [
            {
              name: 'Google Cloud Platform',
              purpose: 'Cloud provider',
              description: null,
              location: null,
              url: 'https://cloud.google.com',
              logoUrl: 'https://icons.example/cloud.google.com.png',
            },
          ],
        })}
      />,
    );
    const subprocessors = within(screen.getByRole('region', { name: 'Subprocessors' }));
    expect(subprocessors.getByRole('img', { name: 'Google Cloud Platform' })).toHaveAttribute(
      'src',
      'https://icons.example/cloud.google.com.png',
    );
  });

  it('subprocessors: no location column when Vanta holds no location for any of them', () => {
    render(
      <TrustCenterPage
        initialData={makeData({
          subprocessors: [
            {
              name: 'Vanta',
              purpose: 'Security',
              description: null,
              location: null,
              url: 'https://vanta.com',
              logoUrl: null,
            },
          ],
        })}
      />,
    );
    const subprocessors = within(screen.getByRole('region', { name: 'Subprocessors' }));
    expect(subprocessors.getByText('Vanta')).toBeInTheDocument();
    expect(subprocessors.queryByText('Location')).toBeNull();
  });

  it('controls follow the CURRENT data: a revalidated copy shows its new controls', () => {
    const { rerender } = render(<TrustCenterPage initialData={makeData()} />);
    expect(screen.queryByText('Backups tested')).toBeNull();
    const fresh = makeData();
    fresh.controlDomains[0].controls.push({ id: 'c6', name: 'Backups tested', description: null });
    rerender(<TrustCenterPage initialData={fresh} />);
    expect(screen.getByText('Backups tested')).toBeInTheDocument();
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
