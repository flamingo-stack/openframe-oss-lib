import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { useState } from 'react'
import { OpenFrameSsoLoginForm, OpenFrameSsoSignUpForm, SsoAuthShell } from '../../components/features/auth'

const meta = {
  title: 'Auth/OpenFrame SSO',
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'OpenFrame SSO (IdP) screens from the auth redesign. Centered single-column SsoAuthShell (logo top, card centered, Powered by Flamingo bottom). Login and Sign Up forms, both presentational + controlled with a password show/hide toggle.',
      },
    },
  },
  tags: ['autodocs'],
} satisfies Meta

export default meta
type Story = StoryObj

function SsoLoginPage({ initialEmail = '', initialPassword = '' }: { initialEmail?: string; initialPassword?: string }) {
  const [email, setEmail] = useState(initialEmail)
  const [password, setPassword] = useState(initialPassword)

  const isValid = !!email.trim() && password.length > 0

  return (
    <SsoAuthShell>
      <OpenFrameSsoLoginForm
        email={email}
        password={password}
        onEmailChange={setEmail}
        onPasswordChange={setPassword}
        onSubmit={() => {}}
        onForgotPassword={() => {}}
        submitDisabled={!isValid}
      />
    </SsoAuthShell>
  )
}

function SsoSignUpPage({ filled = false }: { filled?: boolean }) {
  const [email, setEmail] = useState(filled ? 'roman@mail.com' : '')
  const [firstName, setFirstName] = useState(filled ? 'Roman' : '')
  const [lastName, setLastName] = useState(filled ? 'Korvatskyi' : '')
  const [password, setPassword] = useState(filled ? 'SuperSecret1' : '')
  const [confirmPassword, setConfirmPassword] = useState(filled ? 'SuperSecret1' : '')
  const [agreedToTerms, setAgreedToTerms] = useState(filled)

  const isValid =
    !!email.trim() &&
    !!firstName.trim() &&
    !!lastName.trim() &&
    password.length >= 8 &&
    password === confirmPassword &&
    agreedToTerms

  return (
    <SsoAuthShell>
      <OpenFrameSsoSignUpForm
        email={email}
        firstName={firstName}
        lastName={lastName}
        password={password}
        confirmPassword={confirmPassword}
        agreedToTerms={agreedToTerms}
        onEmailChange={setEmail}
        onFirstNameChange={setFirstName}
        onLastNameChange={setLastName}
        onPasswordChange={setPassword}
        onConfirmPasswordChange={setConfirmPassword}
        onAgreedToTermsChange={setAgreedToTerms}
        onSubmit={() => {}}
        onForgotPassword={() => {}}
        submitDisabled={!isValid}
        termsUrl="#terms"
        privacyPolicyUrl="#privacy"
      />
    </SsoAuthShell>
  )
}

/** Login — empty email + password, submit disabled. */
export const LoginEmpty: Story = {
  render: () => <SsoLoginPage />,
}

/** Login — filled, submit enabled. */
export const LoginFilled: Story = {
  render: () => <SsoLoginPage initialEmail="roman@mail.com" initialPassword="SuperSecret1" />,
}

/** Sign Up — empty fields, submit disabled. */
export const SignUpEmpty: Story = {
  render: () => <SsoSignUpPage />,
}

/** Sign Up — filled and terms accepted, submit enabled. */
export const SignUpFilled: Story = {
  render: () => <SsoSignUpPage filled />,
}
