/**
 * Update settings: which deadlines and countdowns each choice offers, with and without user notifications, and that
 * the form hands the settings to its submit for UPDATE only.
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import {
  SoftwareActionForm,
  type SoftwareActionFormProps,
  type SoftwareActionFormValues,
} from '../software-action-form';
import {
  availableSoftwareUpdateSettings,
  DEFAULT_SOFTWARE_UPDATE_POLICY,
  DEFAULT_SOFTWARE_UPDATE_SETTINGS,
  SoftwareUpdateSettingsFields,
  type SoftwareUpdateSettingsValues,
} from '../update-settings-fields';

// Radix Select scrolls to and captures the pointer of what it opens; jsdom has neither.
beforeAll(() => {
  Element.prototype.scrollIntoView ??= () => {};
  Element.prototype.hasPointerCapture ??= () => false;
  Element.prototype.releasePointerCapture ??= () => {};
});

function Harness({
  initial = DEFAULT_SOFTWARE_UPDATE_SETTINGS,
  userNotifications,
  onValue,
}: {
  initial?: SoftwareUpdateSettingsValues;
  userNotifications?: boolean;
  onValue?: (value: SoftwareUpdateSettingsValues) => void;
}) {
  const [value, setValue] = useState(initial);
  return (
    <SoftwareUpdateSettingsFields
      value={value}
      onChange={next => {
        setValue(next);
        onValue?.(next);
      }}
      userNotifications={userNotifications}
    />
  );
}

const DEADLINE = 'Deadline if app is open';
const COUNTDOWN = 'Countdown before closing';

const field = (name: string) => screen.queryAllByRole('combobox', { name });

/** Opens a dropdown and returns what it offers. */
function openOptions(name: string, index = 0): string[] {
  fireEvent.keyDown(field(name)[index], { key: 'ArrowDown' });
  return screen.getAllByRole('option').map(option => option.textContent ?? '');
}

function pick(name: string, option: string, index = 0) {
  openOptions(name, index);
  fireEvent.click(screen.getByRole('option', { name: option }));
}

/** The defaults (a 7-day deadline) as a form without user notifications sends them. */
const FORCE_SETTINGS: SoftwareUpdateSettingsValues = {
  ...DEFAULT_SOFTWARE_UPDATE_SETTINGS,
  policy: { ...DEFAULT_SOFTWARE_UPDATE_POLICY, mode: 'FORCE', deadlineEnabled: false },
  autoUpdatePolicy: { ...DEFAULT_SOFTWARE_UPDATE_POLICY, mode: 'FORCE', deadlineEnabled: false },
};

describe('SoftwareUpdateSettingsFields without user notifications', () => {
  it('opens on Force update right away, with no countdown, and offers only what needs nobody warned', () => {
    render(<Harness />);
    expect(field(DEADLINE)[0].textContent).toBe('Force update right away');
    expect(field(COUNTDOWN)).toHaveLength(0);
    expect(openOptions(DEADLINE)).toEqual(['Force update right away', 'Update when app closes']);
    expect(screen.getByText('Later releases will also be force-updated.')).toBeTruthy();
  });

  it('"Update when app closes" waits for the app with no deadline', () => {
    const onValue = vi.fn<(value: SoftwareUpdateSettingsValues) => void>();
    render(<Harness onValue={onValue} />);
    pick(DEADLINE, 'Update when app closes');
    expect(onValue.mock.lastCall?.[0].policy).toMatchObject({ mode: 'WAIT', deadlineEnabled: false });
    expect(field(COUNTDOWN)).toHaveLength(0);
  });

  it('separate auto-update settings get the same two choices', () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole('checkbox', { name: /Same settings for auto-update/ }));
    expect(screen.getByText('For auto-updates')).toBeTruthy();
    expect(field(DEADLINE)).toHaveLength(2);
    expect(openOptions(DEADLINE, 1)).toEqual(['Force update right away', 'Update when app closes']);
  });
});

describe('availableSoftwareUpdateSettings', () => {
  it('a deadline reads as Force Update, on both policies; the countdown value stays', () => {
    const waits: SoftwareUpdateSettingsValues = {
      ...DEFAULT_SOFTWARE_UPDATE_SETTINGS,
      autoUpdatePolicy: { ...DEFAULT_SOFTWARE_UPDATE_POLICY, countdownSeconds: 900 },
    };
    expect(availableSoftwareUpdateSettings(waits, false)).toEqual({
      ...FORCE_SETTINGS,
      autoUpdatePolicy: { ...FORCE_SETTINGS.autoUpdatePolicy, countdownSeconds: 900 },
    });
  });

  it('waiting for the app to close needs nobody warned, so it stays', () => {
    const whenClosed: SoftwareUpdateSettingsValues = {
      ...FORCE_SETTINGS,
      policy: { ...DEFAULT_SOFTWARE_UPDATE_POLICY, deadlineEnabled: false },
    };
    expect(availableSoftwareUpdateSettings(whenClosed, false)).toBe(whenClosed);
  });

  it('with user notifications, or already on Force Update, the settings come back as they are', () => {
    expect(availableSoftwareUpdateSettings(DEFAULT_SOFTWARE_UPDATE_SETTINGS, true)).toBe(
      DEFAULT_SOFTWARE_UPDATE_SETTINGS,
    );
    expect(availableSoftwareUpdateSettings(FORCE_SETTINGS, false)).toBe(FORCE_SETTINGS);
  });
});

