import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { Button } from '../components/ui/button';
import {
  CommandApprovalToast,
  ToastCard,
  Toaster,
  showCommandApprovalToast,
  showToast,
  type ToastVariant,
} from '../components/ui/toaster';
import { toast } from '../hooks/use-toast';
import { ToolTypeValues } from '../types/tool.types';

const meta = {
  title: 'UI/Toaster',
  component: ToastCard,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Toast notifications built on Sonner with a custom ODS-styled card. Render `<Toaster />` once near your app root, then call `toast({...})` or `showToast({...})` from anywhere.',
      },
    },
  },
  argTypes: {
    variant: {
      control: 'select',
      options: ['default', 'success', 'warning', 'error', 'info'] satisfies ToastVariant[],
    },
    title: { control: 'text' },
    description: { control: 'text' },
    duration: { control: { type: 'number', min: 0, step: 500 } },
    dismissible: { control: 'boolean' },
  },
  args: {
    id: 'preview',
    variant: 'warning',
    title: 'Device Package limit',
    description:
      'Extra devices will be billed at pay-as-you-go rates, charged separately from your plan. Upgrade to lock in a lower device price.',
    duration: 4000,
    dismissible: true,
  },
} satisfies Meta<typeof ToastCard>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Static preview of every variant — no interaction needed.
 */
export const AllVariants: Story = {
  render: () => (
    <div className="flex flex-col gap-3">
      <ToastCard
        id="v-default"
        variant="default"
        title="Heads up"
        description="This is a neutral message without a specific status."
      />
      <ToastCard
        id="v-success"
        variant="success"
        title="Changes saved"
        description="Your settings have been updated successfully."
      />
      <ToastCard
        id="v-warning"
        variant="warning"
        title="Device Package limit"
        description="Extra devices will be billed at pay-as-you-go rates, charged separately from your plan."
      />
      <ToastCard
        id="v-error"
        variant="error"
        title="Payment failed"
        description="We couldn't process your card. Please try a different payment method."
      />
      <ToastCard
        id="v-info"
        variant="info"
        title="Update available"
        description="A new version of the agent is ready to install on 3 devices."
      />
      <ToastCard
        id="v-title-only"
        variant="default"
        title="Title only — no description"
      />
      <ToastCard
        id="v-description-only"
        variant="info"
        description="Description only — no title. Useful for quick status messages that don't need a heading."
      />
      <ToastCard
        id="v-no-close"
        variant="success"
        title="Non-dismissible"
        description="This toast has no close button."
        dismissible={false}
      />
      <ToastCard
        id="v-no-progress"
        variant="info"
        title="Persistent toast"
        description="No progress bar — stays until dismissed."
        duration={Infinity}
      />
    </div>
  ),
};

/**
 * Interactive playground — tweak args to change the preview card.
 */
export const Playground: Story = {
  render: (args) => <ToastCard {...args} />,
};

/**
 * Command approval toast — collapsed state.
 * Shows the toast header with the warning dot, title, description, close
 * button, progress bar, and a "Show Command" toggle to expand details.
 */
export const CommandApprovalCollapsed: Story = {
  render: () => (
    <CommandApprovalToast
      id="cmd-collapsed"
      variant="warning"
      title="Tech Required"
      description="Approval is required to execute the command."
      command={`New-AppLockerPolicy -RuleType Executable -User Everyone -Action Deny -Path "*xx_email.exe"`}
      toolType={ToolTypeValues.FLEET_MDM}
      approvalDescription="Creates organization-wide AppLocker rule to block xx_email.exe process execution on all machines. Prevents the suspicious parent process from running across the entire MSP client environment."
      duration={Infinity}
    />
  ),
};

/**
 * Command approval toast — expanded state.
 * Reveals the command preview with its tool icon and the Approve / Reject
 * action row below the description.
 */
export const CommandApprovalExpanded: Story = {
  render: () => (
    <CommandApprovalToast
      id="cmd-expanded"
      variant="warning"
      title="Tech Required"
      description="Approval is required to execute the command."
      command={`New-AppLockerPolicy -RuleType Executable -User Everyone -Action Deny -Path "*xx_email.exe"`}
      toolType={ToolTypeValues.FLEET_MDM}
      approvalDescription="Creates organization-wide AppLocker rule to block xx_email.exe process execution on all machines. Prevents the suspicious parent process from running across the entire MSP client environment."
      defaultExpanded
      duration={Infinity}
    />
  ),
};

/**
 * Command approval toast rendered once per supported tool to demonstrate
 * the tool-icon mapping.
 */
