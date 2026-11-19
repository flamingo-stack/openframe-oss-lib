/**
 * DataTable.Cell — the content of one grid-table cell (the design's `table/cell`): one line, whatever it holds.
 *
 * Each sample sits in a box of the grid cell's own measures (48px high, 12px inset), at the design's width and at
 * the column's minimum width, so what gives way when a column is narrow can be read off the story.
 */

import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import type { ReactNode } from 'react';
import { LockIcon, MonitorIcon } from '../components/icons-v2-generated';
import { DataTable } from '../components/ui/data-table';
import { Tag } from '../components/ui/tag';

function CellBox({ width, children }: { width: number; children: ReactNode }) {
  return (
    <div
      className="flex h-12 items-center border-b border-ods-border bg-ods-card px-[var(--spacing-system-sf)]"
      style={{ width }}
      data-cell-box
    >
      {children}
    </div>
  );
}

function Sample({ title, minWidth, children }: { title: string; minWidth: number; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-[var(--spacing-system-xsf)]">
      <span className="text-ods-text-secondary text-h6">{title}</span>
      <div className="flex items-start gap-[var(--spacing-system-mf)]">
        <CellBox width={280}>{children}</CellBox>
        <CellBox width={minWidth}>{children}</CellBox>
      </div>
    </div>
  );
}

const meta = {
  title: 'UI/DataTable/Cell',
  component: DataTable.Cell,
  parameters: { layout: 'padded' },
} satisfies Meta<typeof DataTable.Cell>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Every shape of the cell at 280px and at its column's minimum width. */
export const Shapes: Story = {
  render: () => (
    <div className="flex flex-col gap-[var(--spacing-system-lf)] bg-ods-bg p-[var(--spacing-system-lf)]">
      <Sample title="Text (min 120)" minWidth={120}>
        <DataTable.Cell text="Dell OptiPlex 7090 Small Form Factor" />
      </Sample>
      <Sample title="Leading icon + text (min 148)" minWidth={148}>
        <DataTable.Cell leading={{ type: 'icon', icon: <MonitorIcon size={20} /> }} text="Romans-MacBook-Pro.local" />
      </Sample>
      <Sample title="Leading image + text (min 160)" minWidth={160}>
        <DataTable.Cell
          leading={{ type: 'image', alt: 'Green Valley Manufacturing' }}
          text="Green Valley Manufacturing"
        />
      </Sample>
      <Sample title="Leading avatar + text + tag (min 160)" minWidth={160}>
        <DataTable.Cell
          leading={{ type: 'avatar', name: 'Roman Khutornoy' }}
          text="Roman Khutornoy"
          tag={<Tag label="You" variant="outline" />}
        />
      </Sample>
      <Sample title="Status: tag + secondary text (min = widest tag + 24)" minWidth={110}>
        <DataTable.Cell tag={<Tag label="Offline" variant="error" />} secondary="3 hours ago" />
      </Sample>
      <Sample title="Tags: tag + more tags" minWidth={148}>
        <DataTable.Cell tag={<Tag label="Production" variant="success" />} moreTags={['edge', 'gpu', 'pci']} />
      </Sample>
      <Sample title="Text + secondary text" minWidth={148}>
        <DataTable.Cell text="OpenFrame agent" secondary="v2.4.1" />
      </Sample>
      <Sample title="Short text + long secondary text: the secondary text is cut (min 148)" minWidth={148}>
        <DataTable.Cell
          leading={{ type: 'icon', icon: <LockIcon size={20} /> }}
          text="Kept"
          secondary="Kept by Jerome Park · Legal hold until the audit closes"
        />
      </Sample>
      <Sample title="Long text + long secondary text: the text keeps its first characters (min 160)" minWidth={160}>
        <DataTable.Cell
          leading={{ type: 'avatar', name: 'Roman Khutornoy' }}
          text="Roman Khutornoy"
          secondary="roman.khutornoy@greenvalleymanufacturing.com"
        />
      </Sample>
      <Sample title="Muted text: a row whose subject is gone" minWidth={148}>
        <DataTable.Cell text="12 Nov 2026" tone="secondary" secondary="14:05" />
      </Sample>
      <Sample title="Text + trailing mark" minWidth={148}>
        <DataTable.Cell
          leading={{ type: 'icon', icon: <MonitorIcon size={20} /> }}
          text="DESKTOP-7K2QF9M"
          trailing={<span className="size-2 rounded-full bg-ods-accent" />}
        />
      </Sample>
    </div>
  ),
};
