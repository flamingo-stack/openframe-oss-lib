import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { ProgramCard } from '../components/chat/entity-cards'
import { DEFAULT_PROGRAM_CONFIGS } from '../components/chat/entity-cards/program-card-defaults'
import { ChatColumnDecorator } from './__fixtures__/chat-card-decorator'
import {
  podcastItem,
  webinarItem,
  eventItem,
} from './__fixtures__/chat-cards'

const meta: Meta<typeof ProgramCard> = {
  title: 'Chat/EntityCards/ProgramCard',
  component: ProgramCard,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'Generic card for the `podcast`, `webinar` and `event` doc types. Behavior is driven by the `config` prop (`DEFAULT_PROGRAM_CONFIGS[type]` ships safe minimum config for compact chat rendering; embedders can override per type with full catalog config). `sm` size is what the chat dispatch uses.',
      },
    },
  },
  decorators: [(Story) => <ChatColumnDecorator><Story /></ChatColumnDecorator>],
}

export default meta
type Story = StoryObj<typeof meta>

export const PodcastSm: Story = {
  args: {
    config: DEFAULT_PROGRAM_CONFIGS.podcast,
    item: podcastItem,
    size: 'sm',
    href: '/podcasts/' + podcastItem.id,
    target: '_blank',
    rel: 'noopener noreferrer',
  },
}

export const WebinarSm: Story = {
  args: {
    config: DEFAULT_PROGRAM_CONFIGS.webinar,
    item: webinarItem,
    size: 'sm',
    href: '/webinars/' + webinarItem.id,
    target: '_blank',
    rel: 'noopener noreferrer',
  },
}

export const EventSm: Story = {
  args: {
    config: DEFAULT_PROGRAM_CONFIGS.event,
    item: eventItem,
    size: 'sm',
    href: '/events/' + eventItem.id,
    target: '_blank',
    rel: 'noopener noreferrer',
  },
}

export const PodcastDefault: Story = {
  args: {
    config: DEFAULT_PROGRAM_CONFIGS.podcast,
    item: podcastItem,
    size: 'default',
    href: '/podcasts/' + podcastItem.id,
    target: '_blank',
    rel: 'noopener noreferrer',
  },
  parameters: {
    docs: {
      description: {
        story:
          'Full default density. Not used inline in chat but rendered on the podcast catalog page.',
      },
    },
  },
}
