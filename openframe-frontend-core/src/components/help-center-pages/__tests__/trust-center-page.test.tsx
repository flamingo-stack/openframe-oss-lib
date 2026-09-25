import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setMockSearchParams } from '../../../../vitest.setup';
import {
  TRUST_DOCUMENT_REQUEST_PREFIX,
  trustDocumentContactReason,
  type TrustCenterPublic,
} from '../../../types/trust-center';
import { TrustCenterPage } from '../trust-center-page';

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
          { id: 'c4', name: 'Firewalls configured', description: 'Network firewalls filter traffic.' },
          { id: 'c5', name: 'Logging enabled', description: 'Production logs are retained.' },
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
    aiPractices: [
      {
        label: 'Customer data and model training',
        value: 'We never use customer data to train AI models',
        commitment: true,
      },
      { label: 'Model providers', value: 'Anthropic (Claude)' },
    ],
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

  it('compliance: the status is shown ONCE, planned frameworks are one roadmap line, percent only when published', () => {
    const { rerender } = render(<TrustCenterPage initialData={makeData()} />);
    expect(screen.getAllByText('In progress')).toHaveLength(1);
    expect(screen.getByText('On our roadmap:')).toBeInTheDocument();
    expect(screen.getByText('ISO 27001')).toBeInTheDocument();
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
    expect(screen.queryByText('On our roadmap:')).toBeNull();
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

  it('controls search: ONE flat grouped list with every match visible, a count, and clearing restores the grid', () => {
    render(<TrustCenterPage initialData={makeData()} />);
    const search = screen.getByPlaceholderText('Search controls');

    fireEvent.change(search, { target: { value: 'log' } });
    // A match beyond the card's first 3 is shown directly — nothing to expand.
    expect(screen.getByText(/1 of 5 controls match/)).toBeInTheDocument();
    // The match is highlighted in its own <strong>; the rest of the name follows it.
    expect(screen.getByText('Log', { selector: 'strong' })).toBeInTheDocument();
    expect(screen.getByText('ging enabled', { exact: false })).toBeInTheDocument();
    expect(screen.queryByText('Encryption at rest')).toBeNull();
    expect(screen.queryByRole('button', { name: /View all/ })).toBeNull();

    fireEvent.change(search, { target: { value: 'every user' } });
    expect(screen.getByText(/1 of 5 controls match/)).toBeInTheDocument();
    expect(screen.getByText('Unique accounts')).toBeInTheDocument();

    fireEvent.change(search, { target: { value: 'zzz-nothing' } });
    expect(screen.getByText('No matching controls')).toBeInTheDocument();
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
          contact: { securityEmail: 'security@example.com' },
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
