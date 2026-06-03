import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { BlogCard } from '../components/chat/entity-cards'
import { ChatColumnDecorator } from './__fixtures__/chat-card-decorator'
import { blogPostSummary } from './__fixtures__/chat-cards'

const meta: Meta<typeof BlogCard> = {
  title: 'Chat/EntityCards/BlogCard',
  component: BlogCard,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'Card for the `blog_post` doc type. Has two densities — `sm` is the compact horizontal chat-inline form (~80px tall), `default` is the full vertical catalog card. The card composes its own `<a>` from `href`; callers resolve the URL via `buildContentURL` or `useNavLink`.',
      },
    },
  },
  decorators: [(Story) => <ChatColumnDecorator><Story /></ChatColumnDecorator>],
}

export default meta
type Story = StoryObj<typeof meta>

export const ChatInlineSm: Story = {
  args: {
    post: blogPostSummary,
    href: '/blog/' + blogPostSummary.slug,
    size: 'sm',
    target: '_blank',
    rel: 'noopener noreferrer',
  },
}

export const ChatInlineWithVideoBadge: Story = {
  args: {
    post: blogPostSummary,
    href: '/blog/' + blogPostSummary.slug,
    size: 'sm',
    target: '_blank',
    rel: 'noopener noreferrer',
    hasEmbeddedVideo: true,
  },
}

export const Default: Story = {
  args: {
    post: blogPostSummary,
    href: '/blog/' + blogPostSummary.slug,
    size: 'default',
    target: '_blank',
    rel: 'noopener noreferrer',
  },
  parameters: {
    docs: {
      description: {
        story:
          'Full vertical catalog card. Not used inline in chat (the chat dispatch always passes `size="sm"`), but the card supports it for the related-content rail.',
      },
    },
  },
}
