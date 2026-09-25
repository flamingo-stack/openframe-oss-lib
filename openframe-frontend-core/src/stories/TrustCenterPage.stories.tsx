import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { TrustCenterPage } from '../components/help-center-pages/trust-center-page';
import type { TrustCenterPublic } from '../types/trust-center';

// Stories pass `initialData`, so the page never fetches. Instants are computed
// at module load so the "monitored" story stays inside its window.
const NOW = Date.now();
const HOUR = 60 * 60 * 1000;

const BASE: TrustCenterPublic = {
  frameworks: [
    { id: 'soc2', label: 'SOC 2 Type II', status: 'in_progress' },
    { id: 'iso27001', label: 'ISO 27001', status: 'planned' },
    { id: 'iso42001', label: 'ISO 42001', status: 'planned' },
  ],
  controlDomains: [
    {
      domain: 'Infrastructure security',
      controls: [
        { id: 'c1', name: 'Encryption at rest', description: 'Production data stores are encrypted at rest.' },
        { id: 'c2', name: 'MFA on infrastructure', description: 'Infrastructure access requires MFA.' },
      ],
    },
    {
      domain: 'Identification & authentication',
      controls: [{ id: 'c3', name: 'Unique accounts', description: 'Every person uses a unique account.' }],
    },
  ],
  policies: [],
  documents: [
    { title: 'SOC 2 Type II report', kind: 'Audit report', access: 'request' },
    { title: 'Privacy policy', kind: 'Policy', access: 'public', url: '/privacy-policy' },
    { title: 'Terms of service', kind: 'Policy', access: 'public', url: '/terms-of-service' },
  ],
  subprocessors: [
    { name: 'Google Cloud', purpose: 'Hosting', location: 'US', category: 'Infrastructure' },
    { name: 'Anthropic', purpose: 'AI model provider', location: 'US', category: 'AI' },
  ],
  aiPractices: [
    { label: 'Training', value: 'Customer data is never used to train models' },
    { label: 'Providers', value: 'Anthropic, OpenAI' },
    { label: 'Retention', value: 'Prompts are not retained by providers beyond 30 days' },
    { label: 'Governance', value: 'ISO 42001 planned' },
  ],
  faqs: [
    {
      id: 1,
      question: 'Is Flamingo SOC 2 certified?',
      answer: 'Our SOC 2 Type II audit is in progress.',
      section: 'Security',
      display_order: 1,
      is_active: true,
      created_at: '2026-09-01T00:00:00Z',
      updated_at: '2026-09-01T00:00:00Z',
    },
  ],
  contact: {
    securityEmail: 'security@example.com',
    disclosureUrl: 'https://example.com/security',
    statusPageUrl: 'https://status.example.com',
  },
  checkedAt: new Date(NOW - 0.25 * HOUR).toISOString(),
  syncedAt: new Date(NOW - 0.5 * HOUR).toISOString(),
  monitoredWindowMs: 2 * HOUR,
  connected: true,
};

const meta = {
  title: 'Features/TrustCenterPage',
  component: TrustCenterPage,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'Full public trust center page, composed only from existing lib components. Data comes from `useSelfFetch(endpoint)` or `initialData`; "monitored" is derived client-side from `syncedAt` + `monitoredWindowMs`.',
      },
    },
  },
  args: { initialData: BASE, backButton: false },
} satisfies Meta<typeof TrustCenterPage>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Vanta connected and synced inside the window: "Continuously monitored". */
export const Monitored: Story = {};

/** Vanta not connected: config-only projection — no controls, monitoring paused. */
export const NotConnected: Story = {
  args: {
    initialData: {
      ...BASE,
      controlDomains: [],
      checkedAt: null,
      syncedAt: null,
      connected: false,
    },
  },
};

/** Certified framework with a published percent (progress ring + report period). */
export const CertifiedWithPercent: Story = {
  args: {
    initialData: {
      ...BASE,
      frameworks: [
        { id: 'soc2', label: 'SOC 2 Type II', status: 'certified', percent: 98, reportPeriod: 'Jan–Jun 2026' },
        { id: 'iso27001', label: 'ISO 27001', status: 'in_audit' },
        { id: 'iso42001', label: 'ISO 42001', status: 'planned' },
      ],
      policies: ['Information Security Policy', 'Acceptable Use Policy'],
    },
  },
};
