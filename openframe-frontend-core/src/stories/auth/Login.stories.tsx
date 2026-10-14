import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { useState } from 'react';
import { AuthShell, type AuthSsoProvider, LoginForm, type LoginFormProps } from '../../components/features/auth';
import { TabSelector } from '../../components/ui/tab-selector';

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
} satisfies Meta<typeof LoginForm>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Full page: Sign Up / Login tabs + Login form + marketing panel. */
function LoginPage({ ssoProviders = [], ...initial }: Partial<LoginFormProps>) {
  const [tab, setTab] = useState('login');
  const [email, setEmail] = useState(initial.email ?? '');

  const isValid = !!email.trim();

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
  );

  return (
    <AuthShell tabs={tabs}>
      {tab === 'login' ? (
        <LoginForm
          {...initial}
          ssoProviders={ssoProviders}
          email={email}
          onEmailChange={setEmail}
          submitDisabled={!isValid}
          termsUrl="#terms"
          privacyPolicyUrl="#privacy"
        />
      ) : (
        <div className="flex min-h-[240px] items-center justify-center rounded-md border border-ods-border bg-ods-card p-[var(--spacing-system-xl)] text-ods-text-secondary text-h4">
          Sign Up — see Auth/Create Organization
        </div>
      )}
    </AuthShell>
  );
}

/** Empty email, submit disabled. */
export const Empty: Story = {
  render: () => <LoginPage onSubmitClick={() => {}} />,
};

/** Valid email entered, Continue enabled (accent). */
export const Filled: Story = {
  render: () => <LoginPage onSubmitClick={() => {}} email="roman@mail.com" />,
};

/** The generic providers, which need nothing typed. */
const SSO_PROVIDERS: AuthSsoProvider[] = ['google', 'microsoft', 'apple'];

/** Generic providers under the email field, before anything is typed. */
export const SSO: Story = {
  render: () => <LoginPage ssoProviders={SSO_PROVIDERS} />,
};

/** The email resolved an organization with no SSO of its own: its OpenFrame login, then the generic providers. */
export const TenantWithoutCustomSso: Story = {
  render: () => (
    <LoginPage
      email="maya@acme.co"
      ssoProviders={SSO_PROVIDERS}
      tenantMethods={{ name: 'Acme IT', openframe: true, providers: [] }}
    />
  ),
};

/** The email resolved an organization with its own SSO: only its methods, its providers tagged with its name. */
export const TenantWithCustomSso: Story = {
  render: () => (
    <LoginPage
      email="roman@northwind.com"
      ssoProviders={[]}
      tenantMethods={{ name: 'Northwind', openframe: true, providers: ['google'] }}
    />
  ),
};

/** No account for the email: the notice under the field, the generic providers still offered. */
export const NoAccount: Story = {
  render: () => (
    <LoginPage
      email="dan@gmail.com"
      ssoProviders={SSO_PROVIDERS}
      notice="No OpenFrame account is linked to this email. Ask your organization's administrator for an invitation."
    />
  ),
};
