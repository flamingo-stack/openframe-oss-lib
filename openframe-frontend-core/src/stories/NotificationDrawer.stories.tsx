import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import * as React from 'react';
import { Button } from '../components/ui/button';
import { BracketCurlyIcon } from '../components/icons-v2-generated/coding/bracket-curly-icon';
import { MonitorIcon } from '../components/icons-v2-generated/devices/monitor-icon';
import { AlertTriangleIcon } from '../components/icons-v2-generated/interface/alert-triangle-icon';
import { BannedIcon } from '../components/icons-v2-generated/security/banned-icon';
import { UserPlusIcon } from '../components/icons-v2-generated/users/user-plus-icon';
import {
  ADMIN_APPROVAL_REQUEST_CONTEXT_TYPE,
  ApprovalRequestNotificationTile,
  NotificationDrawer,
  NotificationPopups,
  NotificationTile,
  NotificationsProvider,
  isApprovalNotification,
  useNotifications,
  type Notification,
  type NotificationVariant,
  type RenderNotificationTile,
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
  args: {
    notification: {
      id: 'preview',
      variant: 'default',
      title: 'Preview',
      description: 'Preview notification',
      createdAt: 0,
      read: true,
    },
    onComplete: () => {},
  },
} satisfies Meta<typeof NotificationTile>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Inline avatar stand-in so the image slot renders without network access. */
const CUSTOMER_AVATAR =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32"><rect width="32" height="32" fill="#5EFC8D"/><circle cx="16" cy="12" r="6" fill="#212121"/><path d="M4 32c0-6.6 5.4-12 12-12s12 5.4 12 12" fill="#212121"/></svg>',
  );

/** Seed an approval-request notification in a given resolution state. */
const approvalSeed = (
  n: number,
  resolution: string | null,
  resolvedByName: string | null,
  minutesAgo: number,
): Notification => ({
  id: `seed-approval-${n}`,
  variant: 'warning',
  title: 'Clear stuck print queue',
  description: 'Mingo wants to restart the Spooler service on SRV-PRINT01.',
  createdAt: Date.now() - 1_000 * 60 * minutesAgo,
  read: false,
  meta: {
    contextType: ADMIN_APPROVAL_REQUEST_CONTEXT_TYPE,
    approvalRequestId: `seed-req-${n}`,
    approvalType: 'ADMIN',
    resolution,
    resolvedByName,
    toolCalls: [
      {
        toolExecutionRequestId: `seed-ter-${n}`,
        toolName: 'run_command',
        toolTitle: 'Restart print spooler',
        toolType: 'OPENFRAME_RMM',
        toolExplanation: 'Restarts the Spooler service to clear a stuck print queue.',
        requiresApproval: true,
        toolCallArguments: { command: 'Restart-Service -Name Spooler -Force' },
      },
    ],
  },
});

const SEED: Notification[] = [
  {
    id: 'seed-1',
    severity: 'INFO',
    type: 'New Customer Created',
    imageUrl: CUSTOMER_AVATAR,
    title: 'Acme Corp',
    description: 'Added by John Smith',
    createdAt: Date.now() - 1_000 * 30,
    read: false,
  },
  approvalSeed(1, null, null, 2),
  {
    id: 'seed-2',
    variant: 'success',
    type: 'Device Deployment Complete',
    icon: <MonitorIcon size={16} />,
    title: 'HP EliteBook',
    description: 'Deployed to Marketing Dept',
    createdAt: Date.now() - 1_000 * 60 * 5,
    read: false,
  },
  {
    id: 'seed-3',
    severity: 'DANGER',
    type: 'Policy Violation Detected',
    icon: <BannedIcon size={16} />,
    title: 'ACME-WS01',
    description: 'USB storage device connected',
    createdAt: Date.now() - 1_000 * 60 * 12,
    read: false,
  },
  {
    id: 'seed-4',
    severity: 'WARNING',
    type: 'Disk Space Check Failed',
    icon: <AlertTriangleIcon size={16} />,
    title: 'SRV-DB01',
    description: 'C: drive at 95% capacity',
    createdAt: Date.now() - 1_000 * 60 * 35,
    read: false,
  },
  approvalSeed(2, 'APPROVED', 'John Smith', 45),
  {
    id: 'seed-5',
    variant: 'success',
    type: 'Script Execution Complete',
    icon: <BracketCurlyIcon size={16} />,
    title: 'Windows Update',
    description: 'Script finished on 45 devices',
    createdAt: Date.now() - 1_000 * 60 * 60,
    read: false,
  },
  approvalSeed(3, 'REJECTED', 'Jane Doe', 90),
  {
    id: 'seed-6',
    variant: 'warning',
    title: 'Tech Required',
    description: 'Approval is required to execute the command.',
    createdAt: Date.now() - 1_000 * 60 * 60 * 2,
    read: false,
  },
  approvalSeed(4, 'CANCELLED', null, 180),
];

