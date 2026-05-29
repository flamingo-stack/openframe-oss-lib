import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { ProductReleaseCard } from '../components/chat/entity-cards'
import {
  ChatColumnDecorator,
  makeAnchorProps,
} from './__fixtures__/chat-card-decorator'
import {
  productReleaseSmProps,
  productReleaseLgProps,
} from './__fixtures__/chat-cards'

const meta: Meta<typeof ProductReleaseCard> = {
  title: 'Chat/EntityCards/ProductReleaseCard',
  component: ProductReleaseCard,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'Card for the `product_release` doc type. Two densities — `sm` is the chat-inline compact form, `lg` is the rich catalog row used on `/releases`, the DevCenter tab and the investor-update related-content section. Both share the same flat prop signature (no `item` wrapper).',
      },
    },
  },
  decorators: [(Story) => <ChatColumnDecorator><Story /></ChatColumnDecorator>],
}

export default meta
type Story = StoryObj<typeof meta>

export const ChatInlineSm: Story = {
  args: {
    ...productReleaseSmProps,
    size: 'sm',
    anchorProps: makeAnchorProps('/releases/2-5-0'),
  },
}

export const ChatInlineSmWithVideoCover: Story = {
  args: {
    ...productReleaseSmProps,
    hasVideoCover: true,
    size: 'sm',
    anchorProps: makeAnchorProps('/releases/2-5-0'),
  },
}

export const Large: Story = {
  args: {
    ...productReleaseLgProps,
    size: 'lg',
    anchorProps: makeAnchorProps('/releases/2-5-0'),
  },
  parameters: {
    docs: {
      description: {
        story:
          'Rich large card used everywhere a product release is the focal item. Includes hero cover, version pill, changelog stats strip and a 4-cell metadata grid footer (Type / Status / Released / Author).',
      },
    },
  },
}
