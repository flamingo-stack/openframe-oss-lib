import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { useState } from 'react'
import {
  type AuthSsoProvider,
  AuthShell,
  BackToLoginLink,
  CompleteAccountForm,
} from '../../components/features/auth'
import { TabSelector } from '../../components/ui/tab-selector'

const meta = {
  title: 'Auth/Complete Account',
  component: CompleteAccountForm,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'Account details form shared by Sign Up ("Complete your Account") and Accept Invitation: Continue with Google/Microsoft on top, then name + password fields. Presentational + controlled.',
      },
    },
  },
  tags: ['autodocs'],
} satisfies Meta<typeof CompleteAccountForm>

export default meta
type Story = StoryObj<typeof meta>

const SSO_PROVIDERS: AuthSsoProvider[] = ['google', 'microsoft']

function useAccountFields(filled: boolean) {
  const [firstName, setFirstName] = useState(filled ? 'Ada' : '')
  const [lastName, setLastName] = useState(filled ? 'Lovelace' : '')
  const [password, setPassword] = useState(filled ? 'SuperSecretPassphrase2024!' : '')
  const [confirmPassword, setConfirmPassword] = useState(filled ? 'SuperSecretPassphrase2024!' : '')

  const isValid =
    !!firstName.trim() && !!lastName.trim() && password.length >= 8 && password === confirmPassword

  return {
    firstName,
    lastName,
    password,
    confirmPassword,
    onFirstNameChange: setFirstName,
    onLastNameChange: setLastName,
    onPasswordChange: setPassword,
    onConfirmPasswordChange: setConfirmPassword,
    submitDisabled: !isValid,
  }
}

/** Sign Up step: tabs + Back to Organization secondary action. */
function SignUpPage({ filled = false }: { filled?: boolean }) {
  const fields = useAccountFields(filled)

  const tabs = (
    <TabSelector
      value="signup"
      onValueChange={() => {}}
      variant="primary"
      items={[
        { id: 'signup', label: 'Sign Up' },
        { id: 'login', label: 'Login' },
      ]}
    />
  )

  return (
    <AuthShell tabs={tabs}>
      <CompleteAccountForm
        {...fields}
        onSubmit={() => {}}
        onBack={() => {}}
        ssoProviders={SSO_PROVIDERS}
        onSsoClick={() => {}}
      />
    </AuthShell>
  )
}

/** Accept Invitation: no tabs, no back action; "Back to Login" in the shell footer. */
function InvitationPage({ filled = false }: { filled?: boolean }) {
  const fields = useAccountFields(filled)

  return (
    <AuthShell footer={<BackToLoginLink onClick={() => {}} />}>
      <CompleteAccountForm
        {...fields}
        onSubmit={() => {}}
        ssoProviders={SSO_PROVIDERS}
        onSsoClick={() => {}}
        title="Accept Invitation"
        subtitle="Complete your registration to join the organization"
      />
    </AuthShell>
  )
}

export const SignUpEmpty: Story = { render: () => <SignUpPage /> }
export const SignUpFilled: Story = { render: () => <SignUpPage filled /> }
export const InvitationEmpty: Story = { render: () => <InvitationPage /> }
export const InvitationFilled: Story = { render: () => <InvitationPage filled /> }
