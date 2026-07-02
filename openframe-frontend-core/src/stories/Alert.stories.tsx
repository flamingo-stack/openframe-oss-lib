import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { AlertTriangleIcon } from '../components/icons-v2-generated/interface/alert-triangle-icon';
import { Alert, AlertDescription, AlertTitle } from '../components/ui/alert';

const meta = {
  title: 'UI/Alert',
  component: Alert,
  argTypes: {
    variant: {
      control: 'select',
      options: ['default', 'destructive', 'warning'],
    },
  },
} satisfies Meta<typeof Alert>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { variant: 'default' },
  render: args => (
    <Alert {...args}>
      <AlertTitle>Heads up!</AlertTitle>
      <AlertDescription>You can add components to your app using the CLI.</AlertDescription>
    </Alert>
  ),
};

export const Destructive: Story = {
  args: { variant: 'destructive' },
  render: args => (
    <Alert {...args}>
      <AlertTitle>Error</AlertTitle>
      <AlertDescription>Your session has expired. Please log in again.</AlertDescription>
    </Alert>
  ),
};

export const Warning: Story = {
  args: { variant: 'warning' },
  render: args => (
    <Alert {...args}>
      <AlertTitle>Warning</AlertTitle>
      <AlertDescription>Some of your settings need attention.</AlertDescription>
    </Alert>
  ),
};

/**
 * Real-world usage: the Settings page email-verification banner.
 * Mirrors the Figma design — warning variant, alert-triangle icon, message and a resend action.
 */
export const EmailVerification: Story = {
  args: { variant: 'warning' },
  render: args => (
    <Alert {...args} className="flex items-center justify-center gap-[var(--spacing-system-m)] p-[var(--spacing-system-s)]">
      <span className="shrink-0">
        <AlertTriangleIcon size={24} />
      </span>
      <p className="flex-1 text-h4 font-bold">Verify your email to keep access to system.</p>
      <button type="button" className="shrink-0 text-h4 font-medium underline whitespace-nowrap">
        Resend Verification Mail
      </button>
    </Alert>
  ),
};

export const AllVariants: Story = {
  args: { variant: 'default' },
  render: () => (
    <div className="flex flex-col gap-4">
      <Alert variant="default">
        <AlertTitle>Default</AlertTitle>
        <AlertDescription>Neutral informational alert.</AlertDescription>
      </Alert>
      <Alert variant="destructive">
        <AlertTitle>Destructive</AlertTitle>
        <AlertDescription>Something went wrong.</AlertDescription>
      </Alert>
      <Alert variant="warning">
        <AlertTitle>Warning</AlertTitle>
        <AlertDescription>Proceed with caution.</AlertDescription>
      </Alert>
    </div>
  ),
};
