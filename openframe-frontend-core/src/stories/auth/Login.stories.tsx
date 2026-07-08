import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { useState } from 'react'
import { AuthShell, type AuthSsoProvider, LoginForm, type LoginFormProps } from '../../components/features/auth'
import { TabSelector } from '../../components/ui/tab-selector'

const meta = {
  title: 'Auth/Login',
  component: LoginForm,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'Login tab from the auth redesign. Presentational + controlled. Shown inside the full responsive AuthShell (desktop two-column, tablet/mobile stacked). Use the viewport toolbar to check breakpoints.',
      },
    },
  },
  tags: ['autodocs'],
} satisfies Meta<typeof LoginForm>

export default meta
type Story = StoryObj<typeof meta>

/** Full page: Sign Up / Login tabs + Login form + marketing panel. */
function LoginPage(initial: Partial<LoginFormProps>) {
  const [tab, setTab] = useState('login')
  const [email, setEmail] = useState(initial.email ?? '')

  const isValid = !!email.trim()

  const tabs = (
    <TabSelector
      value={tab}
      onValueChange={setTab}
      variant="primary"
      items={[
        { id: 'signup', label: 'Sign Up' },
        { id: 'login', label: 'Login' },
      ]}
    />
  )

  return (
    <AuthShell
      tabs={tabs}
      mobileTagline={
        <>
          <p>All your MSP ops in one place.</p>
          <p>Open-source, AI-ready, no vendor tax.</p>
        </>
      }
    >
      {tab === 'login' ? (
        <LoginForm
          {...initial}
          email={email}
          onEmailChange={setEmail}
          submitDisabled={!isValid}
          onSubmit={() => {}}
        />
      ) : (
        <div className="flex min-h-[240px] items-center justify-center rounded-md border border-ods-border bg-ods-card p-[var(--spacing-system-xl)] text-h4 text-ods-text-secondary">
          Sign Up — see Auth/Create Organization
        </div>
      )}
    </AuthShell>
  )
}

/** Empty email, submit disabled. */
export const Empty: Story = {
  render: () => <LoginPage />,
}

/** Valid email entered, Continue enabled (accent). */
export const Filled: Story = {
  render: () => <LoginPage email="roman@mail.com" />,
}

const SSO_PROVIDERS: AuthSsoProvider[] = ['openframe', 'google', 'microsoft']

/** SSO configured: email filled, submit replaced by provider buttons. */
export const SSO: Story = {
  render: () => <LoginPage email="roman@mail.com" ssoProviders={SSO_PROVIDERS} ssoActionLabel="Sign Up with" />,
}
