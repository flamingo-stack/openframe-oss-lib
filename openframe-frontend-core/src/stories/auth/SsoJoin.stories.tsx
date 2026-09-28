import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { useState } from 'react';
import { SsoJoinForm, type SsoJoinFormProps } from '../../components/features/auth';

const meta = {
  title: 'Auth/SSO Join',
  component: SsoJoinForm,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          '"One Last Step" - the consent gate shown before an SSO flow creates a user (invitation acceptance, shared-domain first login). Read-only identity row, Terms & Privacy checkbox (unchecked by default), Create Account unlocks once agreed; Back to Login leaves without creating anything.',
      },
    },
  },
  tags: ['autodocs'],
} satisfies Meta<typeof SsoJoinForm>;

export default meta;
type Story = StoryObj<typeof meta>;

const LEGAL = {
  termsUrl: 'https://www.flamingo.run/terms-of-service',
  privacyPolicyUrl: 'https://www.flamingo.run/privacy-policy',
};

/** The standalone page: one centered card on the page background, no benefits panel. */
function JoinPage(props: Partial<SsoJoinFormProps> & { initiallyAgreed?: boolean }) {
  const { initiallyAgreed = false, ...rest } = props;
  const [agreedToTerms, setAgreedToTerms] = useState(initiallyAgreed);

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-ods-bg p-[var(--spacing-system-l)]">
      <div className="w-full max-w-[600px]">
        <SsoJoinForm
          name="Roman Smith"
          email="roman@acme.com"
          organizationName="Acme Managed Services"
          roles={['ADMIN']}
          agreedToTerms={agreedToTerms}
          onAgreedToTermsChange={setAgreedToTerms}
          onSubmit={() => {}}
          onBack={() => {}}
          {...LEGAL}
          {...rest}
        />
      </div>
    </div>
  );
}

/** Fresh: nothing agreed yet, Create Account locked. */
export const Default: Story = { render: () => <JoinPage /> };

/** Terms agreed, Create Account unlocked. */
export const Agreed: Story = { render: () => <JoinPage initiallyAgreed /> };

/** A plain member: the server reports no roles, so no tag is drawn. */
export const WithoutRole: Story = { render: () => <JoinPage roles={[]} /> };

/** The provider gave no name: the address stands in, and feeds the initials. */
export const EmailOnly: Story = { render: () => <JoinPage name="" /> };

/** Create Account pressed: everything locks while the navigation leaves the page. */
export const Submitting: Story = { render: () => <JoinPage initiallyAgreed loading /> };
