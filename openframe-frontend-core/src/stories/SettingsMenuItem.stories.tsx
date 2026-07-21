import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { SettingsMenuItem } from '../components/ui/settings-menu-item'
import { CompassIcon } from '../components/icons-v2-generated/map-and-travel/compass-icon'
import { QuestionCircleIcon } from '../components/icons-v2-generated/signs-and-symbols/question-circle-icon'
import { PlusCircleIcon } from '../components/icons-v2-generated/signs-and-symbols/plus-circle-icon'

// The card grows to fill its container, so the stories cap the width to a
// realistic column — that's also what makes the title/caption truncation
// visible.
const meta: Meta<typeof SettingsMenuItem> = {
  title: 'UI/SettingsMenuItem',
  component: SettingsMenuItem,
  parameters: { layout: 'padded' },
  decorators: [
    (Story) => (
      <div className="w-full max-w-[440px]">
        <Story />
      </div>
    ),
  ],
  args: {
    title: 'Onboarding Guides',
    caption: 'Step-by-step product walkthroughs.',
    href: '#',
    icon: <CompassIcon />,
  },
}

export default meta
type Story = StoryObj<typeof SettingsMenuItem>

export const Default: Story = {}

export const Truncated: Story = {
  args: {
    title: 'Onboarding Guides for every product surface and workflow',
    caption: 'Step-by-step product walkthroughs covering setup, configuration and rollout.',
  },
}

export const List: Story = {
  render: (args) => (
    <div className="flex flex-col gap-[var(--spacing-system-sf)]">
      <SettingsMenuItem {...args} />
      <SettingsMenuItem
        title="Knowledge Base"
        caption="Search articles and troubleshooting guides."
        href="#"
        icon={<QuestionCircleIcon />}
      />
      <SettingsMenuItem
        title="Open a Support Ticket"
        caption="Talk to our team about anything else."
        href="#"
        icon={<PlusCircleIcon />}
      />
    </div>
  ),
}
