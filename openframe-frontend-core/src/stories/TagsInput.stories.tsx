import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { useState } from 'react';
import { TagsInput } from '../components/ui/tags-input';

const meta = {
  title: 'UI/TagsInput',
  component: TagsInput,
} satisfies Meta<typeof TagsInput>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Default TagsInput with no initial tags.
 */
export const Default: Story = {
  args: {
    value: [],
    onChange: () => {},
    placeholder: 'Add a tag...',
  },
  render: function Render(args) {
    const [tags, setTags] = useState<string[]>(args.value);
    return <TagsInput {...args} value={tags} onChange={setTags} />;
  },
};

/**
 * TagsInput with a label.
 */
export const WithLabel: Story = {
  args: {
    value: [],
    onChange: () => {},
    label: 'Tags',
    placeholder: 'Add a tag...',
  },
  render: function Render(args) {
    const [tags, setTags] = useState<string[]>(args.value);
    return <TagsInput {...args} value={tags} onChange={setTags} />;
  },
};

/**
 * TagsInput with initial tags.
 */
export const WithInitialTags: Story = {
  args: {
    value: ['React', 'TypeScript', 'Storybook'],
    onChange: () => {},
    label: 'Technologies',
    placeholder: 'Add technology...',
  },
  render: function Render(args) {
    const [tags, setTags] = useState<string[]>(args.value);
    return <TagsInput {...args} value={tags} onChange={setTags} />;
  },
};

/**
 * TagsInput with max tags limit.
 */
export const WithMaxTags: Story = {
  args: {
    value: ['Tag 1', 'Tag 2'],
    onChange: () => {},
    label: 'Limited Tags',
    placeholder: 'Add a tag...',
    maxTags: 5,
  },
  render: function Render(args) {
    const [tags, setTags] = useState<string[]>(args.value);
    return <TagsInput {...args} value={tags} onChange={setTags} />;
  },
};

/**
 * TagsInput at max capacity.
 */
export const MaxTagsReached: Story = {
  args: {
    value: ['One', 'Two', 'Three'],
    onChange: () => {},
    label: 'Max Reached',
    placeholder: 'Add a tag...',
    maxTags: 3,
  },
  render: function Render(args) {
    const [tags, setTags] = useState<string[]>(args.value);
    return <TagsInput {...args} value={tags} onChange={setTags} />;
  },
};

/**
 * Disabled TagsInput.
 */
export const Disabled: Story = {
  args: {
    value: ['Cannot', 'Remove', 'These'],
    onChange: () => {},
    label: 'Disabled',
    placeholder: 'Add a tag...',
    disabled: true,
  },
  render: function Render(args) {
    const [tags, setTags] = useState<string[]>(args.value);
    return <TagsInput {...args} value={tags} onChange={setTags} />;
  },
};

/**
 * TagsInput with custom placeholder.
 */
export const CustomPlaceholder: Story = {
  args: {
    value: [],
    onChange: () => {},
    label: 'Email Addresses',
    placeholder: 'Enter email address...',
  },
  render: function Render(args) {
    const [tags, setTags] = useState<string[]>(args.value);
    return <TagsInput {...args} value={tags} onChange={setTags} />;
  },
};

/**
 * All TagsInput variants displayed together for comparison.
 */
export const AllVariants: Story = {
  args: {
    value: [],
    onChange: () => {},
  },
  render: function Render() {
    const [tags1, setTags1] = useState<string[]>([]);
    const [tags2, setTags2] = useState<string[]>(['React', 'TypeScript']);
    const [tags3, setTags3] = useState<string[]>(['One', 'Two']);
    const [tags4, setTags4] = useState<string[]>(['Disabled', 'Tags']);

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', width: '400px' }}>
        <TagsInput
          value={tags1}
          onChange={setTags1}
          label="Default"
          placeholder="Add a tag..."
        />
        <TagsInput
          value={tags2}
          onChange={setTags2}
          label="With Initial Tags"
          placeholder="Add technology..."
        />
        <TagsInput
          value={tags3}
          onChange={setTags3}
          label="With Max Tags (3)"
          placeholder="Add a tag..."
          maxTags={3}
        />
        <TagsInput
          value={tags4}
          onChange={setTags4}
          label="Disabled"
          placeholder="Add a tag..."
          disabled
        />
      </div>
    );
  },
};
