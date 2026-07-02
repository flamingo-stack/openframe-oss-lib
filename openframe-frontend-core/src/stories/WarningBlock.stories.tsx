import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { OSTypeIcon } from '../components/features/os-type-badge';
import { OPENFRAME_DOCTOR_COMMANDS, PathsDisplay } from '../components/features/paths-display';
import { WarningBlock } from '../components/features/warning-block';

const meta = {
  title: 'Features/WarningBlock',
  component: WarningBlock,
  parameters: {
    docs: {
      description: {
        component:
          'A card with a highlighted "attention / warning" banner header followed by composable body content. Body is passed as children, so a single block can mix description paragraphs with one or more `PathsDisplay` lists (see the New Device warning blocks). Typography is responsive via ODS tokens (14px on mobile, 18px from `md` up).',
      },
    },
  },
  argTypes: {
    title: { control: 'text' },
  },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 720 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof WarningBlock>;

export default meta;
type Story = StoryObj<typeof meta>;

const copyPath = (path: string) => {
  if (typeof navigator !== 'undefined' && navigator.clipboard) {
    void navigator.clipboard.writeText(path);
  }
};

/** Minimal usage — a banner title with a single description paragraph. */
export const Default: Story = {
  args: {
    title: 'Administrator privileges are required to install the OpenFrame agent.',
    children: (
      <p className="text-h4 text-ods-text-primary">
        Run the command with the appropriate permissions for your platform.
      </p>
    ),
  },
};

/**
 * Antivirus warning from the New Device screen — description, a `PathsDisplay`
 * list of exclusion folders, then a closing paragraph.
 */
export const AntivirusWarning: Story = {
  args: {
    title: 'Your antivirus may block OpenFrame installation. This is a false positive.',
    children: (
      <>
        <PathsDisplay
          title="If blocked, add these folders to your antivirus exclusions list:"
          paths={['C:\\Program Files\\OpenFrame\\', 'C:\\Users\\[Username]\\AppData\\Local\\OpenFrame\\']}
          onCopyPath={copyPath}
        />
        <p className="text-h4 text-ods-text-primary">
          Or temporarily disable protection during installation. OpenFrame is safe open-source software.
          Blocks happen because new software needs time to build reputation with security vendors.
        </p>
      </>
    ),
  },
};

/**
 * Doctor mode warning from the New Device screen — description plus a single
 * copyable command row.
 */
export const DoctorMode: Story = {
  args: {
    title: 'Device not appearing or stuck pending?',
    children: (
      <>
        <p className="text-h4 text-ods-text-primary">
          Run the doctor command to diagnose installation issues and repair the agent. It works even if
          the agent didn&apos;t install correctly.
        </p>
        <PathsDisplay
          paths={[OPENFRAME_DOCTOR_COMMANDS.windows]}
          onCopyPath={copyPath}
        />
      </>
    ),
  },
};

/**
 * Administrator privileges warning — a platform-specific instruction row (no
 * copy button) framed by description paragraphs.
 */
export const AdministratorPrivileges: Story = {
  args: {
    title: 'Administrator privileges are required to install the OpenFrame agent.',
    children: (
      <>
        <p className="text-h4 text-ods-text-primary">
          Run the command with the appropriate permissions for your platform:
        </p>
        <PathsDisplay
          paths={['Run PowerShell as Local Administrator']}
          showCopyButtons={false}
          leadingIcon={<OSTypeIcon osType="windows" size="w-6 h-6" />}
        />
        <p className="text-h4 text-ods-text-primary">
          Without elevated privileges, the installation will fail silently. Right-click PowerShell and
          select &quot;Run as administrator,&quot; or contact your IT admin if you don&apos;t have local
          admin rights.
        </p>
      </>
    ),
  },
};

/** All three New Device warning blocks stacked, matching the Figma layout. */
export const NewDeviceBlocks: Story = {
  args: { title: '' },
  render: () => (
    <div className="flex flex-col gap-6">
      <WarningBlock title="Administrator privileges are required to install the OpenFrame agent.">
        <p className="text-h4 text-ods-text-primary">
          Run the command with the appropriate permissions for your platform:
        </p>
        <PathsDisplay
          paths={['Run PowerShell as Local Administrator']}
          showCopyButtons={false}
          leadingIcon={<OSTypeIcon osType="windows" size="w-6 h-6" />}
        />
        <p className="text-h4 text-ods-text-primary">
          Without elevated privileges, the installation will fail silently. Right-click PowerShell and
          select &quot;Run as administrator,&quot; or contact your IT admin if you don&apos;t have local
          admin rights.
        </p>
      </WarningBlock>

      <WarningBlock title="Your antivirus may block OpenFrame installation. This is a false positive.">
        <PathsDisplay
          title="If blocked, add these folders to your antivirus exclusions list:"
          paths={['C:\\Program Files\\OpenFrame\\', 'C:\\Users\\[Username]\\AppData\\Local\\OpenFrame\\']}
          onCopyPath={copyPath}
        />
        <p className="text-h4 text-ods-text-primary">
          Or temporarily disable protection during installation. OpenFrame is safe open-source software.
          Blocks happen because new software needs time to build reputation with security vendors.
        </p>
      </WarningBlock>

      <WarningBlock title="Device not appearing or stuck pending?">
        <p className="text-h4 text-ods-text-primary">
          Run the doctor command to diagnose installation issues and repair the agent. It works even if
          the agent didn&apos;t install correctly.
        </p>
        <PathsDisplay
          paths={[OPENFRAME_DOCTOR_COMMANDS.windows]}
          onCopyPath={copyPath}
        />
      </WarningBlock>
    </div>
  ),
};
