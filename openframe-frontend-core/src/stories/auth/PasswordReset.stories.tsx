import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { useState } from 'react'
import { AuthShell, BackToLoginLink, PasswordResetForm } from '../../components/features/auth'

const meta = {
  title: 'Auth/Password Reset',
  component: PasswordResetForm,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'Password Reset from the auth redesign. Presentational + controlled: new password + confirm, then Cancel / Reset Password. Shown inside AuthShell without tabs; "Back to Login" sits in the shell footer on desktop.',
      },
    },
  },
  tags: ['autodocs'],
} satisfies Meta<typeof PasswordResetForm>

export default meta
type Story = StoryObj<typeof meta>

/** Full page: password reset form + marketing panel (no tabs). */
function PasswordResetPage({ initialPassword = '', initialConfirm = '' }: { initialPassword?: string; initialConfirm?: string }) {
  const [password, setPassword] = useState(initialPassword)
  const [confirmPassword, setConfirmPassword] = useState(initialConfirm)

  const isValid = password.length >= 8 && password === confirmPassword

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
      <PasswordResetForm
        password={password}
        confirmPassword={confirmPassword}
        onPasswordChange={setPassword}
        onConfirmPasswordChange={setConfirmPassword}
        onSubmit={() => {}}
        onCancel={() => {}}
        submitDisabled={!isValid}
        errors={{
          confirmPassword:
            confirmPassword && password !== confirmPassword ? 'Passwords do not match' : undefined,
        }}
      />
    </AuthShell>
  )
}

/** Empty fields, submit disabled. */
export const Empty: Story = {
  render: () => <PasswordResetPage />,
}

/** Both passwords entered and matching, submit enabled. */
export const Filled: Story = {
  render: () => <PasswordResetPage initialPassword="SuperSecret1" initialConfirm="SuperSecret1" />,
}
