import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import * as React from 'react';
import { Button } from '../components/ui/button';
import {
  NotificationDrawer,
  NotificationTile,
  NotificationsProvider,
  useNotifications,
  type Notification,
  type NotificationVariant,
} from '../components/features/notifications';
import { Toaster } from '../components/ui/toaster';

const meta = {
  title: 'Features/NotificationDrawer',
  component: NotificationTile,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Right-side drawer that displays toast-style notification tiles. Mount `<NotificationsProvider>` once at the app root and call `useNotifications().addNotification(...)` from any realtime source. The bell button in `AppHeader` toggles the drawer automatically.',
      },
    },
  },
} satisfies Meta<typeof NotificationTile>;

export default meta;
type Story = StoryObj<typeof meta>;

const SEED: Notification[] = [
  {
    id: 'seed-1',
    variant: 'success',
    title: 'Device Deployment Complete',
    description: 'HP EliteBook deployed to Marketing Dept',
    createdAt: Date.now() - 1_000 * 30,
    read: false,
  },
  {
    id: 'seed-2',
    variant: 'success',
    title: 'Device Deployment Complete',
    description: 'HP EliteBook deployed to Marketing Dept',
    createdAt: Date.now() - 1_000 * 60 * 5,
    read: false,
  },
  {
    id: 'seed-3',
    variant: 'error',
    title: 'Policy Violation Detected',
    description: 'USB storage device connected to ACME-WS01',
    createdAt: Date.now() - 1_000 * 60 * 12,
    read: false,
  },
  {
    id: 'seed-4',
    variant: 'error',
    title: 'Disk Space Check Failed',
    description: 'C: drive at 95% capacity on SRV-DB01',
    createdAt: Date.now() - 1_000 * 60 * 35,
    read: false,
  },
  {
    id: 'seed-5',
    variant: 'success',
    title: 'Script Execution Complete',
    description: 'Windows Update script finished on 45 devices',
    createdAt: Date.now() - 1_000 * 60 * 60,
    read: false,
  },
  {
    id: 'seed-6',
    variant: 'warning',
    title: 'Tech Required',
    description: 'Approval is required to execute the command.',
    createdAt: Date.now() - 1_000 * 60 * 60 * 2,
    read: false,
  },
];

function AutoOpen() {
  const { open } = useNotifications();
  React.useEffect(() => {
    open();
  }, [open]);
  return null;
}

/**
 * Static preview of every tile variant — settled (non-live) state.
 */
export const AllTileVariants: Story = {
  render: () => {
    const base = { createdAt: Date.now() - 60_000, read: true } as const;
    return (
      <div className="flex max-w-md flex-col gap-2">
        <NotificationTile
          notification={{
            id: 't-default',
            variant: 'default',
            title: 'Heads up',
            description: 'Neutral notification, no specific status.',
            ...base,
          }}
          onComplete={() => {}}
        />
        <NotificationTile
          notification={{
            id: 't-success',
            variant: 'success',
            title: 'Device Deployment Complete',
            description: 'HP EliteBook deployed to Marketing Dept',
            ...base,
          }}
          onComplete={() => {}}
        />
        <NotificationTile
          notification={{
            id: 't-error',
            variant: 'error',
            title: 'Policy Violation Detected',
            description: 'USB storage device connected to ACME-WS01',
            ...base,
          }}
          onComplete={() => {}}
        />
        <NotificationTile
          notification={{
            id: 't-warning',
            variant: 'warning',
            title: 'Tech Required',
            description: 'Approval is required to execute the command.',
            ...base,
          }}
          onComplete={() => {}}
        />
        <NotificationTile
          notification={{
            id: 't-info',
            variant: 'info',
            title: 'Update available',
            description: 'A new agent version is ready to install.',
            ...base,
          }}
          onComplete={() => {}}
        />
      </div>
    );
  },
};

/**
 * A freshly-arrived tile shows a progress bar and a dismiss X for ~4 seconds,
 * then settles into the resting "complete" state with the check-circle button.
 */
