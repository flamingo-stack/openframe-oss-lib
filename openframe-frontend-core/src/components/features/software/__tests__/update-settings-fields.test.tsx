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
  DEFAULT_SOFTWARE_UPDATE_POLICY,
  DEFAULT_SOFTWARE_UPDATE_SETTINGS,
  defaultSoftwareUpdateSettings,
  SoftwareUpdateSettingsFields,
  type SoftwareUpdateSettingsValues,
} from '../update-settings-fields';

function Harness({
  initial = DEFAULT_SOFTWARE_UPDATE_SETTINGS,
  userNotifications,
}: {
  initial?: SoftwareUpdateSettingsValues;
  userNotifications?: boolean;
}) {
  const [value, setValue] = useState(initial);
  return <SoftwareUpdateSettingsFields value={value} onChange={setValue} userNotifications={userNotifications} />;
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
  showUpdateSettings: true,
};

/** What a form without user notifications opens with: Force Update, on both policies. */
const FORCE_SETTINGS: SoftwareUpdateSettingsValues = {
  ...DEFAULT_SOFTWARE_UPDATE_SETTINGS,
  policy: { ...DEFAULT_SOFTWARE_UPDATE_POLICY, mode: 'FORCE', deadlineEnabled: false },
  autoUpdatePolicy: { ...DEFAULT_SOFTWARE_UPDATE_POLICY, mode: 'FORCE', deadlineEnabled: false },
};

function SilentHarness({ onValue }: { onValue?: (value: SoftwareUpdateSettingsValues) => void }) {
  const [value, setValue] = useState(defaultSoftwareUpdateSettings(false));
  return (
    <SoftwareUpdateSettingsFields
      value={value}
      onChange={next => {
        setValue(next);
        onValue?.(next);
      }}
    />
  );
}

describe('SoftwareUpdateSettingsFields without user notifications', () => {
  it('opens on Force Update, offers Wait beside it, and promises no prompt or countdown', () => {
    render(<SilentHarness />);
    expect(screen.getByRole('radio', { name: /Force Update/ }).getAttribute('aria-checked')).toBe('true');
    expect(screen.getByRole('radio', { name: /^Wait/ })).toBeTruthy();
    expect(screen.getByText('The app closes and updates.')).toBeTruthy();
    expect(screen.queryByText(/notify|Ask Later|countdown/i)).toBeNull();
    expect(screen.queryByLabelText('Countdown')).toBeNull();
  });

  it('Wait waits for the app to close; its deadline says the app is closed without warning', () => {
    const onValue = vi.fn<(value: SoftwareUpdateSettingsValues) => void>();
    render(<SilentHarness onValue={onValue} />);
    fireEvent.click(screen.getByRole('radio', { name: /^Wait/ }));
    expect(screen.getByText('The update waits until the user closes the app.')).toBeTruthy();
    expect(onValue.mock.lastCall?.[0].policy).toMatchObject({ mode: 'WAIT', deadlineEnabled: false });

    fireEvent.click(screen.getByRole('checkbox', { name: /Close the app after a deadline/ }));
    expect(
      screen.getByText('If the app is still open by the deadline, it is closed without warning and updated.'),
    ).toBeTruthy();
    expect(screen.getByLabelText('Deadline').textContent).toContain('7 days after the first try');
    expect(screen.queryByLabelText('Countdown')).toBeNull();
    expect(onValue.mock.lastCall?.[0].policy).toMatchObject({
      mode: 'WAIT',
      deadlineEnabled: true,
      deadlineSeconds: 7 * 86_400,
    });
  });

  it('separate auto-update settings get the same two choices', () => {
    render(<SilentHarness />);
    fireEvent.click(screen.getByRole('checkbox', { name: /Same settings for auto-update/ }));
    expect(screen.getByText('For auto-updates')).toBeTruthy();
    expect(screen.getAllByRole('radio', { name: /^Wait/ })).toHaveLength(2);
    expect(screen.queryByLabelText('Countdown')).toBeNull();
  });
});

describe('defaultSoftwareUpdateSettings', () => {
  it('with user notifications, the server defaults; without, Force Update on both policies', () => {
    expect(defaultSoftwareUpdateSettings(true)).toBe(DEFAULT_SOFTWARE_UPDATE_SETTINGS);
    expect(defaultSoftwareUpdateSettings(false)).toEqual(FORCE_SETTINGS);
  });
});

