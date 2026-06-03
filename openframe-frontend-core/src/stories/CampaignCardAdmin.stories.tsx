import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { CampaignCardAdmin } from '../components/chat/entity-cards'
import {
  ChatColumnDecorator,
  makeAnchorProps,
} from './__fixtures__/chat-card-decorator'
import { campaignItem } from './__fixtures__/chat-cards'

const meta: Meta<typeof CampaignCardAdmin> = {
  title: 'Chat/EntityCards/CampaignCardAdmin',
  component: CampaignCardAdmin,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'Compact chat-inline card for the `marketing_campaign` doc type. Shows the campaign name, start date, goal count and a one-line description. The full admin card (with delete/manage buttons) lives in the hub; this is the chat-only projection.',
      },
    },
  },
  decorators: [(Story) => <ChatColumnDecorator><Story /></ChatColumnDecorator>],
}

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    campaign: campaignItem,
    anchorProps: makeAnchorProps('/admin/campaigns/' + campaignItem.id),
  },
}

export const NoDescription: Story = {
  args: {
    campaign: {
      ...campaignItem,
      description: null,
    },
    anchorProps: makeAnchorProps('/admin/campaigns/' + campaignItem.id),
  },
}

export const NoGoals: Story = {
  args: {
    campaign: {
      ...campaignItem,
      goals: [],
    },
    anchorProps: makeAnchorProps('/admin/campaigns/' + campaignItem.id),
  },
}
