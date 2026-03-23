import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { WaitlistForm } from '../components/features/waitlist-form';
import { Toaster } from '../components/ui/toaster';

const meta = {
  title: 'Features/WaitlistForm',
  component: WaitlistForm,
  parameters: {
    layout: 'padded',
    backgrounds: { default: 'dark' },
  },
  decorators: [
    (Story) => (
      <div>
        <Story />
        <Toaster />
      </div>
    ),
  ],
  args: {
    onRegister: async () => {
      await new Promise((r) => setTimeout(r, 1500));
    },
    geoApiUrl: null,
    privacyPolicyUrl: 'https://flamingo.ai/privacy',
  },
} satisfies Meta<typeof WaitlistForm>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Default waitlist form with all defaults.
 */
export const Default: Story = {};

/**
 * With a pre-filled email address.
 */
export const WithDefaultEmail: Story = {
  args: {
    defaultEmail: 'john@acme-msp.com',
  },
};

/**
 * Generic email domain warning (gmail.com triggers it).
 */
export const GenericEmailWarning: Story = {
  args: {
    defaultEmail: 'user@gmail.com',
  },
};

/**
 * Submitting state — button shows loading spinner.
 */
export const Submitting: Story = {
  args: {
    defaultEmail: 'team@enterprise.io',
    isSubmitting: true,
  },
};

/**
 * Success state — button text changes.
 */
export const Success: Story = {
  args: {
    defaultEmail: 'team@enterprise.io',
    isSuccess: true,
  },
};

/**
 * With privacy policy link in the disclaimer.
 */
export const WithPrivacyPolicy: Story = {
  args: {
    privacyPolicyUrl: 'https://flamingo.ai/privacy',
  },
};

/**
 * Custom labels and hints.
 */
export const CustomLabels: Story = {
  args: {
    submitLabel: 'Join Early Access',
    successLabel: 'Welcome aboard!',
    defaultHint: 'We only use your info to send updates.',
    genericEmailHint: 'Business emails only please.',
    invalidPhoneHint: 'Check your phone number.',
    consentText: 'By signing up, you agree to our terms.',
    privacyPolicyUrl: 'https://example.com/privacy',
  },
};

/**
 * In a narrow container (360px) to test mobile-like layout.
 */
export const NarrowContainer: Story = {
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 360 }}>
        <Story />
        <Toaster />
      </div>
    ),
  ],
};

/**
 * Registration that fails — shows toast.
 */
export const FailingRegistration: Story = {
  args: {
    onRegister: async () => {
      await new Promise((r) => setTimeout(r, 1000));
      throw new Error('Registration failed');
    },
  },
};
