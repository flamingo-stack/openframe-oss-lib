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
  /** "Back" over the title and the phone's "Cancel"; left out, the form shows neither (a picture of the form). */
  onBack?: () => void;
  /**
   * Render the page header (the title, "Back" and the primary button). Default
   * true; a host that shows the form under a heading of its own passes false.
   */
  showHeader?: boolean;
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
  /** Offer "Add Software" (several packages in one run). Default true; false is a one-package form. */
  addRows?: boolean;
  /**
   * `stacked` (default): the run choice, then the schedule's fields under it.
   * `inline`: on a wide form the two choices sit side by side with the
   * schedule's fields on the same row, so the devices start higher.
   */
  runModeLayout?: 'stacked' | 'inline';
  /** The "Device Selection" heading over the picker. Default true; a host that titles the picker itself passes false. */
  showDeviceHeading?: boolean;
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
  showHeader = true,
  onSubmit,
  submitDisabled = false,
  submitting = false,
  timing,
  initialValues,
  renderPackageSearch,
  renderDevicePicker,
  addRows = true,
  runModeLayout = 'stacked',
  showDeviceHeading = true,
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
    ...(onBack ? [{ label: 'Cancel', onClick: onBack, variant: 'outline' as const, showOnlyMobile: true }] : []),
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

  const inline = runModeLayout === 'inline';
  const runModeField = (
    <RadioGroupBlock
      name="runMode"
      variant="grouped"
      orientation={inline ? 'horizontal' : 'vertical'}
      value={mode}
      onValueChange={value => setMode(value as SoftwareRunMode)}
      options={copy.modes}
      itemClassName="py-[var(--spacing-system-sf)]"
    />
  );
  const scheduleFields = mode === 'schedule' && (
    <SoftwareScheduleFields
      date={date}
      time={time}
      timeReference={timeReference}
      timing={timing}
      onDateChange={setDate}
      onTimeChange={setTime}
      onTimeReferenceChange={setTimeReference}
      columns={inline ? 'fill' : 'page'}
    />
  );

  return (
    <PageLayout
      title={copy.formTitle}
      backButton={onBack ? { label: 'Back', onClick: onBack } : undefined}
      actions={actions}
      actionsVariant="primary-buttons"
      showHeader={showHeader}
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

      {addRows && (
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
      )}

      {inline ? (
        <div className="flex flex-col gap-[var(--spacing-system-l)] content-lg:flex-row content-lg:items-end">
          <div className="min-w-0 content-lg:flex-1">{runModeField}</div>
          {scheduleFields && <div className="min-w-0 content-lg:flex-1">{scheduleFields}</div>}
        </div>
      ) : (
        <>
          {runModeField}
          {scheduleFields}
        </>
      )}

      {showDeviceHeading && (
        <h2 className="pt-[var(--spacing-system-l)] text-ods-text-primary text-h2">Device Selection</h2>
      )}

      {renderDevicePicker({ osTypes: osTypesKey.split(','), osTypesKey })}
    </PageLayout>
  );
}
