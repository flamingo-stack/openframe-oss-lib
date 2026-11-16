/**
 * Update settings: what "Deadline if app is open" and "Countdown before closing" offer with and without user
 * notifications, and that the form hands the settings to its submit for UPDATE only.
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
  DEFAULT_SOFTWARE_UPDATE_POLICY,
  DEFAULT_SOFTWARE_UPDATE_SETTINGS,
  defaultSoftwareUpdateSettings,
  SoftwareUpdatePolicyFields,
  SoftwareUpdateSettingsFields,
  type SoftwareUpdatePolicy,
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
  showAutoUpdate,
  onValue,
}: {
  initial?: SoftwareUpdateSettingsValues;
  userNotifications?: boolean;
  showAutoUpdate?: boolean;
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
      showAutoUpdate={showAutoUpdate}
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

const ALL_DEADLINES = [
  'Force update right away',
  '1 day after the first try',
  '3 days after the first try',
  '7 days after the first try',
  '14 days after the first try',
  '30 days after the first try',
  'Update when app closes',
];

/** What a form without user notifications opens with: Force Update, on both policies. */
const FORCE_SETTINGS: SoftwareUpdateSettingsValues = {
  ...DEFAULT_SOFTWARE_UPDATE_SETTINGS,
  policy: { ...DEFAULT_SOFTWARE_UPDATE_POLICY, mode: 'FORCE', deadlineEnabled: false },
  autoUpdatePolicy: { ...DEFAULT_SOFTWARE_UPDATE_POLICY, mode: 'FORCE', deadlineEnabled: false },
};

describe('SoftwareUpdateSettingsFields without user notifications', () => {
  it('opens on Force update right away, says the app closes unannounced, and has no countdown', () => {
    render(<Harness initial={defaultSoftwareUpdateSettings(false)} />);
    expect(field(DEADLINE)[0].textContent).toBe('Force update right away');
    expect(field(COUNTDOWN)).toHaveLength(0);
    // Force is not instant: the agent waits the (silent) countdown before it closes the app.
    expect(screen.getByText('The app is closed without warning 5 minutes later, then updated.')).toBeTruthy();
    expect(screen.queryByText(/notify|Ask Later/i)).toBeNull();
  });

  it('offers every deadline, each saying what the device does with nobody told', () => {
    const onValue = vi.fn<(value: SoftwareUpdateSettingsValues) => void>();
    render(<Harness initial={defaultSoftwareUpdateSettings(false)} onValue={onValue} />);
    expect(openOptions(DEADLINE)).toEqual(ALL_DEADLINES);
    fireEvent.click(screen.getByRole('option', { name: 'Update when app closes' }));
    expect(screen.getByText('The update waits until the user closes the app.')).toBeTruthy();
    expect(onValue.mock.lastCall?.[0].policy).toMatchObject({ mode: 'WAIT', deadlineEnabled: false });

    pick(DEADLINE, '14 days after the first try');
    expect(
      screen.getByText(
        'If the app is still open by the deadline, it is closed without warning 5 minutes later, then updated.',
      ),
    ).toBeTruthy();
    expect(field(COUNTDOWN)).toHaveLength(0);
    expect(onValue.mock.lastCall?.[0].policy).toMatchObject({
      mode: 'WAIT',
      deadlineEnabled: true,
      deadlineSeconds: 14 * 86_400,
    });
  });

  it('says how long the silent wait before a forced close is, from the policy it draws', () => {
    render(<Harness initial={{ ...FORCE_SETTINGS, policy: { ...FORCE_SETTINGS.policy, countdownSeconds: 900 } }} />);
    expect(screen.getByText('The app is closed without warning 15 minutes later, then updated.')).toBeTruthy();
  });

  it('auto-update says that leaving it off does not stop an auto-update already on', () => {
    render(<Harness initial={defaultSoftwareUpdateSettings(false)} />);
    expect(screen.getByText(/Leaving it off does not turn off auto-update that is already on there\./)).toBeTruthy();
  });

  it('separate auto-update settings get a deadline of their own', () => {
    render(<Harness initial={defaultSoftwareUpdateSettings(false)} />);
    fireEvent.click(screen.getByRole('checkbox', { name: /Same settings for auto-update/ }));
    expect(screen.getByText('For auto-updates')).toBeTruthy();
    expect(field(DEADLINE)).toHaveLength(2);
    expect(field(COUNTDOWN)).toHaveLength(0);
  });
});

describe('defaultSoftwareUpdateSettings', () => {
  it('with user notifications, the server defaults; without, Force Update on both policies', () => {
    expect(defaultSoftwareUpdateSettings(true)).toBe(DEFAULT_SOFTWARE_UPDATE_SETTINGS);
    expect(defaultSoftwareUpdateSettings(false)).toEqual(FORCE_SETTINGS);
  });
});

