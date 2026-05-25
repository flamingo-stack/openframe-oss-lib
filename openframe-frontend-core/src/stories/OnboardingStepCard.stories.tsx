import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { OnboardingStepCard } from '../components/shared/onboarding/onboarding-step-card'
import { UserPlusIcon } from '../components/icons-v2-generated/users/user-plus-icon'

const baseStep = {
  id: 'invite-users',
  title: 'Company & Team',
  description: 'Invite team members and set up roles',
  actionIcon: (color?: string) => <UserPlusIcon color={color} size={20} />,
  actionText: 'Invite Users',
  completedText: 'Manage Users',
  onAction: () => console.log('action'),
  onSkip: () => console.log('skip'),
}

const meta = {
  title: 'Shared/OnboardingStepCard',
  component: OnboardingStepCard,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'A single row in the Get Started onboarding list. Renders title + description on the left and state-dependent controls on the right (Skip / Action, Completed badge + Manage, Skipped badge, or loading skeleton). The card itself has no click action — only the inner buttons are interactive — so it has no hover state.',
      },
    },
  },
  tags: ['autodocs'],
} satisfies Meta<typeof OnboardingStepCard>

export default meta
type Story = StoryObj<typeof meta>

/**
 * Pending step — shows Skip Step + the primary action button.
 */
export const Default: Story = {
  args: {
    step: baseStep,
    isCompleted: false,
    isSkipped: false,
    isCheckingCompletion: false,
    onAction: () => console.log('action'),
    onSkip: () => console.log('skip'),
  },
}

/**
 * Completed step — shows the success badge and a "Manage" button.
 */
export const Completed: Story = {
  args: {
    ...Default.args,
    isCompleted: true,
  },
}

/**
 * Skipped step — shows only the SKIPPED badge.
 */
export const Skipped: Story = {
  args: {
    ...Default.args,
    isSkipped: true,
  },
}

/**
 * Loading state while completion status is being checked.
 */
export const CheckingCompletion: Story = {
  args: {
    ...Default.args,
    isCheckingCompletion: true,
  },
}

/**
 * Full list rendered the way it appears on the Get Started page.
 * Use this story to verify that hovering any row does NOT change its
 * border or background — only the inner buttons should react.
 */
export const List: Story = {
  args: Default.args,
  render: () => {
    const steps = [
      {
        ...baseStep,
        id: 'orgs',
        title: 'Organizations Setup',
        description: 'Create and configure your organizational structure',
        completed: true,
      },
      {
        ...baseStep,
        id: 'devices',
        title: 'Device Management',
        description: 'Connect and monitor your fleet of devices',
        completed: true,
      },
      {
        ...baseStep,
        id: 'team',
        title: 'Company & Team',
        description: 'Invite team members and set up roles',
        completed: false,
      },
      {
        ...baseStep,
        id: 'sso',
        title: 'SSO Configuration',
        description: 'Link Microsoft 365, Google Workspace, and other identity providers',
        completed: false,
      },
      {
        ...baseStep,
        id: 'kb',
        title: 'Knowledge Base',
        description: 'Access documentation and learning resources',
        completed: false,
      },
    ]

    return (
      <div className="flex flex-col gap-3">
        {steps.map((s) => (
          <OnboardingStepCard
            key={s.id}
            step={s}
            isCompleted={s.completed}
            isSkipped={false}
            isCheckingCompletion={false}
            onAction={() => console.log('action', s.id)}
            onSkip={() => console.log('skip', s.id)}
          />
        ))}
      </div>
    )
  },
}