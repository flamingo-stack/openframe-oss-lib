import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { useEffect, useRef } from 'react';
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
    termsOfServiceUrl: 'https://flamingo.ai/terms',
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
 * Custom labels and hints.
 */
export const CustomLabels: Story = {
  args: {
    submitLabel: 'Join Early Access',
    successLabel: 'Welcome aboard!',
    smsCheckboxLabel: 'Notify me via SMS',
    genericEmailHint: 'Business emails only please.',
    invalidPhoneHint: 'Check your phone number.',
    consentText: 'By signing up, you agree to our terms.',
    privacyPolicyUrl: 'https://example.com/privacy',
    termsOfServiceUrl: 'https://example.com/terms',
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

/**
 * Flamingo theme (pink accent) with checkbox error state.
 * Phone is pre-filled and submit is auto-triggered to show the error.
 */
export const FlamingoWithCheckboxError: Story = {
  args: {
    defaultEmail: 'user@msp-company.com',
    defaultPhone: '5551234567',
    onRegister: async () => {
      await new Promise((r) => setTimeout(r, 1500));
    },
  },
  decorators: [
    (Story) => (
      <div data-app-type="flamingo">
        <Story />
        <Toaster />
      </div>
    ),
  ],
  render: function FlamingoError(args) {
    const ref = useRef<HTMLDivElement>(null);
    useEffect(() => {
      const btn = ref.current?.querySelector('button');
      btn?.click();
    }, []);
    return (
      <div ref={ref}>
        <WaitlistForm {...args} />
      </div>
    );
  },
};
