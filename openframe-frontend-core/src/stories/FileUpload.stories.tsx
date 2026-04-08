import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { useState } from 'react';
import { FileUpload } from '../components/ui/file-upload';

const meta = {
  title: 'UI/FileUpload',
  component: FileUpload,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component: 'Drag and drop file upload dropzone with file validation, preview list, and remove actions.',
      },
    },
  },
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <div style={{ width: '500px' }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof FileUpload>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    onChange: () => {},
  },
};

export const WithLabel: Story = {
  args: {
    fieldLabel: 'Attachments',
    onChange: () => {},
  },
};

export const Multiple: Story = {
  args: {
    multiple: true,
    label: 'Upload Files',
    description: '(Click Here or Drag and Drop)',
    onChange: () => {},
  },
};

export const ImagesOnly: Story = {
  args: {
    accept: 'image/*',
    label: 'Upload Images',
    description: 'PNG, JPEG, WebP only',
    onChange: () => {},
  },
};

export const Interactive: Story = {
  args: {
    onChange: () => {},
  },
  render: function InteractiveUpload() {
    const [files, setFiles] = useState<File[]>([]);
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <FileUpload
          value={files}
          onChange={(f) => setFiles(f as File[] || [])}
          multiple
          fieldLabel="Upload Files"
        />
        <p style={{ color: '#888', fontSize: '14px' }}>
          {files.length} file(s) selected
        </p>
      </div>
    );
  },
};

export const Disabled: Story = {
  args: {
    disabled: true,
    onChange: () => {},
  },
};
