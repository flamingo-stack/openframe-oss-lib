import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { useState } from 'react';
import { RichTextEditor } from '../components/ui/rich-text-editor';

const meta = {
  title: 'UI/RichTextEditor',
  component: RichTextEditor,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component: 'Tiptap-based WYSIWYG rich text editor with markdown I/O. Supports bold, italic, underline, strikethrough, headings, links, blockquotes, code, images, tables, lists, and task lists.',
      },
    },
  },
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <div style={{ width: '700px' }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof RichTextEditor>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    value: '',
    onChange: () => {},
    placeholder: 'Start typing...',
    label: 'Description',
  },
};

export const WithContent: Story = {
  args: {
    value: '# Hello World\n\nThis is a **rich text** editor with *markdown* support.\n\n- Bullet list item 1\n- Bullet list item 2\n\n> A blockquote example\n\n`inline code` and more.',
    onChange: () => {},
    label: 'Description',
  },
};

export const Interactive: Story = {
  args: {
    value: '',
    onChange: () => {},
  },
  render: function InteractiveEditor() {
    const [value, setValue] = useState('');
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <RichTextEditor
          value={value}
          onChange={setValue}
          label="Ticket Description"
          placeholder="Describe the ticket..."
        />
        <details>
          <summary style={{ color: '#888', fontSize: '14px', cursor: 'pointer' }}>Markdown output</summary>
          <pre style={{ color: '#fafafa', fontSize: '12px', padding: '8px', background: '#161616', borderRadius: '6px', overflow: 'auto', maxHeight: '200px' }}>
            {value || '(empty)'}
          </pre>
        </details>
      </div>
    );
  },
};

export const WithError: Story = {
  args: {
    value: '',
    onChange: () => {},
    label: 'Description',
    error: 'Description is required',
    invalid: true,
  },
};

export const Disabled: Story = {
  args: {
    value: 'This content cannot be edited.',
    onChange: () => {},
    label: 'Read-only',
    disabled: true,
  },
};
