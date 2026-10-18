import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { RemoteDesktopView } from '../components/features/remote-session';
import { MonitorIcon } from '../components/icons-v2-generated';
import RemoteSessionScreen from '../components/product-demo/screens/remote-session';

/**
 * The technician's remote desktop page: the device header with the session
 * controls, the screen and the session chat. The product passes its live
 * canvas as the screen; here it is the fixture's drawing of a desktop.
 */
const meta: Meta<typeof RemoteSessionScreen> = {
  title: 'Features/RemoteDesktopView',
  component: RemoteSessionScreen,
  parameters: { layout: 'fullscreen' },
  decorators: [
    Story => (
      <div className="ods-content-area h-[720px] bg-ods-bg">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof meta>;

/** A connected session with the chat open beside the screen. */
export const Default: Story = {};

/** The narrow rendering: the screen alone, the chat closed. */
export const Compact: Story = { args: { compact: true } };

const noop = () => {};

/** Two separate displays: the monitor selector is the full-width row under the device row (Figma 2155:109503). */
export const TwoDisplays: Story = {
  render: () => (
    <div className="flex h-full flex-col bg-ods-bg">
      <div className="h-[var(--spacing-system-l)] flex-shrink-0" />
      <div className="min-h-0 flex-1">
        <RemoteDesktopView
          deviceName="FRONT-DESK-01"
          organizationName="Northwind Dental"
          currentDisplayLabel="Display 1"
          displayMenuGroups={[
            {
              items: [1, 2].map(id => ({
                id: `display-${id}`,
                label: `Display ${id}`,
                icon: <MonitorIcon className="h-6 w-6" />,
                onClick: noop,
              })),
            },
          ]}
          actionsMenuGroups={[]}
          onEnterFullscreen={noop}
          onExitFullscreen={noop}
          onOpenSettings={noop}
          screen={<div className="absolute inset-0 bg-ods-bg-surface" />}
        />
      </div>
    </div>
  ),
};
