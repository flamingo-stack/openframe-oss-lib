import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import type { ReactNode } from 'react'
import { MspOrganizationCard } from '../components/chat/msp-organization-card'
import { MspOrganizationCardSkeleton } from '../components/chat/msp-organization-card-skeleton'

/**
 * MSP Organization card for the AI Assistant welcome screen.
 *
 * Shows which organization the user is signing into — square logo,
 * "Your IT is managed by {name}" with the website beneath, and a trailing
 * external-link button. Mirrors Figma `openframe — fae-chat` (node 1:5540).
 */
const meta: Meta<typeof MspOrganizationCard> = {
  title: 'Chat/AI Assistant Welcome Screen/MSP Organization',
  component: MspOrganizationCard,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'Welcome-screen card confirming the active MSP/organization. The trailing button renders only when `href` (anchor, new tab) or `onOpenWebsite` (callback) is provided.',
      },
    },
  },
  decorators: [
    // The card itself is width-unconstrained (fills its parent). This 600px
    // wrapper mirrors the Figma welcome-screen container (node 1:5540 = 600×80).
    (Story: () => ReactNode) => (
      <div style={{ width: 600, maxWidth: '100%' }}>
        <Story />
      </div>
    ),
  ],
  args: {
    name: 'TechFlow Solutions',
    website: 'www.techflow.com',
    href: 'https://www.techflow.com',
  },
}

export default meta

type Story = StoryObj<typeof MspOrganizationCard>

/** Default — logo image, website, and a link-out anchor (opens in a new tab). */
export const Default: Story = {
  args: {
    logoUrl:
      'data:image/svg+xml;utf8,' +
      encodeURIComponent(
        '<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48"><rect width="48" height="48" fill="%231d4ed8"/><circle cx="24" cy="24" r="12" fill="%2360a5fa"/></svg>',
      ),
  },
}

/** No logo — falls back to initials derived from `name`. */
export const NoLogo: Story = {}

/** Callback variant — the button fires `onOpenWebsite` instead of navigating. */
export const WithCallback: Story = {
  args: {
    href: undefined,
    onOpenWebsite: () => alert('Open organization website'),
  },
}

/** No action — omit both `href` and `onOpenWebsite` to hide the trailing button. */
export const WithoutAction: Story = {
  args: {
    href: undefined,
    onOpenWebsite: undefined,
  },
}

/** Long values truncate to a single line each. */
export const LongValues: Story = {
  args: {
    name: 'Global Managed Services & Infrastructure Partners International',
    website: 'www.global-managed-services-and-infrastructure-partners.example.com',
  },
}

/** Loading — skeleton placeholder shown while the tenant info loads, then
 *  replaced by the card. Mirrors the card's blocks at the same 80px height. */
export const Loading: Story = {
  render: () => <MspOrganizationCardSkeleton />,
}