export const LiveTile: Story = {
  render: function LiveTileRender() {
    const [tick, setTick] = React.useState(0);
    return (
      <div className="flex max-w-md flex-col gap-3">
        <NotificationTile
          key={tick}
          notification={{
            id: 'live-tile',
            variant: 'success',
            title: 'Device Deployment Complete',
            description: 'HP EliteBook deployed to Marketing Dept',
            createdAt: Date.now(),
            read: false,
          }}
          onComplete={() => {}}
        />
        <Button variant="outline" onClick={() => setTick((t) => t + 1)}>
          Replay live progress
        </Button>
      </div>
    );
  },
};

/**
 * Drawer rendered with the empty state.
 */
export const DrawerEmpty: Story = {
  render: () => (
    <NotificationsProvider>
      <AutoOpen />
      <NotificationDrawer />
      <p className="text-h6 text-ods-text-secondary">
        Drawer opens automatically. Close it with Esc or by clicking the overlay.
      </p>
    </NotificationsProvider>
  ),
};

/**
 * Drawer pre-seeded to mirror the Figma reference, with the toggle row and the
 * history button wired.
 */
export const DrawerWithSeedData: Story = {
  render: function DrawerWithSeedDataRender() {
    return (
      <NotificationsProvider
        initialNotifications={SEED}
        onHistoryClick={() => alert('Navigate to /notifications')}
        onShowPopupsChange={(v) => console.log('showPopups →', v)}
      >
        <AutoOpen />
        <NotificationDrawer />
        <p className="text-h6 text-ods-text-secondary">
          Six seeded notifications matching the Figma reference.
        </p>
      </NotificationsProvider>
    );
  },
};

/**
 * Live playground — fire notifications from outside the drawer the same way a
 * NATS subscription would. The drawer reflects every change in real time.
 */
export const LivePlayground: Story = {
  render: () => (
    <NotificationsProvider onHistoryClick={() => alert('Navigate to /notifications')}>
      <AutoOpen />
      <NotificationDrawer />
      <PlaygroundControls />
      <Toaster />
    </NotificationsProvider>
  ),
};

function PlaygroundControls() {
  const { addNotification, markAllRead, clear, toggle, notifications, unreadCount, showPopups } =
    useNotifications();

  const fire = (variant: NotificationVariant, title: string, description: string) => {
    addNotification({ variant, title, description });
  };

  return (
    <div className="flex max-w-2xl flex-col gap-4">
      <div className="rounded-md border border-ods-border bg-ods-card p-3">
        <p className="text-h3 text-ods-text-primary">Playground</p>
        <p className="text-h6 text-ods-text-secondary">
          {notifications.length} total · {unreadCount} unread · pop-ups{' '}
          {showPopups ? 'on' : 'off'}
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          variant="success"
          onClick={() =>
            fire('success', 'Device Deployment Complete', 'HP EliteBook deployed to Marketing Dept')
          }
        >
          Fire success
        </Button>
        <Button
          variant="destructive"
          onClick={() =>
            fire('error', 'Policy Violation Detected', 'USB storage device connected to ACME-WS01')
          }
        >
          Fire error
        </Button>
        <Button
          variant="warning"
          onClick={() => fire('warning', 'Tech Required', 'Approval is required to execute the command.')}
        >
          Fire warning
        </Button>
        <Button
          variant="info"
          onClick={() => fire('info', 'Update available', 'A new agent version is ready to install.')}
        >
          Fire info
        </Button>
        <Button
          variant="outline"
          onClick={() => fire('default', 'Heads up', 'Neutral notification without a specific status.')}
        >
          Fire default
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button variant="outline" onClick={toggle}>
          Toggle drawer
        </Button>
        <Button variant="outline" onClick={markAllRead} disabled={unreadCount === 0}>
          Mark all read
        </Button>
        <Button variant="outline" onClick={clear} disabled={notifications.length === 0}>
          Clear all
        </Button>
      </div>
    </div>
  );
}
