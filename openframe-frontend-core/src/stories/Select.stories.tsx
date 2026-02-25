import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { FieldWrapper } from '../components/ui/field-wrapper'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select'

const meta = {
  title: 'UI/Select',
  component: Select,
  parameters: {
    layout: 'padded',
  },
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <div style={{ padding: '2rem', backgroundColor: 'var(--ods-bg)', maxWidth: '480px' }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Select>

export default meta
type Story = StoryObj<typeof meta>

/**
 * Default select with placeholder.
 */
export const Default: Story = {
  render: () => (
    <Select>
      <SelectTrigger>
        <SelectValue placeholder="Select an option..." />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="option1">Option 1</SelectItem>
        <SelectItem value="option2">Option 2</SelectItem>
        <SelectItem value="option3">Option 3</SelectItem>
      </SelectContent>
    </Select>
  ),
}

/**
 * Select with a pre-selected value.
 */
export const WithValue: Story = {
  render: () => (
    <Select defaultValue="option2">
      <SelectTrigger>
        <SelectValue placeholder="Select an option..." />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="option1">Option 1</SelectItem>
        <SelectItem value="option2">Option 2</SelectItem>
        <SelectItem value="option3">Option 3</SelectItem>
      </SelectContent>
    </Select>
  ),
}

/**
 * Disabled select.
 */
export const Disabled: Story = {
  render: () => (
    <Select disabled>
      <SelectTrigger>
        <SelectValue placeholder="Cannot select..." />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="option1">Option 1</SelectItem>
        <SelectItem value="option2">Option 2</SelectItem>
      </SelectContent>
    </Select>
  ),
}

/**
 * Select with grouped items and labels.
 */
export const WithGroups: Story = {
  render: () => (
    <Select>
      <SelectTrigger>
        <SelectValue placeholder="Select a fruit..." />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          <SelectLabel>Fruits</SelectLabel>
          <SelectItem value="apple">Apple</SelectItem>
          <SelectItem value="banana">Banana</SelectItem>
          <SelectItem value="orange">Orange</SelectItem>
        </SelectGroup>
        <SelectSeparator />
        <SelectGroup>
          <SelectLabel>Vegetables</SelectLabel>
          <SelectItem value="carrot">Carrot</SelectItem>
          <SelectItem value="potato">Potato</SelectItem>
          <SelectItem value="tomato">Tomato</SelectItem>
        </SelectGroup>
      </SelectContent>
    </Select>
  ),
}

/**
 * Select with a disabled item.
 */
export const WithDisabledItem: Story = {
  render: () => (
    <Select>
      <SelectTrigger>
        <SelectValue placeholder="Select a role..." />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="viewer">Viewer</SelectItem>
        <SelectItem value="editor">Editor</SelectItem>
        <SelectItem value="admin" disabled>Admin (restricted)</SelectItem>
      </SelectContent>
    </Select>
  ),
}

/**
 * Select with many items to demonstrate scrolling.
 */
export const ManyItems: Story = {
  render: () => (
    <Select>
      <SelectTrigger>
        <SelectValue placeholder="Select a timezone..." />
      </SelectTrigger>
      <SelectContent>
        {[
          'UTC-12:00', 'UTC-11:00', 'UTC-10:00', 'UTC-09:00',
          'UTC-08:00', 'UTC-07:00', 'UTC-06:00', 'UTC-05:00',
          'UTC-04:00', 'UTC-03:00', 'UTC-02:00', 'UTC-01:00',
          'UTC+00:00', 'UTC+01:00', 'UTC+02:00', 'UTC+03:00',
          'UTC+04:00', 'UTC+05:00', 'UTC+06:00', 'UTC+07:00',
          'UTC+08:00', 'UTC+09:00', 'UTC+10:00', 'UTC+11:00',
          'UTC+12:00',
        ].map((tz) => (
          <SelectItem key={tz} value={tz}>{tz}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  ),
}

/**
 * Select with invalid state.
 */
export const Invalid: Story = {
  render: () => (
    <Select>
      <SelectTrigger invalid>
        <SelectValue placeholder="Select a role..." />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="viewer">Viewer</SelectItem>
        <SelectItem value="editor">Editor</SelectItem>
        <SelectItem value="admin">Admin</SelectItem>
      </SelectContent>
    </Select>
  ),
}

/**
 * Select with label using FieldWrapper.
 */
export const WithLabel: Story = {
  render: () => (
    <FieldWrapper label="Role">
      <Select>
        <SelectTrigger>
          <SelectValue placeholder="Select a role..." />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="viewer">Viewer</SelectItem>
          <SelectItem value="editor">Editor</SelectItem>
          <SelectItem value="admin">Admin</SelectItem>
        </SelectContent>
      </Select>
    </FieldWrapper>
  ),
}

/**
 * Select with label and error message.
 */
export const WithLabelAndError: Story = {
  render: () => (
    <FieldWrapper label="Role" error="Please select a role">
      <Select>
        <SelectTrigger invalid>
          <SelectValue placeholder="Select a role..." />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="viewer">Viewer</SelectItem>
          <SelectItem value="editor">Editor</SelectItem>
          <SelectItem value="admin">Admin</SelectItem>
        </SelectContent>
      </Select>
    </FieldWrapper>
  ),
}

/**
 * Select with label and selected value.
 */
export const WithLabelAndValue: Story = {
  render: () => (
    <FieldWrapper label="Role">
      <Select defaultValue="editor">
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="viewer">Viewer</SelectItem>
          <SelectItem value="editor">Editor</SelectItem>
          <SelectItem value="admin">Admin</SelectItem>
        </SelectContent>
      </Select>
    </FieldWrapper>
  ),
}

/**
 * All select variants displayed together for comparison.
 */
export const AllVariants: Story = {
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <Select>
        <SelectTrigger>
          <SelectValue placeholder="Default" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="a">Option A</SelectItem>
          <SelectItem value="b">Option B</SelectItem>
        </SelectContent>
      </Select>

      <Select defaultValue="b">
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="a">Option A</SelectItem>
          <SelectItem value="b">With value</SelectItem>
        </SelectContent>
      </Select>

      <Select disabled>
        <SelectTrigger>
          <SelectValue placeholder="Disabled" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="a">Option A</SelectItem>
        </SelectContent>
      </Select>

      <Select>
        <SelectTrigger invalid>
          <SelectValue placeholder="Invalid" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="a">Option A</SelectItem>
        </SelectContent>
      </Select>

      <FieldWrapper label="With Label">
        <Select>
          <SelectTrigger>
            <SelectValue placeholder="Select..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="a">Option A</SelectItem>
            <SelectItem value="b">Option B</SelectItem>
          </SelectContent>
        </Select>
      </FieldWrapper>

      <FieldWrapper label="With Error" error="This field is required">
        <Select>
          <SelectTrigger invalid>
            <SelectValue placeholder="Select..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="a">Option A</SelectItem>
            <SelectItem value="b">Option B</SelectItem>
          </SelectContent>
        </Select>
      </FieldWrapper>
    </div>
  ),
}
