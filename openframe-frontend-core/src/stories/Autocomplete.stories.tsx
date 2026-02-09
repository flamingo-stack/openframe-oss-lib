import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { useState } from 'react';
import { Autocomplete, AutocompleteOption, AutocompleteProps } from '../components/ui/autocomplete';

const meta: Meta<AutocompleteProps<string>> = {
  title: 'UI/Autocomplete',
  component: Autocomplete,
};

export default meta;
type Story = StoryObj<AutocompleteProps<string>>;

const sampleOptions: AutocompleteOption<string>[] = [
  { label: 'Enterprise', value: 'enterprise' },
  { label: 'Startup', value: 'startup' },
  { label: 'SMB', value: 'smb' },
  { label: 'Government', value: 'government' },
  { label: 'Education', value: 'education' },
  { label: 'Non-Profit', value: 'nonprofit' },
  { label: 'Healthcare', value: 'healthcare' },
  { label: 'Finance', value: 'finance' },
  { label: 'Retail', value: 'retail' },
  { label: 'Technology', value: 'technology' },
];

/**
 * Default Autocomplete with no initial selection.
 */
export const Default: Story = {
  args: {
    options: sampleOptions,
    value: [],
    onChange: () => {},
    placeholder: 'Search...',
  },
  render: function Render(args) {
    const [value, setValue] = useState<string[]>(args.value);
    return <Autocomplete {...args} value={value} onChange={setValue} />;
  },
};

/**
 * Autocomplete with a label.
 */
export const WithLabel: Story = {
  args: {
    options: sampleOptions,
    value: [],
    onChange: () => {},
    label: 'Industry',
    placeholder: 'Select industries...',
  },
  render: function Render(args) {
    const [value, setValue] = useState<string[]>(args.value);
    return <Autocomplete {...args} value={value} onChange={setValue} />;
  },
};

/**
 * Autocomplete with pre-selected values (matching the Figma design).
 */
export const WithSelectedValues: Story = {
  args: {
    options: sampleOptions,
    value: ['enterprise', 'startup', 'smb'],
    onChange: () => {},
    placeholder: 'Add More...',
  },
  render: function Render(args) {
    const [value, setValue] = useState<string[]>(args.value);
    return <Autocomplete {...args} value={value} onChange={setValue} />;
  },
};

/**
 * Autocomplete without search icon.
 */
export const WithoutSearchIcon: Story = {
  args: {
    options: sampleOptions,
    value: ['enterprise'],
    onChange: () => {},
    showSearchIcon: false,
    placeholder: 'Add More...',
  },
  render: function Render(args) {
    const [value, setValue] = useState<string[]>(args.value);
    return <Autocomplete {...args} value={value} onChange={setValue} />;
  },
};

/**
 * Autocomplete with max selection limit.
 */
export const WithMaxItems: Story = {
  args: {
    options: sampleOptions,
    value: ['enterprise', 'startup'],
    onChange: () => {},
    label: 'Select up to 3 industries',
    maxItems: 3,
    placeholder: 'Add More...',
  },
  render: function Render(args) {
    const [value, setValue] = useState<string[]>(args.value);
    return <Autocomplete {...args} value={value} onChange={setValue} />;
  },
};

/**
 * Autocomplete at max capacity.
 */
export const MaxItemsReached: Story = {
  args: {
    options: sampleOptions,
    value: ['enterprise', 'startup', 'smb'],
    onChange: () => {},
    label: 'Max Reached (3)',
    maxItems: 3,
    placeholder: 'Add More...',
  },
  render: function Render(args) {
    const [value, setValue] = useState<string[]>(args.value);
    return <Autocomplete {...args} value={value} onChange={setValue} />;
  },
};

/**
 * Disabled Autocomplete.
 */
export const Disabled: Story = {
  args: {
    options: sampleOptions,
    value: ['enterprise', 'startup'],
    onChange: () => {},
    label: 'Disabled',
    disabled: true,
    placeholder: 'Add More...',
  },
  render: function Render(args) {
    const [value, setValue] = useState<string[]>(args.value);
    return <Autocomplete {...args} value={value} onChange={setValue} />;
  },
};

/**
 * Autocomplete with validation error.
 */
