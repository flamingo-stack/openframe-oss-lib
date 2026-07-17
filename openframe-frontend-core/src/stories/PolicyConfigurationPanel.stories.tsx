import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { useState } from 'react'
import { fn } from 'storybook/test'
import { PolicyConfigurationPanel } from '../components/features/policy-configuration-panel'
import type { ApprovalLevel, PermissionCategory } from '../types/permissions'

const meta = {
  title: 'Features/PolicyConfigurationPanel',
  component: PolicyConfigurationPanel,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Grouped list of AI guardrails permission categories with per-policy approval dropdowns. ' +
          'Categories are pure data — the panel owns its presentation state internally: which categories ' +
          'are expanded and the last bulk level picked per category (bulk selections reset when `editMode` ' +
          'changes). In edit mode each category header offers a bulk "global permission" dropdown that ' +
          'fires `onCategoryPermissionChange`; each policy row fires `onPolicyPermissionChange`. ' +
          'Used by the OpenFrame AI Settings → Guardrails tab.',
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    editMode: { control: 'boolean' },
  },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: '960px' }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof PolicyConfigurationPanel>

export default meta
type Story = StoryObj<typeof meta>

const deviceCategories: PermissionCategory[] = [
  {
    id: 'device-actions',
    name: 'Device Actions',
    policies: [
      {
        id: 'OPENFRAME_RMM:DEVICE_REBOOT',
        naturalKey: 'OPENFRAME_RMM:DEVICE_REBOOT',
        name: 'Reboot Device',
        commandPattern: 'device.reboot --id {deviceId}',
        toolName: 'OPENFRAME_RMM',
        approvalLevel: 'ASK_USER',
      },
      {
        id: 'FLEET_MDM:DEVICE_LOCK',
        naturalKey: 'FLEET_MDM:DEVICE_LOCK',
        name: 'Lock Device',
        commandPattern: 'fleet mdm lock --host {hostId}',
        toolName: 'FLEET_MDM',
        approvalLevel: 'ASK_TECHNICIAN',
      },
      {
        id: 'FLEET_MDM:DEVICE_WIPE',
        naturalKey: 'FLEET_MDM:DEVICE_WIPE',
        name: 'Wipe Device',
        commandPattern: 'fleet mdm wipe --host {hostId}',
        toolName: 'FLEET_MDM',
        approvalLevel: 'DENY',
      },
    ],
  },
  {
    id: 'remote-access',
    name: 'Remote Access',
    policies: [
      {
        id: 'MESHCENTRAL:REMOTE_SHELL',
        naturalKey: 'MESHCENTRAL:REMOTE_SHELL',
        name: 'Open Remote Shell',
        commandPattern: 'mesh.shell --node {nodeId}',
        toolName: 'MESHCENTRAL',
        approvalLevel: 'ASK_TECHNICIAN',
      },
      {
        id: 'MESHCENTRAL:FILE_TRANSFER',
        naturalKey: 'MESHCENTRAL:FILE_TRANSFER',
        name: 'Transfer Files',
        commandPattern: 'mesh.files --node {nodeId} --upload|--download',
        toolName: 'MESHCENTRAL',
        approvalLevel: 'DENY',
      },
    ],
  },
  {
    id: 'scripts-automation',
    name: 'Scripts & Automation',
    policies: [
      {
        id: 'OPENFRAME_RMM:RUN_POWERSHELL',
        naturalKey: 'OPENFRAME_RMM:RUN_POWERSHELL',
        name: 'Run PowerShell Script',
        commandPattern: 'powershell -ExecutionPolicy Bypass -File {script}',
        toolName: 'OPENFRAME_RMM',
        approvalLevel: 'ASK_USER',
      },
      {
        id: 'OPENFRAME_RMM:RUN_BASH',
        naturalKey: 'OPENFRAME_RMM:RUN_BASH',
        name: 'Run Bash Script',
        commandPattern: 'bash -c {script}',
        toolName: 'OPENFRAME_RMM',
        approvalLevel: 'ASK_USER',
      },
    ],
  },
]