function AutoOpen() {
  const { open } = useNotifications();
  React.useEffect(() => {
    open();
  }, [open]);
  return null;
}

/**
 * Static preview of every tile variant — settled (non-live) state. The `type`
 * header label picks up the variant color; tiles without an icon/image fall
 * back to the severity dot in the header slot.
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
            type: 'System Notice',
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
            type: 'Device Deployment Complete',
            title: 'HP EliteBook',
            description: 'Deployed to Marketing Dept',
            ...base,
          }}
          onComplete={() => {}}
        />
        <NotificationTile
          notification={{
            id: 't-error',
            variant: 'error',
            type: 'Policy Violation Detected',
            title: 'ACME-WS01',
            description: 'USB storage device connected',
            ...base,
          }}
          onComplete={() => {}}
        />
        <NotificationTile
          notification={{
            id: 't-warning',
            variant: 'warning',
            type: 'Approval Required',
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
            type: 'Agent Update',
            title: 'Update available',
            description: 'A new agent version is ready to install.',
            ...base,
          }}
          onComplete={() => {}}
        />
        <NotificationTile
          notification={{
            id: 't-legacy',
            variant: 'default',
            title: 'Legacy notification',
            description: 'No type, icon or image — header shows the dot fallback.',
            ...base,
          }}
          onComplete={() => {}}
        />
      </div>
    );
  },
};

/**
 * The new header fields: `severity` colors the type label and icon slot
 * (INFO grey, WARNING amber, DANGER red) and overrides `variant`; `imageUrl`
 * wins over `icon`, which wins over the dot fallback.
 */
