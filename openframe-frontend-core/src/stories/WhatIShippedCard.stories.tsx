import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { WhatIShippedCard, WhatIShippedCardSkeleton } from '../components/chat/entity-cards/what-i-shipped-card'
import { ChatColumnDecorator, makeAnchorProps } from './__fixtures__/chat-card-decorator'
import { whatIShippedEntry } from './__fixtures__/chat-cards'

const meta: Meta<typeof WhatIShippedCard> = {
  title: 'Chat/EntityCards/WhatIShippedCard',
  component: WhatIShippedCard,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'Card for a monthly `what_i_shipped` entry — a thin binding over `EmployeeEntryCard` that maps `entry_month` to the meta date. Engine states (statuses, cover fallbacks, empty draft) are covered by the EmployeeEntryCard stories.',
      },
    },
  },
  decorators: [(Story) => <ChatColumnDecorator><Story /></ChatColumnDecorator>],
}

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    entry: whatIShippedEntry,
  },
}

/** Related-rail click-through — the whole card is one anchor. */
export const AsAnchor: Story = {
  args: {
    entry: whatIShippedEntry,
    anchorProps: makeAnchorProps('/what-i-shipped/billing-flow'),
  },
}

export const Skeleton: StoryObj = {
  render: () => <WhatIShippedCardSkeleton />,
}