describe('SoftwareUpdateSettingsFields with user notifications', () => {
  it('opens on the defaults: 7 days after the first try, a 5 minute countdown, auto-updated with the same settings', () => {
    render(<Harness userNotifications />);
    expect(field(DEADLINE)[0].textContent).toBe('7 days after the first try');
    expect(field(COUNTDOWN)[0].textContent).toBe('5 minutes');
    expect(screen.getByRole('checkbox', { name: /Keep it auto-updated/ }).getAttribute('aria-checked')).toBe('true');
    expect(screen.getByRole('checkbox', { name: /Same settings for auto-update/ })).toBeTruthy();
    expect(screen.queryByText('For auto-updates')).toBeNull();
  });

  it('offers every deadline, from right away to when the app closes', () => {
    render(<Harness userNotifications />);
    expect(openOptions(DEADLINE)).toEqual([
      'Force update right away',
      '1 day after the first try',
      '3 days after the first try',
      '7 days after the first try',
      '14 days after the first try',
      '30 days after the first try',
      'Update when app closes',
    ]);
  });

  it('each deadline is the policy the server takes', () => {
    const onValue = vi.fn<(value: SoftwareUpdateSettingsValues) => void>();
    render(<Harness userNotifications onValue={onValue} />);
    pick(DEADLINE, 'Force update right away');
    expect(onValue.mock.lastCall?.[0].policy).toMatchObject({ mode: 'FORCE', deadlineEnabled: false });
    pick(DEADLINE, '3 days after the first try');
    expect(onValue.mock.lastCall?.[0].policy).toMatchObject({
      mode: 'WAIT',
      deadlineEnabled: true,
      deadlineSeconds: 3 * 86_400,
    });
    pick(COUNTDOWN, '15 minutes');
    expect(onValue.mock.lastCall?.[0].policy.countdownSeconds).toBe(900);
  });

  it('Force Update keeps the countdown and says later releases are forced too', () => {
    render(<Harness userNotifications />);
    pick(DEADLINE, 'Force update right away');
    expect(field(COUNTDOWN)).toHaveLength(1);
    expect(screen.getByText('Later releases will also be force-updated.')).toBeTruthy();
  });

  it('waiting for the app to close never closes it: no countdown', () => {
    render(<Harness userNotifications />);
    pick(DEADLINE, 'Update when app closes');
    expect(field(COUNTDOWN)).toHaveLength(0);
  });

  it('auto-update off hides its settings; separate settings get their own block', () => {
    render(<Harness userNotifications />);
    fireEvent.click(screen.getByRole('checkbox', { name: /Same settings for auto-update/ }));
    expect(screen.getByText('For auto-updates')).toBeTruthy();
    expect(field(DEADLINE)).toHaveLength(2);

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

describe('SoftwareActionForm update settings', () => {
  it('UPDATE shows them and submits them', () => {
    const onSubmit = vi.fn<(values: SoftwareActionFormValues) => void>();
    render(<SoftwareActionForm {...base} updateUserNotifications onSubmit={onSubmit} />);
    expect(screen.getByRole('region', { name: 'Update Settings' })).toBeTruthy();
    fireEvent.click(submitButton('Run Update'));
    expect(onSubmit.mock.calls[0][0].updateSettings).toEqual(DEFAULT_SOFTWARE_UPDATE_SETTINGS);
  });

  it('without user notifications a deadline it opens with is submitted as Force Update', () => {
    const onSubmit = vi.fn<(values: SoftwareActionFormValues) => void>();
    render(
      <SoftwareActionForm
        {...base}
        initialValues={{ ...base.initialValues, updateSettings: DEFAULT_SOFTWARE_UPDATE_SETTINGS }}
        onSubmit={onSubmit}
      />,
    );
    expect(screen.getByRole('combobox', { name: DEADLINE }).textContent).toBe('Force update right away');
    fireEvent.click(submitButton('Run Update'));
    expect(onSubmit.mock.calls[0][0].updateSettings).toEqual(FORCE_SETTINGS);
  });

  it('INSTALL has none', () => {
    const onSubmit = vi.fn<(values: SoftwareActionFormValues) => void>();
    render(<SoftwareActionForm {...base} action="INSTALL" onSubmit={onSubmit} />);
    expect(screen.queryByRole('region', { name: 'Update Settings' })).toBeNull();
    fireEvent.click(submitButton('Run Installation'));
    expect(onSubmit.mock.calls[0][0].updateSettings).toBeUndefined();
  });

  it('a host that does not ask for them gets none and submits none', () => {
    const onSubmit = vi.fn<(values: SoftwareActionFormValues) => void>();
    const { showUpdateSettings: _, ...withoutSettings } = base;
    render(<SoftwareActionForm {...withoutSettings} onSubmit={onSubmit} />);
    expect(screen.queryByRole('region', { name: 'Update Settings' })).toBeNull();
    fireEvent.click(submitButton('Run Update'));
    expect(onSubmit.mock.calls[0][0].updateSettings).toBeUndefined();
  });
});