export const SeverityIconAndImage: Story = {
  render: () => {
    const base = { createdAt: Date.now() - 60_000, read: true } as const;
    return (
      <div className="flex max-w-md flex-col gap-2">
        <NotificationTile
          notification={{
            id: 's-image',
            severity: 'INFO',
            type: 'New Customer Created',
            imageUrl: CUSTOMER_AVATAR,
            title: 'Acme Corp',
            description: 'Added by John Smith',
            ...base,
          }}
          onComplete={() => {}}
        />
        <NotificationTile
          notification={{
            id: 's-icon-info',
            severity: 'INFO',
            type: 'New User Invited',
            icon: <UserPlusIcon size={16} />,
            title: 'jane.doe@acme.com',
            description: 'Invited by John Smith',
            ...base,
          }}
          onComplete={() => {}}
        />
        <NotificationTile
          notification={{
            id: 's-icon-warning',
            severity: 'WARNING',
            type: 'Disk Space Warning',
            icon: <AlertTriangleIcon size={16} />,
            title: 'SRV-DB01',
            description: 'C: drive at 85% capacity',
            ...base,
          }}
          onComplete={() => {}}
        />
        <NotificationTile
          notification={{
            id: 's-icon-danger',
            severity: 'DANGER',
            type: 'Policy Violation Detected',
            icon: <BannedIcon size={16} />,
            title: 'ACME-WS01',
            description: 'USB storage device connected',
            ...base,
          }}
          onComplete={() => {}}
        />
        <NotificationTile
          notification={{
            id: 's-dot-danger',
            severity: 'DANGER',
            type: 'Agent Offline',
            title: 'ACME-WS07',
            description: 'No icon configured — severity dot fallback.',
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
            severity: 'INFO',
            type: 'New Customer Created',
            imageUrl: CUSTOMER_AVATAR,
            title: 'Acme Corp',
            description: 'Added by John Smith',
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
 * history button wired. Includes approval-request notifications in every
 * resolution state: pending (buttons), approved, rejected and cancelled
 * (status tag + resolver name in place of the buttons).
 */
export const DrawerWithSeedData: Story = {
  render: function DrawerWithSeedDataRender() {
    return (
      <NotificationsProvider
        initialNotifications={SEED}
        onHistoryClick={() => alert('Navigate to /notifications')}
        historyHref="/notifications"
        onShowPopupsChange={(v) => console.log('showPopups →', v)}
        renderTile={renderApprovalTile}
      >
        <AutoOpen />
        <NotificationDrawer />
        <p className="text-h6 text-ods-text-secondary">
          Seeded notifications matching the Figma reference, including approvals
          in all four resolution states.
        </p>
      </NotificationsProvider>
    );
  },
};

/**
 * Live playground — fire notifications from outside the drawer the same way a
 * NATS subscription would. New notifications surface as top-right pop-ups
 * (toast-style) via `<NotificationPopups>`; opening the drawer hides them so
 * the same tile isn't shown twice. Toggle "Show Notifications" inside the
 * drawer to disable pop-ups entirely.
 */
/** A deliberately long script so the command section overflows and scrolls. */
const LONG_POWERSHELL = [
  '# Full diagnostic bundle — collect logs, configs and telemetry',
  '$ErrorActionPreference = "Stop"',
  '$stamp = Get-Date -Format "yyyyMMdd_HHmmss"',
  '$out = "C:\\Logs\\diag_$stamp"',
  'New-Item -ItemType Directory -Path $out -Force | Out-Null',
  '',
  'Write-Host "Collecting event logs..."',
  'foreach ($log in "System","Application","Security","Setup") {',
  '  wevtutil epl $log "$out\\$log.evtx"',
  '}',
  '',
  'Write-Host "Collecting installed software..."',
  'Get-ItemProperty HKLM:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\* |',
  '  Select-Object DisplayName, DisplayVersion, Publisher, InstallDate |',
  '  Sort-Object DisplayName |',
  '  Export-Csv "$out\\software.csv" -NoTypeInformation',
  '',
  'Write-Host "Collecting running services and processes..."',
  'Get-Service | Export-Csv "$out\\services.csv" -NoTypeInformation',
  'Get-Process | Select-Object Name, Id, CPU, WorkingSet | Export-Csv "$out\\processes.csv" -NoTypeInformation',
  '',
  'Write-Host "Collecting network configuration..."',
  'ipconfig /all > "$out\\ipconfig.txt"',
  'Get-NetTCPConnection | Export-Csv "$out\\connections.csv" -NoTypeInformation',
  '',
  'Write-Host "Compressing bundle..."',
  'Compress-Archive -Path "$out\\*" -DestinationPath "$out.zip" -Force',
  'Remove-Item -Path $out -Recurse -Force',
  'Write-Host "Diagnostic bundle ready at $out.zip"',
].join('\n');

/**
 * Renders approval-request notifications with the dedicated
 * `ApprovalRequestNotificationTile` (collapsible command section + Approve /
 * Reject), falling back to the default tile for everything else.
 */
const renderApprovalTile: RenderNotificationTile = (n, { onComplete, onSettle, liveDurationMs }) => {
  if (!isApprovalNotification(n)) return undefined;
  return (
    <ApprovalRequestNotificationTile
      notification={n}
      onApprove={(id) => alert(`Approved ${id}`)}
      onReject={(id) => alert(`Rejected ${id}`)}
      onComplete={onComplete}
      onSettle={onSettle}
      liveDurationMs={liveDurationMs}
    />
  );
};

export const LivePlayground: Story = {
  render: () => (
    <NotificationsProvider
      onHistoryClick={() => alert('Navigate to /notifications')}
      historyHref="/notifications"
      renderTile={renderApprovalTile}
    >
      <NotificationDrawer />
      <NotificationPopups />
      <PlaygroundControls />
      <Toaster />
    </NotificationsProvider>
  ),
};

function PlaygroundControls() {
  const { addNotification, markAllRead, clear, toggle, notifications, unreadCount, showPopups } =
    useNotifications();
  const approvalSeq = React.useRef(0);

  const fire = (
    variant: NotificationVariant,
    title: string,
    description: string,
    extra?: Partial<Pick<Notification, 'type' | 'icon' | 'imageUrl' | 'severity'>>,
  ) => {
    addNotification({ variant, title, description, ...extra });
  };

  const fireWithDeepLink = () => {
    addNotification({
      variant: 'success',
      title: 'Script Execution Complete',
      description: 'Click to view run details for SRV-DB01',
      onClick: () => alert('Navigate to /scripts/runs/abc-123'),
    });
  };

  const fireApproval = (
    title: string,
    description: string,
    toolCalls: Array<Record<string, unknown>>,
  ) => {
    const n = approvalSeq.current++;
    addNotification({
      variant: 'warning',
      title,
      description,
      meta: {
        contextType: ADMIN_APPROVAL_REQUEST_CONTEXT_TYPE,
        approvalRequestId: `req-${n}`,
        approvalType: 'ADMIN',
        toolCalls: toolCalls.map((tc, i) => ({
          toolExecutionRequestId: `ter-${n}-${i}`,
          requiresApproval: true,
          ...tc,
        })),
      },
    });
  };

  const fireSingleApproval = () =>
    fireApproval('Tech Required', 'Approval is required to execute the command.', [
      {
        toolName: 'run_command',
        toolTitle: 'Run PowerShell command',
        toolType: 'OPENFRAME_RMM',
        toolExplanation:
          'Collects all events from System, Application, and Security logs for today and exports them to a CSV file at C:\\Logs\\today_logs.csv.',
        toolCallArguments: {
          command:
            '$today = (Get-Date).Date\n$logs = Get-WinEvent -FilterHashtable @{ LogName = "System","Application","Security"; StartTime = $today }\n$logs | Export-Csv -Path "C:\\Logs\\today_logs.csv" -NoTypeInformation',
        },
      },
    ]);

  const fireBatchApproval = () =>
    fireApproval('Multiple actions need approval', 'Mingo wants to run 3 commands on SRV-DB01.', [
      {
        toolName: 'run_command',
        toolTitle: 'Restart print spooler',
        toolType: 'OPENFRAME_RMM',
        toolExplanation: 'Restarts the Spooler service to clear a stuck print queue.',
        toolCallArguments: { command: 'Restart-Service -Name Spooler -Force' },
      },
      {
        toolName: 'run_query',
        toolTitle: 'Query disk usage',
        toolType: 'OPENFRAME',
        toolExplanation: 'Reports free space per logical volume.',
        toolCallArguments: { query: 'SELECT device_id, free_space, size FROM logical_drives;' },
      },
      {
        toolName: 'run_command',
        toolTitle: 'Purge stale temp files',
        toolType: 'OPENFRAME_RMM',
        toolExplanation: 'Deletes %TEMP% contents older than 7 days to reclaim space.',
        toolCallArguments: {
          command:
            'Get-ChildItem $env:TEMP -Recurse | Where-Object { $_.LastWriteTime -lt (Get-Date).AddDays(-7) } | Remove-Item -Force -Recurse -ErrorAction SilentlyContinue',
        },
      },
    ]);

  const fireLongApproval = () =>
    fireApproval('Tech Required', 'Approval is required to run a diagnostic script.', [
      {
        toolName: 'run_script',
        toolTitle: 'Run full diagnostic bundle',
        toolType: 'OPENFRAME_RMM',
        toolExplanation:
          'Collects event logs, installed software, services, processes and network configuration, then compresses everything into a single uploadable archive.',
        toolCallArguments: { script: LONG_POWERSHELL },
      },
    ]);

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
          variant="accent"
          onClick={() =>
            fire('success', 'HP EliteBook', 'Deployed to Marketing Dept', {
              type: 'Device Deployment Complete',
            })
          }
        >
          Fire success
        </Button>
        <Button
          variant="destructive"
          onClick={() =>
            fire('error', 'ACME-WS01', 'USB storage device connected', {
              type: 'Policy Violation Detected',
              severity: 'DANGER',
              icon: <BannedIcon size={16} />,
            })
          }
        >
          Fire danger + icon
        </Button>
        <Button
          variant="outline"
          onClick={() =>
            fire('warning', 'Tech Required', 'Approval is required to execute the command.', {
              type: 'Approval Required',
              severity: 'WARNING',
              icon: <AlertTriangleIcon size={16} />,
            })
          }
        >
          Fire warning + icon
        </Button>
        <Button
          variant="transparent"
          onClick={() =>
            fire('info', 'Update available', 'A new agent version is ready to install.', {
              type: 'Agent Update',
            })
          }
        >
          Fire info
        </Button>
        <Button
          variant="outline"
          onClick={() =>
            fire('info', 'Acme Corp', 'Added by John Smith', {
              type: 'New Customer Created',
              severity: 'INFO',
              imageUrl: CUSTOMER_AVATAR,
            })
          }
        >
          Fire with image
        </Button>
        <Button
          variant="outline"
          onClick={() => fire('default', 'Heads up', 'Neutral notification without a specific status.')}
        >
          Fire default
        </Button>
        <Button variant="outline" onClick={fireWithDeepLink}>
          Fire with deep-link
        </Button>
        <Button variant="warning" onClick={fireSingleApproval}>
          Fire approval
        </Button>
        <Button variant="warning" onClick={fireBatchApproval}>
          Fire batch approval
        </Button>
        <Button variant="warning" onClick={fireLongApproval}>
          Fire long-command approval
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