export const Invalid: Story = {
  args: {
    options: sampleOptions,
    value: [],
    onChange: () => {},
    label: 'Required field',
    invalid: true,
    placeholder: 'Select at least one...',
  },
  render: function Render(args) {
    const [value, setValue] = useState<string[]>(args.value);
    return <Autocomplete {...args} value={value} onChange={setValue} />;
  },
};

/**
 * Autocomplete with freeSolo mode (allows creating new options).
 */
export const FreeSolo: Story = {
  args: {
    options: sampleOptions,
    value: [],
    onChange: () => {},
    label: 'Tags (type to create new)',
    freeSolo: true,
    placeholder: 'Type and press Enter...',
  },
  render: function Render(args) {
    const [value, setValue] = useState<string[]>(args.value);
    return <Autocomplete {...args} value={value} onChange={setValue} />;
  },
};

/**
 * Autocomplete with custom option rendering.
 */
export const CustomOptionRender: Story = {
  args: {
    options: sampleOptions,
    value: [],
    onChange: () => {},
    label: 'With Custom Options',
    placeholder: 'Search...',
    renderOption: (option, isSelected) => (
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span style={{
          width: '8px',
          height: '8px',
          borderRadius: '50%',
          backgroundColor: isSelected ? '#22c55e' : '#888'
        }} />
        <span>{option.label}</span>
      </div>
    ),
  },
  render: function Render(args) {
    const [value, setValue] = useState<string[]>(args.value);
    return <Autocomplete {...args} value={value} onChange={setValue} />;
  },
};

/**
 * Autocomplete with limitTags - shows only first N tags and "+X" indicator.
 */
export const LimitTags: Story = {
  args: {
    options: sampleOptions,
    value: ['enterprise', 'startup', 'smb', 'government', 'education'],
    onChange: () => {},
    label: 'Limit Tags (2)',
    limitTags: 2,
    placeholder: 'Add More...',
  },
  render: function Render(args) {
    const [value, setValue] = useState<string[]>(args.value);
    return <Autocomplete {...args} value={value} onChange={setValue} />;
  },
};

/**
 * Autocomplete with limitTags and custom text.
 */
export const LimitTagsCustomText: Story = {
  args: {
    options: sampleOptions,
    value: ['enterprise', 'startup', 'smb', 'government', 'education', 'nonprofit'],
    onChange: () => {},
    label: 'Limit Tags with Custom Text',
    limitTags: 2,
    getLimitTagsText: (more) => `ещё ${more}`,
    placeholder: 'Add More...',
  },
  render: function Render(args) {
    const [value, setValue] = useState<string[]>(args.value);
    return <Autocomplete {...args} value={value} onChange={setValue} />;
  },
};

/**
 * Loading state.
 */
export const Loading: Story = {
  args: {
    options: [],
    value: [],
    onChange: () => {},
    label: 'Loading...',
    loading: true,
    loadingText: 'Fetching options...',
    placeholder: 'Search...',
  },
  render: function Render(args) {
    const [value, setValue] = useState<string[]>(args.value);
    return <Autocomplete {...args} value={value} onChange={setValue} />;
  },
};

/**
 * All Autocomplete variants displayed together for comparison.
 */
export const AllVariants: Story = {
  args: {
    options: sampleOptions,
    value: [],
    onChange: () => {},
  },
  render: function Render() {
    const [value1, setValue1] = useState<string[]>([]);
    const [value2, setValue2] = useState<string[]>(['enterprise', 'startup', 'smb']);
    const [value3, setValue3] = useState<string[]>(['enterprise', 'startup']);
    const [value4, setValue4] = useState<string[]>(['enterprise']);

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', width: '500px' }}>
        <Autocomplete
          options={sampleOptions}
          value={value1}
          onChange={setValue1}
          label="Default"
          placeholder="Search..."
        />
        <Autocomplete
          options={sampleOptions}
          value={value2}
          onChange={setValue2}
          label="With Selected Values"
          placeholder="Add More..."
        />
        <Autocomplete
          options={sampleOptions}
          value={value3}
          onChange={setValue3}
          label="With Max Items (3)"
          maxItems={3}
          placeholder="Add More..."
        />
        <Autocomplete
          options={sampleOptions}
          value={value4}
          onChange={setValue4}
          label="Disabled"
          disabled
          placeholder="Add More..."
        />
      </div>
    );
  },
};
