import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { InvestorUpdateCard } from '../components/chat/entity-cards'
import { ChatColumnDecorator } from './__fixtures__/chat-card-decorator'
import { investorUpdate } from './__fixtures__/chat-cards'

const meta: Meta<typeof InvestorUpdateCard> = {
  title: 'Chat/EntityCards/InvestorUpdateCard',
  component: InvestorUpdateCard,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'Card for the `investor_update` doc type. Period badge ("Mar 2025 - May 2025") is composed via `formatInvestorUpdatePeriod`. `sm` size is the compact chat-inline card.',
      },
    },
  },
  decorators: [(Story) => <ChatColumnDecorator><Story /></ChatColumnDecorator>],
}

export default meta
type Story = StoryObj<typeof meta>

export const ChatInlineSm: Story = {
  args: {
    update: investorUpdate,
    href: '/investor-updates/' + investorUpdate.slug,
    size: 'sm',
    target: '_blank',
    rel: 'noopener noreferrer',
  },
}

export const Default: Story = {
  args: {
    update: investorUpdate,
    href: '/investor-updates/' + investorUpdate.slug,
    size: 'default',
    target: '_blank',
    rel: 'noopener noreferrer',
  },
}
