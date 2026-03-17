import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { PhoneInput } from '../components/ui/phone-input';
import { useState } from 'react';
import type { CountryCode } from 'libphonenumber-js';

const meta = {
  title: 'UI/PhoneInput',
  component: PhoneInput,
  parameters: {
    layout: 'padded',
  },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 480 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof PhoneInput>;

export default meta;
type Story = StoryObj<typeof meta>;

function PhoneInputControlled(props: Partial<React.ComponentProps<typeof PhoneInput>>) {
  const [phone, setPhone] = useState(props.value ?? '');
  const [country, setCountry] = useState<CountryCode>(props.countryCode ?? 'US');
  const [isInvalid, setIsInvalid] = useState(false);

  return (
    <div className="flex flex-col gap-2">
      <PhoneInput
        value={phone}
        countryCode={country}
        onPhoneChange={setPhone}
        onCountryChange={setCountry}
        onValidationChange={setIsInvalid}
        {...props}
      />
      {isInvalid && (
        <p className="text-sm text-[var(--ods-attention-yellow-warning)]">Invalid phone number</p>
      )}
    </div>
  );
}

/**
 * Default phone input with US country code.
 */
export const Default: Story = {
  args: {
    value: '',
    countryCode: 'US',
    onPhoneChange: () => {},
    onCountryChange: () => {},
  },
  render: () => <PhoneInputControlled />,
};

/**
 * Phone input with UK country code.
 */
export const UnitedKingdom: Story = {
  args: {
    value: '',
    countryCode: 'GB',
    onPhoneChange: () => {},
    onCountryChange: () => {},
  },
  render: () => <PhoneInputControlled countryCode="GB" />,
};

/**
 * Phone input with a pre-filled value.
 */
export const WithValue: Story = {
  args: {
    value: '(555) 123-4567',
    countryCode: 'US',
    onPhoneChange: () => {},
    onCountryChange: () => {},
  },
  render: () => <PhoneInputControlled value="(555) 123-4567" />,
};

/**
 * Disabled state.
 */
export const Disabled: Story = {
  args: {
    value: '(555) 123-4567',
    countryCode: 'US',
    disabled: true,
    onPhoneChange: () => {},
    onCountryChange: () => {},
  },
  render: () => <PhoneInputControlled value="(555) 123-4567" disabled />,
};

/**
 * Custom placeholder text.
 */
export const CustomPlaceholder: Story = {
  args: {
    value: '',
    countryCode: 'US',
    placeholder: 'Enter phone...',
    onPhoneChange: () => {},
    onCountryChange: () => {},
  },
  render: () => <PhoneInputControlled placeholder="Enter phone..." />,
};

/**
 * In a narrow container (300px) to test overflow handling.
 */
export const NarrowContainer: Story = {
  args: {
    value: '',
    countryCode: 'US',
    onPhoneChange: () => {},
    onCountryChange: () => {},
  },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 300, border: '1px dashed var(--ods-border)', padding: 16 }}>
        <Story />
      </div>
    ),
  ],
  render: () => <PhoneInputControlled />,
};

/**
 * German country code pre-selected.
 */
export const Germany: Story = {
  args: {
    value: '',
    countryCode: 'DE',
    onPhoneChange: () => {},
    onCountryChange: () => {},
  },
  render: () => <PhoneInputControlled countryCode="DE" />,
};
