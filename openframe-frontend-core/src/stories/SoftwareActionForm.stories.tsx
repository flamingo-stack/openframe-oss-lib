import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { useState } from 'react';
import {
  DEFAULT_SOFTWARE_UPDATE_SETTINGS,
  PackageSearchFieldPlaceholder,
  SoftwareActionForm,
  SoftwareUpdateSettingsFields,
  type SoftwareUpdateSettingsValues,
} from '../components/features/software';
import { SOFTWARE_DEMO_TIMING } from '../components/product-demo/fixtures/software-update';
import SoftwareUpdateScreen from '../components/product-demo/screens/software-update';

const meta: Meta<typeof SoftwareActionForm> = {
  title: 'Features/SoftwareActionForm',
  component: SoftwareActionForm,
  parameters: { layout: 'fullscreen' },
  decorators: [
    Story => (
      <div className="ods-content-area bg-ods-bg">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof meta>;

/** Update Software as the fixture fills it: one package, scheduled, two devices selected. */
export const Default: Story = { render: () => <SoftwareUpdateScreen /> };

/** The narrow rendering: the picker without its customer column. */
export const Compact: Story = {
  render: () => (
    <div className="max-w-[640px]">
      <SoftwareUpdateScreen compact />
    </div>
  ),
};

/** Install Software as it opens: one empty row, run now, and the slots a host has not filled. */
export const EmptyInstall: Story = {
  args: {
    action: 'INSTALL',
    onBack: () => {},
    onSubmit: () => {},
    submitDisabled: true,
    timing: SOFTWARE_DEMO_TIMING,
    initialValues: { timeReference: 'SERVER' },
    renderPackageSearch: () => <PackageSearchFieldPlaceholder />,
    renderDevicePicker: () => <p className="text-ods-text-secondary text-h4">The host's device picker goes here.</p>,
  },
};

/** Update Software as it opens: "Update Settings" with the server's defaults between the timing and the devices. */
export const EmptyUpdate: Story = {
  args: { ...EmptyInstall.args, action: 'UPDATE' },
};

/** "Update Settings" on its own, auto-updates set separately (design 1034:8173). */
export const UpdateSettingsSeparateAutoUpdate: Story = {
  render: () => {
    const [value, setValue] = useState<SoftwareUpdateSettingsValues>({
      ...DEFAULT_SOFTWARE_UPDATE_SETTINGS,
      sameForAutoUpdate: false,
    });
    return (
      <div className="p-[var(--spacing-system-l)]">
        <SoftwareUpdateSettingsFields value={value} onChange={setValue} />
      </div>
    );
  },
};
