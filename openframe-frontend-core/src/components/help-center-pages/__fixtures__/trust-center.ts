/**
 * THE trust-center fixture for tests and stories (`trust-center-page.test.tsx`,
 * `chat-card-label.test.tsx`, `TrustCenterPage.stories.tsx`). Not part of any
 * barrel and excluded from the declaration build (`tsconfig.declarations.json`),
 * so it never ships in `dist/`.
 *
 * Instants are computed when the builder is CALLED, so a fresh copy is always
 * inside its monitoring window ("monitored") unless an override says otherwise.
 */
import type { Faq } from '../../../types/faq';
import type { TrustCenterPublic } from '../../../types/trust-center';

export const TRUST_CENTER_FIXTURE_WINDOW_MS = 2 * 60 * 60 * 1000;

/** One well-formed FAQ row (the `faqs` default is empty so the FAQ section is hidden). */
export const TRUST_CENTER_FIXTURE_FAQ: Faq = {
  id: 1,
  question: 'Is the platform SOC 2 certified?',
  answer: 'Our SOC 2 Type II audit is in progress.',
  section: 'Security',
  display_order: 1,
  is_active: true,
  created_at: '2026-09-01T00:00:00Z',
  updated_at: '2026-09-01T00:00:00Z',
};

export function makeTrustCenterData(overrides: Partial<TrustCenterPublic> = {}): TrustCenterPublic {
  const now = Date.now();
  return {
    frameworks: [
      { id: 'fw-soc2', label: 'SOC 2 Type II', description: 'Type II audit in progress', monitoring: 'monitored' },
      { id: 'fw-iso27001', label: 'ISO 27001', description: null, monitoring: 'not_monitored' },
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
      { id: 'res-soc2', title: 'SOC 2 report', description: 'Audit report', access: 'request', externalUrl: null },
      {
        id: 'privacy-policy',
        title: 'Privacy policy',
        description: null,
        access: 'public',
        externalUrl: 'https://www.example.com/privacy',
      },
      {
        id: 'res-pentest',
        title: 'Penetration test summary',
        description: 'Latest external test',
        access: 'public',
        externalUrl: null,
      },
    ],
    subprocessors: [
      { name: 'Google Cloud', purpose: 'Hosting', description: null, location: 'US', url: null, logoUrl: null },
    ],
    aiPractices: [
      {
        label: 'Is customer data used to train AI models?',
        value: 'No. We never use customer data to train AI models.',
        commitment: true,
      },
      { label: 'Which AI model providers do you use?', value: 'Anthropic (Claude)' },
    ],
    faqs: [],
    checkedAt: new Date(now - 5 * 60 * 1000).toISOString(),
    syncedAt: new Date(now - 10 * 60 * 1000).toISOString(),
    monitoredWindowMs: TRUST_CENTER_FIXTURE_WINDOW_MS,
    connected: true,
    dataSource: { name: 'Vanta', logoUrl: 'https://icons.example/vanta.com.png' },
    ...overrides,
  };
}
