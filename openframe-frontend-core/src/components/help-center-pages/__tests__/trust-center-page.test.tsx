import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mockReplace, setMockSearchParams } from '../../../../vitest.setup';
import { trustDocumentContactReason, type TrustCenterPublic } from '../../../types/trust-center';
import { TrustCenterPage } from '../trust-center-page';

// The real ContactForm needs the endpoints + chat runtimes; the page only
// decides WHAT it is handed, so a stub that echoes its props is the honest
// seam for "the modal pre-fills the reason and stays on the page".
vi.mock('../../contact/contact-form', () => ({
  ContactForm: (props: {
    prefilledReason?: string;
    helpCategoryOptions?: readonly string[];
    successRedirectUrl?: string;
    onSubmitSuccess?: () => void;
  }) => (
    <div data-testid="contact-form">
      <span data-testid="reason">{props.prefilledReason}</span>
      <span data-testid="options">{(props.helpCategoryOptions ?? []).join('|')}</span>
      <span data-testid="redirect">{JSON.stringify(props.successRedirectUrl)}</span>
      <button type="button" onClick={props.onSubmitSuccess}>
        stub-submit
      </button>
    </div>
  ),
}));

const WINDOW_MS = 2 * 60 * 60 * 1000;

function makeData(overrides: Partial<TrustCenterPublic> = {}): TrustCenterPublic {
  return {
    frameworks: [
      { id: 'soc2', label: 'SOC 2 Type II', status: 'in_progress' },
      { id: 'iso27001', label: 'ISO 27001', status: 'planned' },
    ],
    controlDomains: [
      {
        domain: 'Infrastructure security',
        controls: [
          { id: 'c1', name: 'Encryption at rest', description: 'Data stores are encrypted.' },
          { id: 'c2', name: 'MFA on infrastructure', description: null },
        ],
      },
      {
        domain: 'Identification & authentication',
        controls: [{ id: 'c3', name: 'Unique accounts', description: 'Every user has an account.' }],
      },
    ],
    policies: [],
    documents: [
      { title: 'SOC 2 report', kind: 'Audit report', access: 'request' },
      { title: 'Privacy policy', kind: 'Policy', access: 'public', url: '/privacy-policy' },
    ],
    subprocessors: [{ name: 'Google Cloud', purpose: 'Hosting', location: 'US', category: 'Infrastructure' }],
    aiPractices: [{ label: 'Training', value: 'No training on customer data' }],
    faqs: [],
    contact: { securityEmail: 'security@example.com', statusPageUrl: 'https://status.example.com' },
    checkedAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
    syncedAt: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
    monitoredWindowMs: WINDOW_MS,
    connected: true,
    ...overrides,
  };
}

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

