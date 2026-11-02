/**
 * `SoftwareActionForm` layout options: the default form is unchanged, and each
 * option takes away (or rearranges) exactly its own block.
 */

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SoftwareActionForm, type SoftwareActionFormProps } from '../software-action-form';

const base: SoftwareActionFormProps = {
  action: 'UPDATE',
  showHeader: false,
  onSubmit: () => {},
  timing: {
    timeReferenceOptions: [{ value: 'SERVER', label: 'Your account timezone' }],
    getTimeOptions: () => [{ value: '23:00', label: '11:00 PM' }],
    getEarliestDay: () => undefined,
    getStartError: () => undefined,
  },
  initialValues: { mode: 'schedule', time: '23:00', timeReference: 'SERVER' },
  renderPackageSearch: () => <span>package field</span>,
  renderDevicePicker: () => <span>device picker</span>,
};

describe('SoftwareActionForm layout options', () => {
  it('by default offers more packages, stacks the run choice and titles the picker', () => {
    render(<SoftwareActionForm {...base} />);
    expect(screen.getByRole('button', { name: 'Add Software' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Device Selection' })).toBeTruthy();
    expect(screen.getByRole('radiogroup').getAttribute('aria-orientation')).toBe('vertical');
    expect(screen.getByText('Timezone')).toBeTruthy();
    expect(screen.getByText('device picker')).toBeTruthy();
  });

  it('addRows={false} is a one-package form', () => {
    render(<SoftwareActionForm {...base} addRows={false} />);
    expect(screen.queryByRole('button', { name: 'Add Software' })).toBeNull();
    expect(screen.getByText('package field')).toBeTruthy();
  });

  it('showDeviceHeading={false} leaves the picker untitled', () => {
    render(<SoftwareActionForm {...base} showDeviceHeading={false} />);
    expect(screen.queryByRole('heading', { name: 'Device Selection' })).toBeNull();
    expect(screen.getByText('device picker')).toBeTruthy();
  });

  it('runModeLayout="inline" puts the choices side by side and keeps the schedule fields', () => {
    render(<SoftwareActionForm {...base} runModeLayout="inline" />);
    expect(screen.getByRole('radiogroup').getAttribute('aria-orientation')).toBe('horizontal');
    expect(screen.getAllByRole('radio')).toHaveLength(2);
    expect(screen.getByText('Date')).toBeTruthy();
    expect(screen.getByText('Timezone')).toBeTruthy();
  });
});
