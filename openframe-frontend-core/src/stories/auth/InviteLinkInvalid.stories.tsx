import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { InviteLinkInvalidModal } from '../../components/features/auth'

const meta = {
  title: 'Auth/Invite Link Invalid',
  component: InviteLinkInvalidModal,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component: 'Shown when an invitation link is expired or invalid. Both the X and the button return to login.',
      },
    },
  },
  tags: ['autodocs'],
} satisfies Meta<typeof InviteLinkInvalidModal>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: () => <InviteLinkInvalidModal onBackToLogin={() => {}} />,
}
