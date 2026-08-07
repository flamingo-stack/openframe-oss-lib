import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { Field } from '../components/ui/field';
import { Input } from '../components/ui/input';

const meta = {
  title: 'UI/Field',
  component: Field,
} satisfies Meta<typeof Field>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * The full contract in one field: label, required `*`, hover InfoHint, and a
 * `role="alert"` error. The render-prop spreads `id` / `aria-required` /
 * `aria-invalid` / `aria-describedby` onto the control so the label and error
 * are actually announced.
 */
export const Default: Story = {
  args: {
    label: 'Repository name',
    hint: 'The GitHub repository this rule set applies to. Owner/name format.',
    required: true,
    error: 'A repository with this name already exists.',
    children: () => null,
  },
  render: args => (
    <div className="max-w-md">
      <Field {...args}>
        {f => <Input {...f} placeholder="flamingo-stack/openframe" defaultValue="flamingo-stack/openframe" />}
      </Field>
    </div>
  ),
};

/**
 * Clean state — no hint, no error, not required.
 */
export const Plain: Story = {
  args: {
    label: 'Display name',
    children: () => null,
  },
  render: args => (
    <div className="max-w-md">
      <Field {...args}>{f => <Input {...f} placeholder="Enter a name..." />}</Field>
    </div>
  ),
};

/**
 * Fields in a grid row top-align naturally because labels are a single line —
 * hints live in the hover icon, never in flow.
 */
export const GridRow: Story = {
  args: {
    label: 'Model',
    children: () => null,
  },
  render: () => (
    <div className="grid max-w-2xl grid-cols-2 gap-[var(--spacing-system-mf)]">
      <Field label="Model" hint="The LLM used for judged rules." required>
        {f => <Input {...f} placeholder="claude-sonnet" />}
      </Field>
      <Field label="Threshold" error="Must be between 0 and 100.">
        {f => <Input {...f} defaultValue="150" />}
      </Field>
    </div>
  ),
};
