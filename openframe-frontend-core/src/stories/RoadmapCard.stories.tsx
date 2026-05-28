import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { RoadmapCard } from '../components/chat/entity-cards'
import { ChatColumnDecorator } from './__fixtures__/chat-card-decorator'
import {
  roadmapFeatureItem,
  roadmapDeliveryItem,
  roadmapInternalTaskItem,
} from './__fixtures__/chat-cards'

const meta: Meta<typeof RoadmapCard> = {
  title: 'Chat/EntityCards/RoadmapCard',
  component: RoadmapCard,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'Card for the `roadmap_item`, `delivery_item` and `internal_task` doc types. The `cardType` prop drives the icon (Feature / Delivery / Bug-shaped task) in the `sm` chat-inline variant. `default` size renders the full rich card with vote buttons + screenshot gallery; in chat the vote handlers are stubbed.',
      },
    },
  },
  decorators: [(Story) => <ChatColumnDecorator><Story /></ChatColumnDecorator>],
}

export default meta
type Story = StoryObj<typeof meta>

export const RoadmapItemSm: Story = {
  args: {
    item: roadmapFeatureItem,
    href: '/roadmap/' + roadmapFeatureItem.id,
    size: 'sm',
    cardType: 'roadmap_item',
    target: '_blank',
    rel: 'noopener noreferrer',
  },
}

export const DeliveryItemSm: Story = {
  args: {
    item: roadmapDeliveryItem,
    href: '/delivery/' + roadmapDeliveryItem.id,
    size: 'sm',
    cardType: 'delivery_item',
    target: '_blank',
    rel: 'noopener noreferrer',
  },
}

export const InternalTaskSm: Story = {
  args: {
    item: roadmapInternalTaskItem,
    href: '/internal-tasks/' + roadmapInternalTaskItem.id,
    size: 'sm',
    cardType: 'internal_task',
    target: '_blank',
    rel: 'noopener noreferrer',
  },
}

export const RoadmapItemDefault: Story = {
  args: {
    item: roadmapFeatureItem,
    size: 'default',
    cardType: 'roadmap_item',
  },
  parameters: {
    docs: {
      description: {
        story:
          'Full rich roadmap card — vote buttons, screenshot gallery, status pill and target version. Used on the public roadmap page.',
      },
    },
  },
}
