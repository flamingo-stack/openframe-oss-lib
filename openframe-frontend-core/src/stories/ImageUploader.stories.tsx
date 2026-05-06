import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { useState } from 'react';
import { ImageUploader } from '../components/ui/image-uploader';

const SAMPLE_IMAGE =
  'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1200&q=80';

const meta = {
  title: 'UI/ImageUploader',
  component: ImageUploader,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Image dropzone with preview, replace, and remove actions. Decoupled from upload logic — the consumer handles uploading via `onChange(file)`.',
      },
    },
  },
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <div style={{ width: '600px' }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof ImageUploader>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    onChange: () => {},
  },
};

export const AllStates: Story = {
  args: {
    onChange: () => {},
  },
  parameters: {
    docs: {
      description: {
        story: 'All four states from Figma (default, hover, action, uploaded). Hover/action states are static visual representations driven by CSS classes — interact with the Default story to see real hover/drag behavior.',
      },
    },
  },
  decorators: [
    (Story) => (
      <div style={{ width: '100%', maxWidth: '1400px' }}>
        <Story />
      </div>
    ),
  ],
  render: () => (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 320px)', gap: '24px' }}>
      <div>
        <p style={{ marginBottom: '8px', fontSize: '12px', color: '#888' }}>default</p>
        <ImageUploader onChange={() => {}} />
      </div>
      <div className="image-uploader-story-hover">
        <p style={{ marginBottom: '8px', fontSize: '12px', color: '#888' }}>hover</p>
        <ImageUploader onChange={() => {}} />
        <style>{`
          .image-uploader-story-hover [role="button"] {
            background-color: var(--color-bg-hover) !important;
            border-color: var(--color-border-hover) !important;
          }
        `}</style>
      </div>
      <div className="image-uploader-story-action">
        <p style={{ marginBottom: '8px', fontSize: '12px', color: '#888' }}>action</p>
        <ImageUploader onChange={() => {}} />
        <style>{`
          .image-uploader-story-action [role="button"] {
            background-color: var(--color-bg-active) !important;
            border-color: var(--color-border-active) !important;
          }
        `}</style>
      </div>
      <div>
        <p style={{ marginBottom: '8px', fontSize: '12px', color: '#888' }}>uploaded</p>
        <ImageUploader value={SAMPLE_IMAGE} onChange={() => {}} onRemove={() => {}} />
      </div>
    </div>
  ),
};

export const WithFieldLabel: Story = {
  args: {
    fieldLabel: 'Cover image',
    onChange: () => {},
  },
};

export const WithPreview: Story = {
  args: {
    value: SAMPLE_IMAGE,
    onChange: () => {},
    onRemove: () => {},
  },
};

export const PreviewWithoutRemove: Story = {
  args: {
    value: SAMPLE_IMAGE,
    onChange: () => {},
  },
};

export const SquareAspectRatio: Story = {
  args: {
    value: SAMPLE_IMAGE,
    aspectRatio: '1 / 1',
    onChange: () => {},
    onRemove: () => {},
  },
  decorators: [
    (Story) => (
      <div style={{ width: '320px' }}>
        <Story />
      </div>
    ),
  ],
};

export const ObjectFitContain: Story = {
  args: {
    value: SAMPLE_IMAGE,
    objectFit: 'contain',
    onChange: () => {},
    onRemove: () => {},
  },
};

export const Loading: Story = {
  args: {
    value: SAMPLE_IMAGE,
    loading: true,
    onChange: () => {},
    onRemove: () => {},
  },
};

export const LoadingEmpty: Story = {
  args: {
    loading: true,
    onChange: () => {},
  },
};

export const Disabled: Story = {
  args: {
    disabled: true,
    onChange: () => {},
  },
};

export const DisabledWithPreview: Story = {
  args: {
    value: SAMPLE_IMAGE,
    disabled: true,
    onChange: () => {},
    onRemove: () => {},
  },
};

export const WithError: Story = {
  args: {
    fieldLabel: 'Cover image',
    error: 'Image is required',
    onChange: () => {},
  },
};

export const CustomCopy: Story = {
  args: {
    label: 'Drop your logo here',
    description: 'PNG or SVG, up to 2MB',
    accept: 'image/png,image/svg+xml',
    maxSize: 2 * 1024 * 1024,
    onChange: () => {},
  },
};

export const Interactive: Story = {
  args: {
    onChange: () => {},
  },
  render: function InteractiveImageUploader() {
    const [preview, setPreview] = useState<string | undefined>();
    const [fileName, setFileName] = useState<string | undefined>();

    const handleChange = (file: File) => {
      setFileName(file.name);
      const reader = new FileReader();
      reader.onload = () => setPreview(reader.result as string);
      reader.readAsDataURL(file);
    };

    const handleRemove = () => {
      setPreview(undefined);
      setFileName(undefined);
    };

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <ImageUploader
          value={preview}
          onChange={handleChange}
          onRemove={handleRemove}
          fieldLabel="Cover image"
        />
        <p style={{ color: '#888', fontSize: '14px' }}>
          {fileName ? `Selected: ${fileName}` : 'No image selected'}
        </p>
      </div>
    );
  },
};
