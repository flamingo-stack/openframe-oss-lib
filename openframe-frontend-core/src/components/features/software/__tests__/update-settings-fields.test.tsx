/**
 * "Update Settings": which fields each choice shows, and that the form hands
 * the settings to its submit for UPDATE only.
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import {
  SoftwareActionForm,
  type SoftwareActionFormProps,
  type SoftwareActionFormValues,
} from '../software-action-form';
import {
  DEFAULT_SOFTWARE_UPDATE_SETTINGS,
  SoftwareUpdateSettingsFields,
  type SoftwareUpdateSettingsValues,
} from '../update-settings-fields';

function Harness({ initial = DEFAULT_SOFTWARE_UPDATE_SETTINGS }: { initial?: SoftwareUpdateSettingsValues }) {
  const [value, setValue] = useState(initial);
  return <SoftwareUpdateSettingsFields value={value} onChange={setValue} />;
}

/** The header's primary button; the phone's bottom bar draws a second copy of it. */
const submitButton = (name: string) => screen.getAllByRole('button', { name })[0];

const base: SoftwareActionFormProps = {
  action: 'UPDATE',
  onSubmit: () => {},
  timing: {
    timeReferenceOptions: [{ value: 'SERVER', label: 'Your account timezone' }],
    getTimeOptions: () => [],
    getEarliestDay: () => undefined,
    getStartError: () => undefined,
  },
  initialValues: { timeReference: 'SERVER' },
  renderPackageSearch: () => <span>package field</span>,
  renderDevicePicker: () => <span>device picker</span>,
};

describe('SoftwareUpdateSettingsFields', () => {
  it('opens on the defaults: wait & notify, 7 days, 5 minutes, auto-updated with the same settings', () => {
    render(<Harness />);
    expect(screen.getByRole('radio', { name: /Wait & notify/ }).getAttribute('aria-checked')).toBe('true');
    expect(screen.getByLabelText('Deadline').textContent).toContain('7 days after the first try');
    expect(screen.getByLabelText('Countdown').textContent).toContain('5 minutes');
    expect(screen.getByRole('checkbox', { name: /Keep it auto-updated/ }).getAttribute('aria-checked')).toBe('true');
    expect(screen.getByRole('checkbox', { name: /Same settings for auto-update/ })).toBeTruthy();
    expect(screen.queryByText('For auto-updates')).toBeNull();
  });

  it('Force Update keeps only the countdown, and says later releases are forced too', () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole('radio', { name: /Force Update/ }));
    expect(screen.queryByRole('checkbox', { name: /Countdown after the deadline/ })).toBeNull();
    expect(screen.queryByLabelText('Deadline')).toBeNull();
    expect(screen.getByLabelText('Countdown')).toBeTruthy();
    expect(screen.getByText('Later releases will also be force-updated.')).toBeTruthy();
  });

  it('without a deadline there is nothing to pick', () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole('checkbox', { name: /Countdown after the deadline/ }));
    expect(screen.queryByLabelText('Deadline')).toBeNull();
    expect(screen.queryByLabelText('Countdown')).toBeNull();
  });

  it('auto-update off hides its settings; separate settings get their own block', () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole('checkbox', { name: /Same settings for auto-update/ }));
    expect(screen.getByText('For auto-updates')).toBeTruthy();
    expect(screen.getAllByRole('radiogroup')).toHaveLength(2);

    fireEvent.click(screen.getByRole('checkbox', { name: /Keep it auto-updated/ }));
    expect(screen.queryByRole('checkbox', { name: /Same settings for auto-update/ })).toBeNull();
    expect(screen.queryByText('For auto-updates')).toBeNull();
  });
});

describe('SoftwareActionForm update settings', () => {
  it('UPDATE shows them and submits them', () => {
    const onSubmit = vi.fn<(values: SoftwareActionFormValues) => void>();
    render(<SoftwareActionForm {...base} onSubmit={onSubmit} />);
    expect(screen.getByRole('heading', { name: 'Update Settings' })).toBeTruthy();
    fireEvent.click(submitButton('Run Update'));
    expect(onSubmit.mock.calls[0][0].updateSettings).toEqual(DEFAULT_SOFTWARE_UPDATE_SETTINGS);
  });

  it('INSTALL has none', () => {
    const onSubmit = vi.fn<(values: SoftwareActionFormValues) => void>();
    render(<SoftwareActionForm {...base} action="INSTALL" onSubmit={onSubmit} />);
    expect(screen.queryByRole('heading', { name: 'Update Settings' })).toBeNull();
    fireEvent.click(submitButton('Run Installation'));
    expect(onSubmit.mock.calls[0][0].updateSettings).toBeUndefined();
  });

  it('showUpdateSettings={false} hides them and submits none', () => {
    const onSubmit = vi.fn<(values: SoftwareActionFormValues) => void>();
    render(<SoftwareActionForm {...base} showUpdateSettings={false} onSubmit={onSubmit} />);
    expect(screen.queryByRole('heading', { name: 'Update Settings' })).toBeNull();
    fireEvent.click(submitButton('Run Update'));
    expect(onSubmit.mock.calls[0][0].updateSettings).toBeUndefined();
  });
});