describe('SoftwareUpdateSettingsFields with user notifications', () => {
  it('opens on the defaults: wait & notify, 7 days, 5 minutes, auto-updated with the same settings', () => {
    render(<Harness userNotifications />);
    expect(screen.getByRole('radio', { name: /Wait & notify/ }).getAttribute('aria-checked')).toBe('true');
    expect(screen.getByLabelText('Deadline').textContent).toContain('7 days after the first try');
    expect(screen.getByLabelText('Countdown').textContent).toContain('5 minutes');
    expect(screen.getByRole('checkbox', { name: /Keep it auto-updated/ }).getAttribute('aria-checked')).toBe('true');
    expect(screen.getByRole('checkbox', { name: /Same settings for auto-update/ })).toBeTruthy();
    expect(screen.queryByText('For auto-updates')).toBeNull();
  });

  it('Force Update keeps only the countdown, and says later releases are forced too', () => {
    render(<Harness userNotifications />);
    fireEvent.click(screen.getByRole('radio', { name: /Force Update/ }));
    expect(screen.queryByRole('checkbox', { name: /Countdown after the deadline/ })).toBeNull();
    expect(screen.queryByLabelText('Deadline')).toBeNull();
    expect(screen.getByLabelText('Countdown')).toBeTruthy();
    expect(screen.getByText('Later releases will also be force-updated.')).toBeTruthy();
  });

  it('without a deadline there is nothing to pick', () => {
    render(<Harness userNotifications />);
    fireEvent.click(screen.getByRole('checkbox', { name: /Countdown after the deadline/ }));
    expect(screen.queryByLabelText('Deadline')).toBeNull();
    expect(screen.queryByLabelText('Countdown')).toBeNull();
  });

  it('auto-update off hides its settings; separate settings get their own block', () => {
    render(<Harness userNotifications />);
    fireEvent.click(screen.getByRole('checkbox', { name: /Same settings for auto-update/ }));
    expect(screen.getByText('For auto-updates')).toBeTruthy();
    expect(screen.getAllByRole('radiogroup')).toHaveLength(2);

    fireEvent.click(screen.getByRole('checkbox', { name: /Keep it auto-updated/ }));
    expect(screen.queryByRole('checkbox', { name: /Same settings for auto-update/ })).toBeNull();
    expect(screen.queryByText('For auto-updates')).toBeNull();
  });

  it('the reinstall note comes and goes with auto-update', () => {
    render(<Harness userNotifications />);
    expect(screen.getByRole('note').textContent).toContain('Apps installed by hand get reinstalled');
    fireEvent.click(screen.getByRole('checkbox', { name: /Keep it auto-updated/ }));
    expect(screen.queryByRole('note')).toBeNull();
    fireEvent.click(screen.getByRole('checkbox', { name: /Keep it auto-updated/ }));
    expect(screen.getByRole('note')).toBeTruthy();
  });
});

describe('SoftwareActionForm update settings', () => {
  it('UPDATE shows them and submits them', () => {
    const onSubmit = vi.fn<(values: SoftwareActionFormValues) => void>();
    render(<SoftwareActionForm {...base} updateUserNotifications onSubmit={onSubmit} />);
    expect(screen.getByRole('heading', { name: 'Update Settings' })).toBeTruthy();
    fireEvent.click(submitButton('Run Update'));
    expect(onSubmit.mock.calls[0][0].updateSettings).toEqual(DEFAULT_SOFTWARE_UPDATE_SETTINGS);
  });

  it('without user notifications it opens on Force Update and submits that', () => {
    const onSubmit = vi.fn<(values: SoftwareActionFormValues) => void>();
    render(<SoftwareActionForm {...base} onSubmit={onSubmit} />);
    expect(screen.queryByRole('radio', { name: /Wait & notify/ })).toBeNull();
    fireEvent.click(submitButton('Run Update'));
    expect(onSubmit.mock.calls[0][0].updateSettings).toEqual(FORCE_SETTINGS);
  });

  it('INSTALL has none', () => {
    const onSubmit = vi.fn<(values: SoftwareActionFormValues) => void>();
    render(<SoftwareActionForm {...base} action="INSTALL" onSubmit={onSubmit} />);
    expect(screen.queryByRole('heading', { name: 'Update Settings' })).toBeNull();
    fireEvent.click(submitButton('Run Installation'));
    expect(onSubmit.mock.calls[0][0].updateSettings).toBeUndefined();
  });

  it('a host that does not ask for them gets none and submits none', () => {
    const onSubmit = vi.fn<(values: SoftwareActionFormValues) => void>();
    const { showUpdateSettings: _, ...withoutSettings } = base;
    render(<SoftwareActionForm {...withoutSettings} onSubmit={onSubmit} />);
    expect(screen.queryByRole('heading', { name: 'Update Settings' })).toBeNull();
    fireEvent.click(submitButton('Run Update'));
    expect(onSubmit.mock.calls[0][0].updateSettings).toBeUndefined();
  });
});
