'use client';

import { type ReactNode, useState } from 'react';
import { PlusCircleIcon } from '../../icons-v2-generated';
import { Button, type PageActionButton, PageLayout, RadioGroupBlock } from '../../ui';
import { PACKAGE_MANAGER_OS } from './package-managers';
import { SoftwareScheduleFields, type SoftwareScheduleTiming } from './schedule-fields';
import { SOFTWARE_ACTION_COPY, type SoftwareActionKind } from './software-action-copy';
import { newSoftwareRow, type SoftwareRow } from './software-row';
import { type PackageSearchSlotProps, SoftwareRowFields } from './software-row-fields';

/** Run the packages now, or at a scheduled start. */
export type SoftwareRunMode = 'now' | 'schedule';

/** Everything the form holds: the packages and when they run. The devices are the host's. */
export interface SoftwareActionFormValues<TRef extends string = string> {
  rows: SoftwareRow[];
  mode: SoftwareRunMode;
  date: Date | null;
  time: string;
  timeReference: TRef;
}

/** What the device picker slot is told: which devices the chosen packages can run on. */
export interface SoftwareDeviceScope {
  /** The OS of every chosen catalog, sorted, e.g. `['MAC_OS', 'WINDOWS']`. */
  osTypes: string[];
  /**
   * The same list as one string. It changes exactly when the candidate devices
   * do, so it is the key to remount a picker by.
   */
  osTypesKey: string;
}

export interface SoftwareActionFormProps<TRef extends string = string> {
  action: SoftwareActionKind;
  onBack: () => void;
  /** The header's primary button: run now or schedule, by the chosen mode. */
  onSubmit: (values: SoftwareActionFormValues<TRef>) => void;
  submitDisabled?: boolean;
  submitting?: boolean;
  /** How a schedule's start is read. */
  timing: SoftwareScheduleTiming<TRef>;
  /** What the form opens with. `timeReference` is required: the form cannot guess the host's default. */
  initialValues: Partial<SoftwareActionFormValues<TRef>> & { timeReference: TRef };
  /** The "Software Name" field of each row. */
  renderPackageSearch: (field: PackageSearchSlotProps) => ReactNode;
  /** "Device Selection": the host's picker for the given scope. */
  renderDevicePicker: (scope: SoftwareDeviceScope) => ReactNode;
  className?: string;
}

const INITIAL_ROWS = (): SoftwareRow[] => [newSoftwareRow('row-0')];

/**
 * Install Software (design 591:8524) and Update Software (409:48080 / 409:48175):
 * which catalog packages, now or on a schedule, on which devices. One form for
 * both flows.
 *
 * The packages and the timing are form state; the devices are not. Searching a
 * catalog and picking devices are the host's queries, so both are slots: the
 * product passes its data-bound field and picker, a fixture passes static ones.
 */
export function SoftwareActionForm<TRef extends string = string>({
  action,
  onBack,
  onSubmit,
  submitDisabled = false,
  submitting = false,
  timing,
  initialValues,
  renderPackageSearch,
  renderDevicePicker,
  className = 'px-[var(--spacing-system-l)] pb-[var(--spacing-system-l)]',
}: SoftwareActionFormProps<TRef>) {
  const copy = SOFTWARE_ACTION_COPY[action];

  const [rows, setRows] = useState<SoftwareRow[]>(() => initialValues.rows ?? INITIAL_ROWS());
  const [mode, setMode] = useState<SoftwareRunMode>(initialValues.mode ?? 'now');
  const [date, setDate] = useState<Date | null>(initialValues.date ?? null);
  const [time, setTime] = useState(initialValues.time ?? '');
  const [timeReference, setTimeReference] = useState<TRef>(initialValues.timeReference);

  // The picker's frame: devices on the OS the chosen packages install on.
  const osTypesKey = [...new Set(rows.map(row => PACKAGE_MANAGER_OS[row.packageManager]))].sort().join(',');

  const actions: PageActionButton[] = [
    { label: 'Cancel', onClick: onBack, variant: 'outline', showOnlyMobile: true },
    {
      label: mode === 'now' ? copy.runLabel : copy.scheduleLabel,
      variant: 'accent',
      onClick: () => onSubmit({ rows, mode, date, time, timeReference }),
      disabled: submitDisabled,
      loading: submitting,
    },
  ];

  const updateRow = (next: SoftwareRow) => setRows(current => current.map(row => (row.key === next.key ? next : row)));
  const removeRow = (key: string) => setRows(current => current.filter(row => row.key !== key));
  const addRow = () => setRows(current => [...current, newSoftwareRow(crypto.randomUUID())]);

  return (
    <PageLayout
      title={copy.formTitle}
      backButton={{ label: 'Back', onClick: onBack }}
      actions={actions}
      actionsVariant="primary-buttons"
      className={className}
    >
      {rows.map(row => (
        <SoftwareRowFields
          key={row.key}
          row={row}
          removable={rows.length > 1}
          onChange={updateRow}
          onRemove={() => removeRow(row.key)}
          renderPackageSearch={renderPackageSearch}
        />
      ))}

      <Button
        type="button"
        variant="outline"
        size="small"
        className="self-start"
        onClick={addRow}
        leftIcon={<PlusCircleIcon size={24} className="text-ods-text-secondary" />}
      >
        Add Software
      </Button>

      <RadioGroupBlock
        name="runMode"
        variant="grouped"
        value={mode}
        onValueChange={value => setMode(value as SoftwareRunMode)}
        options={copy.modes}
        itemClassName="py-[var(--spacing-system-sf)]"
      />

      {mode === 'schedule' && (
        <SoftwareScheduleFields
          date={date}
          time={time}
          timeReference={timeReference}
          timing={timing}
          onDateChange={setDate}
          onTimeChange={setTime}
          onTimeReferenceChange={setTimeReference}
        />
      )}

      <h2 className="pt-[var(--spacing-system-l)] text-ods-text-primary text-h2">Device Selection</h2>

      {renderDevicePicker({ osTypes: osTypesKey.split(','), osTypesKey })}
    </PageLayout>
  );
}
