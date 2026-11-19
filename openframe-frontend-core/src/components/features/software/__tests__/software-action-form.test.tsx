/**
 * `SoftwareActionForm` layout options: the default form is unchanged, and each
 * option takes away (or rearranges) exactly its own block.
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import {
  type SoftwareActionFormValues,
  SoftwareActionForm,
  type SoftwareActionFormProps,
  type SoftwareDeviceScope,
} from '../software-action-form';

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

describe('SoftwareActionForm run modes', () => {
  it('say when a device actually gets the run: offline devices get it once online, a schedule within 7 days', () => {
    render(<SoftwareActionForm {...base} />);
    expect(
      screen.getByText('The update starts now on online devices, and on the others when they come online.'),
    ).toBeTruthy();
    expect(
      screen.getByText(
        'The update runs at the scheduled time. Devices offline then get it when they come back online, within 7 days.',
      ),
    ).toBeTruthy();
    expect(screen.queryByText(/immediately/)).toBeNull();
  });
});

describe('SoftwareActionForm on one title', () => {
  const software = { name: 'Google Chrome', osTypes: ['WINDOWS'], summary: <span>title card</span> };

  it('is titled by it, draws its card instead of the rows and scopes the picker to its systems', () => {
    const renderDevicePicker = vi.fn((scope: SoftwareDeviceScope) => <span>{scope.osTypesKey}</span>);
    render(<SoftwareActionForm {...base} showHeader software={software} renderDevicePicker={renderDevicePicker} />);
    expect(screen.getByRole('heading', { name: 'Update Google Chrome' })).toBeTruthy();
    expect(screen.getByText('title card')).toBeTruthy();
    expect(screen.queryByText('package field')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Add Software' })).toBeNull();
    expect(renderDevicePicker).toHaveBeenLastCalledWith({ osTypes: ['WINDOWS'], osTypesKey: 'WINDOWS' });
  });

  it('submits no rows: the server picks the package', () => {
    const onSubmit = vi.fn<(values: SoftwareActionFormValues) => void>();
    render(<SoftwareActionForm {...base} showHeader software={software} onSubmit={onSubmit} />);
    fireEvent.click(screen.getAllByRole('button', { name: 'Schedule Update' })[0]);
    expect(onSubmit.mock.calls[0][0].rows).toEqual([]);
  });
});
