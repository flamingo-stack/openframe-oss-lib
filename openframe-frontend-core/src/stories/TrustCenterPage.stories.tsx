import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import {
  TRUST_CENTER_FIXTURE_FAQ,
  makeTrustCenterData,
} from '../components/help-center-pages/__fixtures__/trust-center';
import { TrustCenterPage } from '../components/help-center-pages/trust-center-page';

// Stories pass `initialData`, so the page never fetches. The shared fixture
// computes its instants when called, so the "monitored" story stays inside its window.
const BASE = makeTrustCenterData({
  frameworks: [
    { id: 'soc2', label: 'SOC 2 Type II', status: 'in_progress' },
    { id: 'iso27001', label: 'ISO 27001', status: 'planned' },
    { id: 'iso42001', label: 'ISO 42001', status: 'planned' },
  ],
  documents: [
    { title: 'SOC 2 Type II report', kind: 'Audit report', access: 'request' },
    { title: 'Privacy policy', kind: 'Policy', access: 'public', url: '/privacy-policy', legalDocType: 'privacy' },
    { title: 'Terms of service', kind: 'Policy', access: 'public', url: '/terms-of-service', legalDocType: 'terms' },
  ],
  subprocessors: [
    { name: 'Google Cloud', purpose: 'Hosting', location: 'US', category: 'Infrastructure' },
    { name: 'Anthropic', purpose: 'AI model provider', location: 'US', category: 'AI' },
  ],
  aiPractices: [
    {
      label: 'Customer data and model training',
      value: 'We never use customer data to train AI models',
      commitment: true,
    },
    { label: 'Providers', value: 'Anthropic, OpenAI' },
    { label: 'Retention', value: 'Prompts are not retained by providers beyond 30 days' },
    { label: 'Governance', value: 'ISO 42001 planned' },
  ],
  faqs: [TRUST_CENTER_FIXTURE_FAQ],
});

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
