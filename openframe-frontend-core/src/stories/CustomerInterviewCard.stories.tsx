import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { CustomerInterviewCard } from '../components/chat/entity-cards'
import { ChatColumnDecorator } from './__fixtures__/chat-card-decorator'
import { customerInterview } from './__fixtures__/chat-cards'

const meta: Meta<typeof CustomerInterviewCard> = {
  title: 'Chat/EntityCards/CustomerInterviewCard',
  component: CustomerInterviewCard,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'Card for the `customer_interview` doc type. The presence of `main_video_url` drives the play-button overlay on the cover. User + MSP badge overlay is shown in both sizes.',
      },
    },
  },
  decorators: [(Story) => <ChatColumnDecorator><Story /></ChatColumnDecorator>],
}

export default meta
type Story = StoryObj<typeof meta>

export const ChatInlineSm: Story = {
  args: {
    interview: customerInterview,
    href: '/customer-interviews/' + customerInterview.slug,
    size: 'sm',
    target: '_blank',
    rel: 'noopener noreferrer',
  },
}

export const Default: Story = {
  args: {
    interview: customerInterview,
    href: '/customer-interviews/' + customerInterview.slug,
    size: 'default',
    target: '_blank',
    rel: 'noopener noreferrer',
  },
}
