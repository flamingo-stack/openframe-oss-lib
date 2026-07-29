import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { fn } from 'storybook/test';

import { TimeTrackerProvider } from '../components/features/time-tracker';
import { AppHeader } from '../components/navigation/app-header';

const trackerCallbacks = {
  onSelectedTicketChange: fn(),
  onNotesChange: fn(),
  onStart: fn(),
  onPause: fn(),
  onResume: fn(),
  onCancel: fn(),
  onSubmit: fn(),
};

const meta = {
  title: 'Navigation/AppHeader',
  component: AppHeader,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'Console top bar built on the unified `TopNavigation` shell (Figma 2797-5978): 48px mobile / 56px md+, ' +
          'cell model with per-cell dividers. Cells left→right: burger + logo (mobile only), global search (md+), ' +
          'organizations filter (lg+), time tracker, notifications, user menu (md+), Mingo AI. ' +
          'Resize the viewport across 800px / 1280px to see the responsive arrangement.',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    isMobileMenuOpen: false,
    onToggleMobileMenu: fn(),
  },
  decorators: [
    Story => (
      <div style={{ minHeight: '50vh', backgroundColor: 'var(--ods-bg)' }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof AppHeader>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Everything the console mounts: search, organizations filter, notifications,
 * user menu and the Mingo AI launcher.
 */
export const Default: Story = {
  args: {
    showSearch: true,
    onSearch: fn(),
    showOrganizations: true,
    organizations: [
      { id: '1', name: 'Acme Corp' },
      { id: '2', name: 'Globex' },
    ],
    selectedOrgId: '1',
    onOrgChange: fn(),
    showNotifications: true,
    unreadCount: 3,
    showUser: true,
    userName: 'Jane Doe',
    userEmail: 'jane@example.com',
    onProfile: fn(),
    onLogout: fn(),
    showMingoAI: true,
    onMingoAI: fn(),
  },
};

/**
 * Minimal bar — no search or organizations, so the center zone is just the
 * spacer pushing the action cells right (the current OpenFrame FE setup).
 */
export const Minimal: Story = {
  args: {
    showNotifications: true,
    showUser: true,
    userName: 'Jane Doe',
    userEmail: 'jane@example.com',
    showMingoAI: true,
    onMingoAI: fn(),
  },
};

/**
 * Idle time tracker: a square icon cell, same footprint as the other cells.
 */
export const WithTimeTrackerIdle: Story = {
  args: {
    ...Minimal.args,
    showTimeTracker: true,
  },
  render: args => (
    <TimeTrackerProvider
      status="ready"
      ticketOptions={[]}
      selectedTicketId={null}
      notes=""
      lastEntries={[]}
      {...trackerCallbacks}
    >
      <AppHeader {...args} />
    </TimeTrackerProvider>
  ),
};

/**
 * Active time tracker per the ODS spec: on mobile the cell keeps its square
 * icon-only footprint (accent icon, no digits); from md up it becomes a fixed
 * 144px cell with the live mono clock.
 */
export const WithTimeTrackerActive: Story = {
  args: {
    ...Minimal.args,
    showTimeTracker: true,
  },
  render: args => (
    <TimeTrackerProvider
      status="tracking"
      runningSince={Date.now() - 4_000}
      accumulatedMs={0}
      ticketOptions={[]}
      selectedTicketId={null}
      notes=""
      lastEntries={[]}
      {...trackerCallbacks}
    >
      <AppHeader {...args} />
    </TimeTrackerProvider>
  ),
};

/**
 * Disabled (subscription-lock) state: every cell is dimmed and inert except
 * the mobile burger toggle.
 */
export const Disabled: Story = {
  args: {
    ...Default.args,
    disabled: true,
  },
};