describe('TrustCenterPage', () => {
  it('does not fetch when initialData is given', () => {
    render(<TrustCenterPage initialData={makeData()} />);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.getAllByText('SOC 2 Type II').length).toBeGreaterThan(0);
  });

  it('fetches the configured endpoint when no initialData is given', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(makeData()));
    render(<TrustCenterPage endpoint="/content/api/trust-center" />);
    await screen.findByText('SOC 2 Type II');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0][0])).toBe('/content/api/trust-center');
  });

  it('shows the progress/percent only when percent is published', () => {
    const { rerender } = render(<TrustCenterPage initialData={makeData()} />);
    // No percent → no "(NN%)" (DashboardInfoCard renders the ring only with it).
    expect(screen.queryByText(/\(\d+%\)/)).toBeNull();

    rerender(
      <TrustCenterPage
        initialData={makeData({
          frameworks: [
            { id: 'soc2', label: 'SOC 2 Type II', status: 'certified', percent: 97, reportPeriod: 'Jan–Jun 2026' },
          ],
        })}
      />,
    );
    expect(screen.getByText('(97%)')).toBeInTheDocument();
    expect(screen.getByText('Jan–Jun 2026')).toBeInTheDocument();
  });

  it('hides empty sections (tabs, footer status card, request CTA)', () => {
    render(
      <TrustCenterPage
        initialData={makeData({
          controlDomains: [],
          documents: [],
          subprocessors: [],
          aiPractices: [],
          faqs: [],
          contact: { securityEmail: 'security@example.com' },
        })}
      />,
    );
    expect(screen.getByRole('button', { name: 'Overview' })).toBeInTheDocument();
    for (const label of ['Controls', 'Documents', 'Subprocessors', 'AI', 'FAQ']) {
      expect(screen.queryByRole('button', { name: label })).toBeNull();
    }
    expect(screen.queryByRole('button', { name: 'Request documents' })).toBeNull();
    expect(screen.queryByText('System status')).toBeNull();
    expect(screen.queryByText('Approved policies')).toBeNull();
  });

  it('shows approved policies on the overview only when present', () => {
    render(<TrustCenterPage initialData={makeData({ policies: ['Information Security Policy'] })} />);
    expect(screen.getByText('Approved policies')).toBeInTheDocument();
    expect(screen.getByText('Information Security Policy')).toBeInTheDocument();
  });

  it('filters the controls by the search query and shows an empty state on no match', () => {
    setMockSearchParams(new URLSearchParams('tab=controls'));
    render(<TrustCenterPage initialData={makeData()} />);
    const search = screen.getByPlaceholderText('Search controls');

    fireEvent.change(search, { target: { value: 'encrypt' } });
    expect(screen.getByText('Encryption at rest')).toBeInTheDocument();
    expect(screen.queryByText('Unique accounts')).toBeNull();
    expect(screen.queryByText('Identification & authentication (1)')).toBeNull();

    fireEvent.change(search, { target: { value: 'every user' } });
    expect(screen.getByText('Unique accounts')).toBeInTheDocument();
    expect(screen.queryByText('Encryption at rest')).toBeNull();

    fireEvent.change(search, { target: { value: 'zzz-nothing' } });
    expect(screen.getByText('No matching controls')).toBeInTheDocument();
  });

  it('"Request documents" moves the URL to the documents tab', () => {
    render(<TrustCenterPage initialData={makeData()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Request documents' }));
    expect(mockReplace).toHaveBeenCalledWith('/?tab=documents', { scroll: false });
  });

  it('the request modal pre-fills the contact reason and stays on the page', async () => {
    setMockSearchParams(new URLSearchParams('tab=documents'));
    render(<TrustCenterPage initialData={makeData()} />);
    expect(screen.getByText('Public')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Request access' }));
    const dialog = await screen.findByRole('dialog');
    const reason = trustDocumentContactReason('SOC 2 report');
    expect(within(dialog).getByTestId('reason')).toHaveTextContent(reason);
    expect(within(dialog).getByTestId('options')).toHaveTextContent(reason);
    expect(within(dialog).getByTestId('redirect')).toHaveTextContent('""');

    fireEvent.click(within(dialog).getByText('stub-submit'));
    await waitFor(() => expect(screen.queryByTestId('contact-form')).toBeNull());
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

  it('"monitored" flips when syncedAt is older than monitoredWindowMs', () => {
    const { unmount } = render(<TrustCenterPage initialData={makeData()} />);
    expect(screen.getByText(/^Continuously monitored · last checked/)).toBeInTheDocument();
    unmount();

    render(
      <TrustCenterPage initialData={makeData({ syncedAt: new Date(Date.now() - WINDOW_MS - 60_000).toISOString() })} />,
    );
    expect(screen.getByText('Monitoring paused')).toBeInTheDocument();
    expect(screen.queryByText(/Continuously monitored/)).toBeNull();
  });

  it('is never "monitored" when Vanta is not connected', () => {
    render(<TrustCenterPage initialData={makeData({ connected: false, syncedAt: null })} />);
    expect(screen.getByText('Monitoring paused')).toBeInTheDocument();
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