describe('SoftwareUpdateSettingsFields with user notifications', () => {
  it('opens on the design defaults: 7 days and 5 minutes, auto-updated with the same settings', () => {
    render(<Harness userNotifications />);
    expect(field(DEADLINE)[0].textContent).toBe('7 days after the first try');
    expect(field(COUNTDOWN)[0].textContent).toBe('5 minutes');
    expect(screen.queryByText(/without warning/)).toBeNull();
    expect(screen.getByRole('checkbox', { name: /Keep it auto-updated/ }).getAttribute('aria-checked')).toBe('true');
    expect(screen.queryByText('For auto-updates')).toBeNull();
  });

  it('offers every deadline', () => {
    render(<Harness userNotifications />);
    expect(openOptions(DEADLINE)).toEqual(ALL_DEADLINES);
  });

  it('offers every countdown', () => {
    render(<Harness userNotifications />);
    expect(openOptions(COUNTDOWN)).toEqual(['1 minute', '5 minutes', '15 minutes', '30 minutes']);
  });

  it('Force keeps the countdown and says later releases are forced too; waiting for the app to close has none', () => {
    const onValue = vi.fn<(value: SoftwareUpdateSettingsValues) => void>();
    render(<Harness userNotifications onValue={onValue} />);
    pick(DEADLINE, 'Force update right away');
    expect(field(COUNTDOWN)).toHaveLength(1);
    expect(screen.getByText('Later releases will also be force-updated.')).toBeTruthy();
    expect(onValue.mock.lastCall?.[0].policy).toMatchObject({ mode: 'FORCE', deadlineEnabled: false });

    pick(DEADLINE, 'Update when app closes');
    expect(field(COUNTDOWN)).toHaveLength(0);
  });

  it('auto-update off hides its settings', () => {
    render(<Harness userNotifications />);
    fireEvent.click(screen.getByRole('checkbox', { name: /Keep it auto-updated/ }));
    expect(screen.queryByRole('checkbox', { name: /Same settings for auto-update/ })).toBeNull();
  });

  it('showAutoUpdate={false} leaves the update rules alone', () => {
    render(<Harness userNotifications showAutoUpdate={false} />);
    expect(field(DEADLINE)).toHaveLength(1);
    expect(screen.queryByRole('checkbox', { name: /Keep it auto-updated/ })).toBeNull();
  });

  it('promises no reinstall of apps installed by hand: the agent leaves them alone', () => {
    render(<Harness userNotifications />);
    expect(screen.queryByText(/reinstall/i)).toBeNull();
  });
});

describe('SoftwareUpdatePolicyFields', () => {
  function PolicyHarness({ onValue }: { onValue: (policy: SoftwareUpdatePolicy) => void }) {
    const [policy, setPolicy] = useState(DEFAULT_SOFTWARE_UPDATE_POLICY);
    return (
      <SoftwareUpdatePolicyFields
        name="policy"
        policy={policy}
        userNotifications
        onChange={next => {
          setPolicy(next);
          onValue(next);
        }}
      />
    );
  }

  it('is the deadline and the countdown alone, for a page that keeps the rest itself', () => {
    const onValue = vi.fn<(policy: SoftwareUpdatePolicy) => void>();
    render(<PolicyHarness onValue={onValue} />);
    expect(field(DEADLINE)).toHaveLength(1);
    expect(field(COUNTDOWN)).toHaveLength(1);
    expect(screen.queryByRole('checkbox')).toBeNull();
    pick(COUNTDOWN, '15 minutes');
    expect(onValue.mock.lastCall?.[0]).toMatchObject({ countdownSeconds: 900 });
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

  it('without user notifications it opens on Force Update and submits that', () => {
    const onSubmit = vi.fn<(values: SoftwareActionFormValues) => void>();
    render(<SoftwareActionForm {...base} onSubmit={onSubmit} />);
    fireEvent.click(submitButton('Run Update'));
    expect(onSubmit.mock.calls[0][0].updateSettings).toEqual(FORCE_SETTINGS);
  });

  it('showAutoUpdate={false} offers no auto-update and submits it off', () => {
    const onSubmit = vi.fn<(values: SoftwareActionFormValues) => void>();
    render(<SoftwareActionForm {...base} showAutoUpdate={false} onSubmit={onSubmit} />);
    expect(screen.queryByRole('checkbox', { name: /Keep it auto-updated/ })).toBeNull();
    fireEvent.click(submitButton('Run Update'));
    expect(onSubmit.mock.calls[0][0].updateSettings).toEqual({ ...FORCE_SETTINGS, autoUpdate: false });
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
