import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { SlackMessageCard } from '../components/chat/entity-cards'
import {
  ChatColumnDecorator,
  makeAnchorProps,
} from './__fixtures__/chat-card-decorator'
import { slackMessageItem } from './__fixtures__/chat-cards'

const meta: Meta<typeof SlackMessageCard> = {
  title: 'Chat/EntityCards/SlackMessageCard',
  component: SlackMessageCard,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'Inline card rendered in chat for the `slack_message` doc type. Pure presentation; previews are PII-sanitized server-side. Compact variant is what shows up inline in a chat message; the row variant is used in list contexts.',
      },
    },
  },
  decorators: [(Story) => <ChatColumnDecorator><Story /></ChatColumnDecorator>],
}

export default meta
type Story = StoryObj<typeof meta>

export const Compact: Story = {
  args: {
    item: slackMessageItem,
    variant: 'compact',
    anchorProps: makeAnchorProps(slackMessageItem.url ?? '#'),
  },
}

export const RowVariant: Story = {
  args: {
    item: slackMessageItem,
    variant: 'row',
    anchorProps: makeAnchorProps(slackMessageItem.url ?? '#'),
  },
}
