import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import {
  AcceptInvitationForm,
  type AuthSsoProvider,
  AuthShell,
  BackToLoginLink,
} from '../../components/features/auth'

const meta = {
  title: 'Auth/Accept Invitation',
  component: AcceptInvitationForm,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'Accept Invitation from the auth redesign. Presentational + controlled: read-only invited email (prefilled from the invitation link) and SSO providers to join the org. Shown inside AuthShell without tabs.',
      },
    },
  },
  tags: ['autodocs'],
} satisfies Meta<typeof AcceptInvitationForm>

export default meta
type Story = StoryObj<typeof meta>

const SSO_PROVIDERS: AuthSsoProvider[] = ['openframe', 'google', 'microsoft']

/** Full page: invitation form + marketing panel (no tabs). */
function AcceptInvitationPage() {
  return (
    <AuthShell
      mobileTagline={
        <>
          <p>All your MSP ops in one place.</p>
          <p>Open-source, AI-ready, no vendor tax.</p>
        </>
      }
      footer={<BackToLoginLink onClick={() => {}} />}
    >
      <AcceptInvitationForm
        email="roman@mail.com"
        ssoProviders={SSO_PROVIDERS}
        onSsoClick={() => {}}
        onBackToLogin={() => {}}
      />
    </AuthShell>
  )
}

/** Prefilled invited email, SSO providers ready to pick. */
export const Default: Story = {
  render: () => <AcceptInvitationPage />,
}
