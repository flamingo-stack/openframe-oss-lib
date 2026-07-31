import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { MingoAiButton } from '../components/navigation/mingo-ai-button'

/**
 * Marketing-header Mingo AI launcher. Full-height and flush inside the 72px
 * unified header: the decorator reproduces that context so the left border
 * divider and traveling accent edge light render as they do in `Header` (`config.mingo`).
 * The "Mingo AI" label hides below `md` (icon-only, see IconOnly).
 */
const meta = {
  title: 'Navigation/MingoAiButton',
  component: MingoAiButton,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    source: { control: 'text' },
  },
  decorators: [
    (Story) => (
      <div className="flex h-[72px] items-center justify-end border-b border-ods-border bg-ods-card w-[360px]">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof MingoAiButton>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    source: 'flamingo',
  },
}

/** Below `md` the wordmark is hidden and only the Mingo icon shows. */
export const IconOnly: Story = {
  args: {
    source: 'flamingo',
  },
  parameters: {
    viewport: { defaultViewport: 'mobile1' },
  },
}
