import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { useState } from 'react';
import { Autocomplete, AutocompleteOption } from '../components/ui/autocomplete';

const meta: Meta = {
  title: 'UI/Autocomplete',
  component: Autocomplete,
};

export default meta;
type Story = StoryObj;

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

// ─── Single Select Stories ───

/**
 * Single select (default mode) — no selection.
 */
export const Single: Story = {
  render: function Render() {
    const [value, setValue] = useState<string | null>(null);
    return (
      <Autocomplete
        options={sampleOptions}
        value={value}
        onChange={setValue}
        label="Industry"
        placeholder="Select an industry..."
      />
    );
  },
};

/**
 * Single select with a pre-selected value.
 */
export const SingleWithValue: Story = {
  render: function Render() {
    const [value, setValue] = useState<string | null>('enterprise');
    return (
      <Autocomplete
        options={sampleOptions}
        value={value}
        onChange={setValue}
        label="Industry"
        placeholder="Select an industry..."
      />
    );
  },
};

/**
 * Single select disabled.
 */
export const SingleDisabled: Story = {
  render: function Render() {
    const [value, setValue] = useState<string | null>('startup');
    return (
      <Autocomplete
        options={sampleOptions}
        value={value}
        onChange={setValue}
        label="Disabled"
        disabled
      />
    );
  },
};

/**
 * Single select with error.
 */
export const SingleWithError: Story = {
  render: function Render() {
    const [value, setValue] = useState<string | null>(null);
    return (
      <Autocomplete
        options={sampleOptions}
        value={value}
        onChange={setValue}
        label="Industry"
        error="Please select an industry"
        placeholder="Select..."
      />
    );
  },
};

// ─── Multiple Select Stories ───

/**
 * Multiple select with no initial selection.
 */
export const Multiple: Story = {
  render: function Render() {
    const [value, setValue] = useState<string[]>([]);
    return (
      <Autocomplete
        multiple
        options={sampleOptions}
        value={value}
        onChange={setValue}
        label="Industries"
        placeholder="Search..."
      />
    );
  },
};

/**
 * Multiple select with pre-selected values.
 */
export const MultipleWithValues: Story = {
  render: function Render() {
    const [value, setValue] = useState<string[]>(['enterprise', 'startup', 'smb']);
    return (
      <Autocomplete
        multiple
        options={sampleOptions}
        value={value}
        onChange={setValue}
        placeholder="Add More..."
      />
    );
  },
};

/**
 * Multiple select with max selection limit.
 */
export const MultipleWithMaxItems: Story = {
  render: function Render() {
    const [value, setValue] = useState<string[]>(['enterprise', 'startup']);
    return (
      <Autocomplete
        multiple
        options={sampleOptions}
        value={value}
        onChange={setValue}
        label="Select up to 3 industries"
        maxItems={3}
      />
    );
  },
};

/**
 * Multiple select disabled.
 */
export const MultipleDisabled: Story = {
  render: function Render() {
    const [value, setValue] = useState<string[]>(['enterprise', 'startup']);
    return (
      <Autocomplete
        multiple
        options={sampleOptions}
        value={value}
        onChange={setValue}
        label="Disabled"
        disabled
      />
    );
  },
};

/**
 * Multiple select with validation error.
 */
export const MultipleWithError: Story = {
  render: function Render() {
    const [value, setValue] = useState<string[]>([]);
    return (
      <Autocomplete
        multiple
        options={sampleOptions}
        value={value}
        onChange={setValue}
        label="Industry"
        error="Please select at least one industry"
        placeholder="Select industries..."
      />
    );
  },
};

/**
 * Multiple select with freeSolo mode.
 */
export const MultipleFreeSolo: Story = {
  render: function Render() {
    const [value, setValue] = useState<string[]>([]);
    return (
      <Autocomplete
        multiple
        options={sampleOptions}
        value={value}
        onChange={setValue}
        label="Tags (type to create new)"
        freeSolo
        placeholder="Type and press Enter..."
      />
    );
  },
};

/**
 * Multiple select with limitTags.
 */
export const MultipleLimitTags: Story = {
  render: function Render() {
    const [value, setValue] = useState<string[]>(['enterprise', 'startup', 'smb', 'government', 'education']);
    return (
      <Autocomplete
        multiple
        options={sampleOptions}
        value={value}
        onChange={setValue}
        label="Limit Tags (2)"
        limitTags={2}
      />
    );
  },
};

/**
 * Multiple select with custom option rendering.
 */
export const MultipleCustomOptionRender: Story = {
  render: function Render() {
    const [value, setValue] = useState<string[]>([]);
    return (
      <Autocomplete
        multiple
        options={sampleOptions}
        value={value}
        onChange={setValue}
        label="With Custom Options"
        placeholder="Search..."
        renderOption={(option, isSelected) => (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor: isSelected ? '#22c55e' : '#888'
            }} />
            <span>{option.label}</span>
          </div>
        )}
      />
    );
  },
};

/**
 * Loading state.
 */
export const Loading: Story = {
  render: function Render() {
    const [value, setValue] = useState<string[]>([]);
    return (
      <Autocomplete
        multiple
        options={[]}
        value={value}
        onChange={setValue}
        label="Loading..."
        loading
        loadingText="Fetching options..."
        placeholder="Search..."
      />
    );
  },
};

/**
 * All variants displayed together for comparison.
 */
export const AllVariants: Story = {
  render: function Render() {
    const [singleValue, setSingleValue] = useState<string | null>(null);
    const [singleWithValue, setSingleWithValue] = useState<string | null>('enterprise');
    const [multiValue1, setMultiValue1] = useState<string[]>([]);
    const [multiValue2, setMultiValue2] = useState<string[]>(['enterprise', 'startup', 'smb']);
    const [multiValue3, setMultiValue3] = useState<string[]>(['enterprise', 'startup']);

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', width: '500px' }}>
        <Autocomplete
          options={sampleOptions}
          value={singleValue}
          onChange={setSingleValue}
          label="Single Select"
          placeholder="Select an industry..."
        />
        <Autocomplete
          options={sampleOptions}
          value={singleWithValue}
          onChange={setSingleWithValue}
          label="Single Select (with value)"
        />
        <Autocomplete
          multiple
          options={sampleOptions}
          value={multiValue1}
          onChange={setMultiValue1}
          label="Multiple Select"
          placeholder="Search..."
        />
        <Autocomplete
          multiple
          options={sampleOptions}
          value={multiValue2}
          onChange={setMultiValue2}
          label="Multiple with Values"
        />
        <Autocomplete
          multiple
          options={sampleOptions}
          value={multiValue3}
          onChange={setMultiValue3}
          label="Multiple with Max Items (3)"
          maxItems={3}
        />
        <Autocomplete
          options={sampleOptions}
          value={'enterprise' as string | null}
          onChange={() => {}}
          label="Single Disabled"
          disabled
        />
      </div>
    );
  },
};
