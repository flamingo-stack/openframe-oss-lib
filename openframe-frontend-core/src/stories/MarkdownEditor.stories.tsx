import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { useState } from 'react';
import { MarkdownEditor } from '../components/ui/markdown-editor';
import { SimpleMarkdownRenderer } from '../components/ui/markdown/simple-markdown-renderer';

/**
 * `MarkdownEditor` is controlled (`value` + `onChange`), so the stories hold the
 * markdown here. `value`/`onChange` are hidden from the Controls table for the
 * same reason: they are owned by this wrapper, and leaving them editable would
 * offer a control that changes nothing.
 */
function ControlledEditor({
  initialValue = '',
  ...props
}: { initialValue?: string } & Omit<React.ComponentProps<typeof MarkdownEditor>, 'value' | 'onChange'>) {
  const [value, setValue] = useState(initialValue);
  return <MarkdownEditor {...props} value={value} onChange={setValue} />;
}

/**
 * The preview the Knowledge Base form passes: the vendor's own renderer is replaced
 * by ours, so the pane shows what the article will actually look like. Copied from
 * `article-form-fields.tsx` wrapper and all — the wrapper class is load-bearing, the
 * editor's stylesheet excludes `.custom-preview-wrapper *` from its colour override.
 */
const renderPreview = (source: string) => (
  <div className="custom-preview-wrapper" style={{ height: '100%', overflow: 'auto' }}>
    <SimpleMarkdownRenderer content={source} />
  </div>
);

/** Stand-in for the article-image upload the Knowledge Base form passes. */
const uploadStub = (file: File) =>
  new Promise<string>(resolve => setTimeout(() => resolve(`https://example.com/uploads/${file.name}`), 600));

const SAMPLE = `## Restarting the print spooler

Run the following on the affected endpoint:

\`\`\`powershell
Restart-Service -Name Spooler -Force
\`\`\`

| Step | Command | Elevated |
| --- | --- | --- |
| Stop | \`Stop-Service Spooler\` | yes |
| Clear | \`Remove-Item C:\\Windows\\System32\\spool\\PRINTERS\\*\` | yes |
| Start | \`Start-Service Spooler\` | yes |

> The queue is cleared for every user on the machine, not just the caller.
`;

const meta = {
  title: 'UI/MarkdownEditor',
  component: MarkdownEditor,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Split markdown editor — toolbar, source pane and live preview. Wraps `@uiw/react-md-editor` and restyles it onto ODS tokens through an injected stylesheet, so its framing (border, radius, the toolbar/source seam) is owned here rather than by the vendor. Its one consumer is the Knowledge Base article form in `openframe-oss-frontend`, which is what `Default` reproduces.',
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    // Owned by `ControlledEditor` — see its note.
    value: { table: { disable: true } },
    onChange: { table: { disable: true } },
    onUploadFile: { table: { disable: true } },
    onFileUploaded: { table: { disable: true } },
    renderPreview: { table: { disable: true } },
    placeholder: { control: 'text', description: 'Placeholder shown while the editor is empty' },
    disabled: { control: 'boolean', description: 'Disabled state' },
    height: {
      control: 'number',
      description: 'Initial height in pixels (default 600). Resizable by the drag handle.',
    },
    minHeight: { control: 'number', description: 'Lower bound for the drag handle (default 100)' },
  },
  decorators: [
    Story => (
      <div style={{ padding: '2rem', backgroundColor: 'var(--ods-bg)' }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof MarkdownEditor>;

export default meta;
type Story = StoryObj<typeof meta>;

const base = { value: '', onChange: () => {} };

/**
 * The Knowledge Base article form's own configuration: 400px tall and an upload
 * handler, which is what puts the upload command at the end of the toolbar.
 */
export const Default: Story = {
  args: { ...base, placeholder: 'Write the article content...', height: 400 },
  render: args => <ControlledEditor {...args} onUploadFile={uploadStub} renderPreview={renderPreview} />,
};

/**
 * With content, exercising the preview pane: headings, a fenced code block, a
 * GFM table and a blockquote.
 */
export const WithContent: Story = {
  args: { ...base, height: 400 },
  render: args => (
    <ControlledEditor {...args} initialValue={SAMPLE} onUploadFile={uploadStub} renderPreview={renderPreview} />
  ),
};

/**
 * Without an upload handler the component hides the upload command, leaving a
 * toolbar one button shorter. Documented here because it is easy to reach by
 * accident — a consumer that forgets the prop gets this silently.
 */
export const WithoutUpload: Story = {
  args: { ...base, placeholder: 'No upload handler passed...', height: 400 },
  render: args => <ControlledEditor {...args} />,
};

/**
 * Disabled — the toolbar stays visible but nothing is editable.
 */
export const Disabled: Story = {
  args: { ...base, height: 300, disabled: true },
  render: args => (
    <ControlledEditor {...args} initialValue={SAMPLE} onUploadFile={uploadStub} renderPreview={renderPreview} />
  ),
};

/**
 * Short editor — the frame, the toolbar seam and the resize handle at the
 * smallest size the component is used at. Note the toolbar's title dropdown is
 * taller than this body, which is why the frame must not clip its children.
 */
export const Compact: Story = {
  args: { ...base, height: 200, minHeight: 120 },
  render: args => (
    <ControlledEditor {...args} initialValue="Short note." onUploadFile={uploadStub} renderPreview={renderPreview} />
  ),
};
