import type { Meta, StoryObj } from '@storybook/nextjs-vite';
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
