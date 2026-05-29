import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { HubspotTicketCard } from '../components/chat/entity-cards'
import {
  ChatColumnDecorator,
  makeAnchorProps,
} from './__fixtures__/chat-card-decorator'
import { hubspotTicketItem } from './__fixtures__/chat-cards'

const meta: Meta<typeof HubspotTicketCard> = {
  title: 'Chat/EntityCards/HubspotTicketCard',
  component: HubspotTicketCard,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'Inline card rendered in chat for `hubspot_ticket`, `hubspot_ticket_anon` and `hubspot_ticket_self` doc types. The same component handles all three — the server-side mapper redacts `customerCompany` (anon) and `url` (anon + self) before sending. Status/priority badges drive the visual.',
      },
    },
  },
  decorators: [(Story) => <ChatColumnDecorator><Story /></ChatColumnDecorator>],
}

export default meta
type Story = StoryObj<typeof meta>

export const Full: Story = {
  args: {
    item: hubspotTicketItem,
    variant: 'compact',
    anchorProps: makeAnchorProps(hubspotTicketItem.url ?? '#'),
  },
}

export const Anon: Story = {
  args: {
    item: {
      ...hubspotTicketItem,
      // anon variant: strip customer company + URL
      customerCompany: null,
      url: null,
    },
    variant: 'compact',
  },
  parameters: {
    docs: {
      description: {
        story:
          'Anon variant — `customerCompany` and `url` are nulled server-side; the card falls back to a non-clickable shell.',
      },
    },
  },
}

export const SelfTicket: Story = {
  args: {
    item: {
      ...hubspotTicketItem,
      // self variant: ticket owned by the chatting user; admin URL stripped
      title: 'Your ticket: cannot configure NinjaOne RMM connector',
      customerCompany: null,
      url: null,
      status: 'NEW',
      statusLabel: 'Awaiting agent',
      priority: 'MEDIUM',
    },
    variant: 'compact',
  },
  parameters: {
    docs: {
      description: {
        story:
          'Self-ticket variant — shown to a chat user looking at their own ticket; admin URL is stripped.',
      },
    },
  },
}

export const ClosedTicket: Story = {
  args: {
    item: {
      ...hubspotTicketItem,
      status: 'CLOSED',
      statusLabel: 'Closed',
      priority: 'LOW',
    },
    variant: 'compact',
    anchorProps: makeAnchorProps(hubspotTicketItem.url ?? '#'),
  },
}

export const RowVariant: Story = {
  args: {
    item: hubspotTicketItem,
    variant: 'row',
    anchorProps: makeAnchorProps(hubspotTicketItem.url ?? '#'),
  },
}
