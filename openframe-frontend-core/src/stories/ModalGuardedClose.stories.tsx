import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { useState } from 'react';
import { Button } from '../components/ui/button';
import { UnsavedChangesChip, useGuardedClose } from '../components/ui/modal-guarded-close';

/**
 * Stories for `modal-guarded-close` — the unified dirty-state contract for
 * modals. The chip is the visual affordance; the `useConfirm` /
 * `useGuardedClose` hooks are exercised by the interactive story below (the
 * chip story file covers all three exports of the module).
 */
const meta = {
  title: 'UI/UnsavedChangesChip',
  component: UnsavedChangesChip,
} satisfies Meta<typeof UnsavedChangesChip>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * The standing "Unsaved changes" signal for a dirty modal's footer —
 * `role="status"`, warning color, with the WHAT-is-dirty detail on hover.
 */
export const Default: Story = {
  args: {
    detail: '2 rules changed, 1 rule removed',
  },
};

/**
 * In its natural habitat: a form-modal footer between the status text and the
 * Cancel/Save buttons.
 */
export const InAFooterRow: Story = {
  args: {
    detail: 'Name and threshold edited',
  },
  render: args => (
    <div className="flex w-full max-w-2xl items-center justify-between gap-[var(--spacing-system-xsf)] rounded-md border border-ods-border bg-ods-card p-[var(--spacing-system-mf)]">
      <span className="text-ods-text-secondary text-h6">3 rules selected</span>
      <div className="flex items-center gap-[var(--spacing-system-xsf)]">
        <UnsavedChangesChip {...args} />
        <Button variant="outline" size="small-legacy">
          Cancel
        </Button>
        <Button size="small-legacy">Save</Button>
      </div>
    </div>
  ),
};

/**
 * `useGuardedClose` end-to-end: while dirty, Close asks the house confirm
 * (`useConfirm` + ModalV2) before discarding; while clean, it closes
 * immediately. Toggle the checkbox and hit Close to see both paths.
 */
export const GuardedCloseFlow: Story = {
  args: {},
  render: () => <GuardedCloseDemo />,
};

function GuardedCloseDemo() {
  const [dirty, setDirty] = useState(true);
  const [lastOutcome, setLastOutcome] = useState<string>('never closed');
  const { guardedClose, dialog } = useGuardedClose(dirty, () => setLastOutcome('closed (edits discarded)'));
  return (
    <div className="flex max-w-md flex-col items-start gap-[var(--spacing-system-mf)]">
      <label className="flex items-center gap-[var(--spacing-system-xsf)] text-ods-text-primary text-h6">
        <input type="checkbox" checked={dirty} onChange={e => setDirty(e.target.checked)} />
        Form has unsaved edits
      </label>
      <div className="flex items-center gap-[var(--spacing-system-xsf)]">
        {dirty && <UnsavedChangesChip detail="Demo edits" />}
        <Button variant="outline" size="small-legacy" onClick={guardedClose}>
          Close
        </Button>
      </div>
      <span className="text-ods-text-secondary text-h6">Last outcome: {lastOutcome}</span>
      {dialog}
    </div>
  );
}
