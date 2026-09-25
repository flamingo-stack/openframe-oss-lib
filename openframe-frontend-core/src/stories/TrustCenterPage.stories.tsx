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
    {
      id: 'fw-soc2',
      label: 'SOC 2 Type II',
      description: 'Type II audit in progress',
      monitoring: 'monitored',
      percent: 16,
    },
    { id: 'fw-iso27001', label: 'ISO 27001', description: null, monitoring: 'not_monitored' },
    { id: 'fw-iso42001', label: 'ISO 42001', description: 'AI management system', monitoring: 'not_monitored' },
  ],
  documents: [
    {
      id: 'res-soc2',
      title: 'SOC 2 Type II report',
      description: 'Audit report',
      access: 'request',
      externalUrl: null,
    },
    {
      id: 'privacy-policy',
      title: 'Privacy policy',
      description: null,
      access: 'public',
      externalUrl: 'https://www.example.com/privacy',
    },
  ],
  subprocessors: [
    { name: 'Google Cloud', purpose: 'Hosting', description: null, location: 'US', url: null, logoUrl: null },
    { name: 'Anthropic', purpose: 'AI model provider', description: null, location: 'US', url: null, logoUrl: null },
  ],
  aiPractices: [
    {
      label: 'Is customer data used to train AI models?',
      value: 'No. We never use customer data to train AI models.',
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
        {
          id: 'fw-soc2',
          label: 'SOC 2 Type II',
          description: 'Type II report available',
          monitoring: 'monitored',
          percent: 98,
        },
        { id: 'fw-iso27001', label: 'ISO 27001', description: null, monitoring: 'monitored', percent: 64 },
        { id: 'fw-iso42001', label: 'ISO 42001', description: null, monitoring: 'not_monitored' },
      ],
      policies: ['Information Security Policy', 'Acceptable Use Policy'],
    },
  },
};
