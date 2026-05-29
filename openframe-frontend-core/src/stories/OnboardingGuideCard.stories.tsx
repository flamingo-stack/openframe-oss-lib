import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { OnboardingGuideCard } from '../components/chat/entity-cards'
import { ChatColumnDecorator } from './__fixtures__/chat-card-decorator'
import { onboardingGuide } from './__fixtures__/chat-cards'

const meta: Meta<typeof OnboardingGuideCard> = {
  title: 'Chat/EntityCards/OnboardingGuideCard',
  component: OnboardingGuideCard,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'Card for the `onboarding_guide` doc type. Three densities — `catalog` (hero + author grid), `default` (horizontal step-card) and `sm` (chat-inline compact). The chat dispatch always passes `size="sm"` plus `displayAction: true` so the Ask/Display affordance shows below.',
      },
    },
  },
  decorators: [(Story) => <ChatColumnDecorator><Story /></ChatColumnDecorator>],
}

export default meta
type Story = StoryObj<typeof meta>

export const ChatInlineSm: Story = {
  args: {
    guide: onboardingGuide,
    href: '/guides/' + onboardingGuide.slug,
    size: 'sm',
    target: '_blank',
    rel: 'noopener noreferrer',
  },
}

export const Default: Story = {
  args: {
    guide: onboardingGuide,
    href: '/guides/' + onboardingGuide.slug,
    size: 'default',
    target: '_blank',
    rel: 'noopener noreferrer',
  },
}

export const Catalog: Story = {
  args: {
    guide: onboardingGuide,
    href: '/guides/' + onboardingGuide.slug,
    size: 'catalog',
    target: '_blank',
    rel: 'noopener noreferrer',
  },
}
