import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { useState } from 'react'
import {
  AuthShell,
  type AuthSsoProvider,
  CreateOrganizationForm,
  type CreateOrganizationFormProps,
} from '../../components/features/auth'
import { TabSelector } from '../../components/ui/tab-selector'

const meta = {
  title: 'Auth/Create Organization',
  component: CreateOrganizationForm,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'Sign Up → Create Organization form from the auth redesign. Presentational + controlled. Shown inside the full responsive AuthShell (desktop two-column, tablet/mobile stacked). Use the viewport toolbar to check breakpoints.',
      },
    },
  },
  tags: ['autodocs'],
} satisfies Meta<typeof CreateOrganizationForm>

export default meta
type Story = StoryObj<typeof meta>

/** Full page: Sign Up / Login tabs + Create Organization form + marketing panel. */
function CreateOrganizationPage(initial: Partial<CreateOrganizationFormProps>) {
  const [tab, setTab] = useState('signup')
  const [email, setEmail] = useState(initial.email ?? '')
  const [organizationName, setOrganizationName] = useState(initial.organizationName ?? '')
  const [domain, setDomain] = useState(initial.domain ?? '')
  const [agreedToTerms, setAgreedToTerms] = useState(initial.agreedToTerms ?? false)

  const isValid = !!email.trim() && !!organizationName.trim() && !!domain.trim() && agreedToTerms

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
    >
      {tab === 'signup' ? (
        <CreateOrganizationForm
          {...initial}
          email={email}
          organizationName={organizationName}
          domain={domain}
          agreedToTerms={agreedToTerms}
          onEmailChange={setEmail}
          onOrganizationNameChange={setOrganizationName}
          onDomainChange={setDomain}
          onAgreedToTermsChange={setAgreedToTerms}
          submitDisabled={!isValid}
          onSubmit={() => {}}
        />
      ) : (
        <div className="flex min-h-[240px] items-center justify-center rounded-md border border-ods-border bg-ods-card p-[var(--spacing-system-xl)] text-h4 text-ods-text-secondary">
          Login — coming in the next step
        </div>
      )}
    </AuthShell>
  )
}

/** Empty fields, terms unchecked, submit disabled. */
export const Empty: Story = {
  render: () => (
    <CreateOrganizationPage domainSuffix=".openframe.ai" termsUrl="#terms" privacyPolicyUrl="#privacy" />
  ),
}

/** Valid input, terms accepted, submit enabled. */
export const Filled: Story = {
  render: () => (
    <CreateOrganizationPage
      email="roman@mail.com"
      organizationName="Roman Group"
      domain="rgroup"
      agreedToTerms
      domainSuffix=".openframe.ai"
      termsUrl="#terms"
      privacyPolicyUrl="#privacy"
    />
  ),
}

/**
 * Error state: long messages under the half-width fields truncate to one line
 * (dotted underline) and open a popover with the full text on click/tap.
 */
export const ErrorState: Story = {
  render: () => (
    <CreateOrganizationPage
      email="ada@example.com"
      organizationName="ϕ"
      domainSuffix=".openframe.ai"
      termsUrl="#terms"
      privacyPolicyUrl="#privacy"
      emailStatus={{ message: 'This email is already registered. Sign in instead.', variant: 'error' }}
      errors={{
        organizationName: 'Organization Name must be 2-100 characters',
      }}
    />
  ),
}

const SSO_PROVIDERS: AuthSsoProvider[] = ['openframe', 'google', 'microsoft']

/** SSO configured: fields disabled, submit replaced by provider buttons. */
export const SSO: Story = {
  render: () => (
    <CreateOrganizationPage
      email="roman@mail.com"
      organizationName="Roman Group"
      domain="rgroup"
      domainSuffix=".openframe.ai"
      ssoProviders={SSO_PROVIDERS}
      termsUrl="#terms"
      privacyPolicyUrl="#privacy"
    />
  ),
}