const dataCategories: PermissionCategory[] = [
  {
    id: 'data-read',
    name: 'Read Access',
    policies: [
      {
        id: 'OSQUERY:QUERY_INVENTORY',
        naturalKey: 'OSQUERY:QUERY_INVENTORY',
        name: 'Query Device Inventory',
        commandPattern: 'SELECT * FROM system_info;',
        toolName: 'OSQUERY',
        approvalLevel: 'ALLOW',
      },
      {
        id: 'SYSTEM:READ_LOGS',
        naturalKey: 'SYSTEM:READ_LOGS',
        name: 'Read System Logs',
        commandPattern: 'logs.read --stream {stream} --since {ts}',
        toolName: 'SYSTEM',
        approvalLevel: 'ALLOW',
      },
    ],
  },
]

/** Applies a level to one policy; mirrors what the guardrails editor hook does. */
const applyPolicyLevel = (
  categories: PermissionCategory[],
  categoryId: string,
  policyId: string,
  level: ApprovalLevel,
): PermissionCategory[] =>
  categories.map(category =>
    category.id !== categoryId
      ? category
      : {
          ...category,
          policies: category.policies.map(policy =>
            policy.id === policyId ? { ...policy, approvalLevel: level } : policy,
          ),
        },
  )

/** Bulk-applies a level to every policy in a category. */
const applyCategoryLevel = (
  categories: PermissionCategory[],
  categoryId: string,
  level: ApprovalLevel,
): PermissionCategory[] =>
  categories.map(category =>
    category.id !== categoryId
      ? category
      : { ...category, policies: category.policies.map(policy => ({ ...policy, approvalLevel: level })) },
  )

/** Read-only view: approval levels render as text, no bulk dropdowns. */
export const ReadOnly: Story = {
  args: {
    categories: deviceCategories,
    editMode: false,
    onPolicyPermissionChange: fn(),
    onCategoryPermissionChange: fn(),
  },
}

/**
 * Interactive edit mode: per-policy dropdowns plus a bulk "global permission"
 * dropdown per category header. The wrapper applies changes back into the
 * category data the same way the OpenFrame guardrails editor does.
 */
export const EditMode: Story = {
  args: {
    categories: deviceCategories,
    editMode: true,
    onPolicyPermissionChange: fn(),
    onCategoryPermissionChange: fn(),
  },
  render: args => {
    const [categories, setCategories] = useState(args.categories)

    return (
      <PolicyConfigurationPanel
        {...args}
        categories={categories}
        onPolicyPermissionChange={(categoryId, policyId, level) => {
          args.onPolicyPermissionChange(categoryId, policyId, level)
          setCategories(prev => applyPolicyLevel(prev, categoryId, policyId, level))
        }}
        onCategoryPermissionChange={(categoryId, level) => {
          args.onCategoryPermissionChange(categoryId, level)
          setCategories(prev => applyCategoryLevel(prev, categoryId, level))
        }}
      />
    )
  },
}

/**
 * How the guardrails tab composes the panel: one panel per policy group, each
 * under a small secondary heading.
 */
export const GroupedPolicySections: Story = {
  args: {
    categories: deviceCategories,
    editMode: true,
    onPolicyPermissionChange: fn(),
    onCategoryPermissionChange: fn(),
  },
  render: args => {
    const [groups, setGroups] = useState<Record<string, PermissionCategory[]>>({
      'Device Management': deviceCategories,
      'Data Access': dataCategories,
    })

    const updateGroup = (groupName: string, next: (categories: PermissionCategory[]) => PermissionCategory[]) =>
      setGroups(prev => ({ ...prev, [groupName]: next(prev[groupName]) }))

    return (
      <div className="flex flex-col gap-[var(--spacing-system-l)]">
        {Object.entries(groups).map(([groupName, categories]) => (
          <div key={groupName} className="flex flex-col gap-[var(--spacing-system-xxs)]">
            <p className="text-h5 text-ods-text-secondary truncate">{groupName}</p>
            <PolicyConfigurationPanel
              categories={categories}
              editMode={args.editMode}
              onPolicyPermissionChange={(categoryId, policyId, level) =>
                updateGroup(groupName, categories => applyPolicyLevel(categories, categoryId, policyId, level))
              }
              onCategoryPermissionChange={(categoryId, level) =>
                updateGroup(groupName, categories => applyCategoryLevel(categories, categoryId, level))
              }
            />
          </div>
        ))}
      </div>
    )
  },
}
