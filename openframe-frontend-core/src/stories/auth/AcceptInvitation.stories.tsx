import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { useState } from 'react'
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
          'Accept Invitation from the auth redesign. Presentational + controlled: read-only invited email, a Terms gate, and SSO providers to join the org. Shown inside AuthShell without tabs. SSO buttons stay disabled until the Terms checkbox is checked.',
      },
    },
  },
  tags: ['autodocs'],
} satisfies Meta<typeof AcceptInvitationForm>

export default meta
type Story = StoryObj<typeof meta>

const SSO_PROVIDERS: AuthSsoProvider[] = ['openframe', 'google', 'microsoft']

/** Full page: invitation form + marketing panel (no tabs). */
function AcceptInvitationPage({ initialChecked = false }: { initialChecked?: boolean }) {
  const [agreedToTerms, setAgreedToTerms] = useState(initialChecked)

  return (
    <AuthShell
      mobileTagline={<p>All your MSP ops in one place.</p>}
      footer={<BackToLoginLink onClick={() => {}} />}
    >
      <AcceptInvitationForm
        email="roman@mail.com"
        agreedToTerms={agreedToTerms}
        onAgreedToTermsChange={setAgreedToTerms}
        ssoProviders={SSO_PROVIDERS}
        onSsoClick={() => {}}
        onBackToLogin={() => {}}
        termsUrl="#terms"
        privacyPolicyUrl="#privacy"
      />
    </AuthShell>
  )
}

/** Terms unchecked — SSO buttons disabled. */
export const NoCheck: Story = {
  render: () => <AcceptInvitationPage />,
}

/** Terms accepted — SSO buttons enabled. */
export const WithCheck: Story = {
  render: () => <AcceptInvitationPage initialChecked />,
}
