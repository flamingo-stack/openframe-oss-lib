import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { useState } from 'react'
import { OrganizationSelector, type OrganizationOption } from '../components/features/organization-selector'

const sampleOrganizations: OrganizationOption[] = [
  { id: '1', organizationId: 'org-1', name: 'Acme Corporation', isDefault: true },
  { id: '2', organizationId: 'org-2', name: 'Globex Industries' },
  { id: '3', organizationId: 'org-3', name: 'Initech Solutions' },
  { id: '4', organizationId: 'org-4', name: 'Umbrella Corp' },
  { id: '5', organizationId: 'org-5', name: 'Stark Industries' },
  { id: '6', organizationId: 'org-6', name: 'Wayne Enterprises' },
  { id: '7', organizationId: 'org-7', name: 'Oscorp Technologies' },
  { id: '8', organizationId: 'org-8', name: 'Cyberdyne Systems' },
  { id: '9', organizationId: 'org-9', name: 'Soylent Corp' },
  { id: '10', organizationId: 'org-10', name: 'Wonka Industries' },
]

const meta = {
  title: 'Features/OrganizationSelector',
  component: OrganizationSelector,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    searchable: {
      control: 'boolean',
      description: 'Whether to show a search input inside the dropdown',
    },
    disabled: {
      control: 'boolean',
    },
    isLoading: {
      control: 'boolean',
    },
    iconSize: {
      control: 'select',
      options: ['xs', 'sm', 'md'],
    },
  },
  decorators: [
    (Story) => (
      <div style={{ width: 400 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof OrganizationSelector>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    organizations: sampleOrganizations,
    value: '',
    onValueChange: () => {},
    placeholder: 'Choose organization',
    label: 'Organization',
  },
}

export const WithSearch: Story = {
  args: {
    organizations: sampleOrganizations,
    value: '',
    onValueChange: () => {},
    placeholder: 'Choose organization',
    label: 'Organization',
    searchable: true,
  },
}

export const WithSearchInteractive: Story = {
  render: () => {
    const [value, setValue] = useState('')
    return (
      <OrganizationSelector
        organizations={sampleOrganizations}
        value={value}
        onValueChange={setValue}
        label="Organization"
        placeholder="Choose organization"
        searchable
      />
    )
  },
}

export const Preselected: Story = {
  args: {
    organizations: sampleOrganizations,
    value: 'org-1',
    onValueChange: () => {},
    label: 'Organization',
  },
}

export const Loading: Story = {
  args: {
    organizations: [],
    value: '',
    onValueChange: () => {},
    label: 'Organization',
    isLoading: true,
  },
}

export const Disabled: Story = {
  args: {
    organizations: sampleOrganizations,
    value: 'org-1',
    onValueChange: () => {},
    label: 'Organization',
    disabled: true,
  },
}

export const FewItems: Story = {
  args: {
    organizations: sampleOrganizations.slice(0, 2),
    value: '',
    onValueChange: () => {},
    label: 'Organization',
    searchable: true,
    searchPlaceholder: 'Filter...',
  },
}