export const CommandApprovalPerTool: Story = {
  render: () => {
    const tools = [
      { toolType: ToolTypeValues.FLEET_MDM, command: 'fleetctl query --hosts mac-* "SELECT * FROM system_info"' },
      { toolType: ToolTypeValues.TACTICAL_RMM, command: 'tacticalrmm run-script "Reboot Endpoint" --agent all' },
      { toolType: ToolTypeValues.MESHCENTRAL, command: 'meshctrl deviceaction --id <device> --action reset' },
      { toolType: ToolTypeValues.AUTHENTIK, command: 'ak revoke-session --user pavlo@flamingo.cx' },
      { toolType: ToolTypeValues.OSQUERY, command: 'osqueryi "SELECT * FROM processes WHERE name = \'xx_email.exe\'"' },
      { toolType: ToolTypeValues.OPENFRAME, command: 'openframe agent upgrade --tenant acme' },
    ] as const;

    return (
      <div className="flex flex-col gap-3">
        {tools.map((t) => (
          <CommandApprovalToast
            key={t.toolType}
            id={`cmd-${t.toolType}`}
            variant="warning"
            title="Tech Required"
            description="Approval is required to execute the command."
            command={t.command}
            toolType={t.toolType}
            approvalDescription={`Review the ${t.toolType} command and approve or reject execution.`}
            defaultExpanded
            duration={Infinity}
          />
        ))}
      </div>
    );
  },
};

/**
 * Fire the command approval toast as a real Sonner toast.
 */
export const CommandApprovalLive: Story = {
  render: () => (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        <Button
          variant="warning"
          onClick={() =>
            showCommandApprovalToast({
              title: 'Tech Required',
              description: 'Approval is required to execute the command.',
              command: `New-AppLockerPolicy -RuleType Executable -User Everyone -Action Deny -Path "*xx_email.exe"`,
              toolType: ToolTypeValues.FLEET_MDM,
              approvalDescription:
                'Creates organization-wide AppLocker rule to block xx_email.exe process execution on all machines.',
              onApprove: () => toast({ variant: 'success', title: 'Command approved' }),
              onReject: () => toast({ variant: 'error', title: 'Command rejected' }),
            })
          }
        >
          Fire approval toast
        </Button>
        <Button
          variant="warning"
          onClick={() =>
            showCommandApprovalToast({
              title: 'Tech Required',
              description: 'Approval is required to execute the command.',
              command: 'tacticalrmm run-script "Reboot Endpoint" --agent all',
              toolType: ToolTypeValues.TACTICAL_RMM,
              approvalDescription: 'Reboots all endpoints in the organization. Unsaved work will be lost.',
              defaultExpanded: true,
              onApprove: () => toast({ variant: 'success', title: 'Reboot scheduled' }),
              onReject: () => toast({ variant: 'error', title: 'Reboot cancelled' }),
            })
          }
        >
          Fire pre-expanded toast
        </Button>
      </div>

      <Toaster />
    </div>
  ),
};

/**
 * Trigger real toasts via Sonner. Click a button to fire a toast in the
 * bottom-right corner using the actual `toast()` API.
 */
export const LiveTriggers: Story = {
  render: () => (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          onClick={() =>
            toast({
              variant: 'default',
              title: 'Heads up',
              description: 'Just letting you know.',
            })
          }
        >
          Default
        </Button>
        <Button
          variant="success"
          onClick={() =>
            toast({
              variant: 'success',
              title: 'Changes saved',
              description: 'Your settings have been updated.',
            })
          }
        >
          Success
        </Button>
        <Button
          variant="warning"
          onClick={() =>
            toast({
              variant: 'warning',
              title: 'Device Package limit',
              description:
                'Extra devices will be billed at pay-as-you-go rates, charged separately from your plan.',
            })
          }
        >
          Warning
        </Button>
        <Button
          variant="destructive"
          onClick={() =>
            toast({
              variant: 'error',
              title: 'Payment failed',
              description: "We couldn't process your card.",
            })
          }
        >
          Error
        </Button>
        <Button
          variant="info"
          onClick={() =>
            toast({
              variant: 'info',
              title: 'Update available',
              description: 'A new version of the agent is ready.',
            })
          }
        >
          Info
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          onClick={() => showToast({ title: 'Title only — no description' })}
        >
          Title only
        </Button>
        <Button
          variant="outline"
          onClick={() =>
            showToast({
              variant: 'info',
              description: 'Description only — no title.',
            })
          }
        >
          Description only
        </Button>
        <Button
          variant="outline"
          onClick={() =>
            showToast({
              variant: 'success',
              title: 'Non-dismissible',
              description: 'No close button.',
              dismissible: false,
            })
          }
        >
          Non-dismissible
        </Button>
        <Button
          variant="outline"
          onClick={() =>
            showToast({
              variant: 'info',
              title: 'Persistent',
              description: 'Stays until dismissed.',
              duration: Infinity,
            })
          }
        >
          Persistent (no timer)
        </Button>
        <Button
          variant="outline"
          onClick={() =>
            showToast({
              variant: 'warning',
              title: 'Long duration',
              description: '10 second timer.',
              duration: 10000,
            })
          }
        >
          10s duration
        </Button>
      </div>

      <Toaster />
    </div>
  ),
};
