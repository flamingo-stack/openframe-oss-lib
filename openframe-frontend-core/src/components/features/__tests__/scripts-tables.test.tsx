import { render, screen, within } from '@testing-library/react';
import { FormProvider, useForm } from 'react-hook-form';
import { describe, expect, it } from 'vitest';
import { resolveProductDemoCast } from '../../product-demo/cast';
import { buildScriptsFixture } from '../../product-demo/fixtures/scripts';
import { PRODUCT_SCREEN_LOADERS } from '../../product-demo/registry';
import { PRODUCT_SCREEN_KEYS } from '../../product-demo/screen-keys';
import ScriptsScreen from '../../product-demo/screens/scripts';
import {
  DEFAULT_SCHEDULE_FORM_VALUES,
  EMPTY_SCHEDULE_SCRIPT_ROW,
  EXECUTIONS_TABLE_COLUMNS,
  type ScheduleFormData,
  ScheduleFormFields,
  ScheduleScriptSearchField,
  type ScheduleScriptSearchResult,
  SCHEDULES_TABLE_COLUMNS,
  type ScriptScheduleTableRow,
  SCRIPT_SHELL_TYPES,
  scriptExecutionStatus,
  ScriptExecutionsTable,
  ScriptSchedulesTable,
  SCRIPTS_TABLE_COLUMNS,
  ScriptsTable,
  type ScriptTableRow,
  scriptShellLabel,
} from '../scripts';

const fixture = buildScriptsFixture(resolveProductDemoCast());
const { scripts: loadScriptsScreen } = PRODUCT_SCREEN_LOADERS;

const LIBRARY: ScriptTableRow[] = [
  {
    id: 'clear-temp',
    name: 'Clear temp files',
    shellType: 'powershell',
    supportedPlatforms: ['windows'],
    author: { name: 'Dana Reyes', initials: 'DR' },
  },
  {
    id: 'restart-spooler',
    name: 'Restart print spooler',
    shellType: 'cmd',
    supportedPlatforms: ['windows'],
    author: { name: 'Alex Reed', initials: 'AR' },
  },
];

const SCHEDULES: ScriptScheduleTableRow[] = [
  {
    id: 'disk-report',
    name: 'Disk health report',
    supportedPlatforms: ['darwin', 'linux'],
    startsAt: { date: '10/11/2026', time: '6:00 AM' },
    repeat: 'Every week',
    deviceCount: 48,
  },
  {
    id: 'map-printers',
    name: 'Map office printers',
    supportedPlatforms: ['windows'],
    trigger: 'Device Online',
    deviceCount: 36,
  },
];

const SEARCH_RESULTS: ScheduleScriptSearchResult[] = [
  { id: 'clear-temp', name: 'Clear temp files', supportedPlatforms: ['windows'] },
];

/** The schedule form as a host mounts it: its own form, the fields off the context. */
function ScheduleForm({ values }: { values: ScheduleFormData }) {
  const form = useForm<ScheduleFormData>({ defaultValues: values });
  return (
    <FormProvider {...form}>
      <ScheduleFormFields
        showErrors={false}
        getTimeSlots={() => [{ value: '23:00', label: '11:00 PM' }]}
        renderScriptSearch={field => (
          <ScheduleScriptSearchField
            scriptId={field.scriptId}
            name={field.name}
            scripts={SEARCH_RESULTS}
            onChange={() => {}}
          />
        )}
      />
    </FormProvider>
  );
}

describe('scripts tables', () => {
  it('lists every script with its shell and who added it', () => {
    render(<ScriptsTable rows={LIBRARY} />);
    for (const script of LIBRARY) {
      expect(screen.getAllByText(script.name).length).toBeGreaterThan(0);
      expect(screen.getAllByText(script.author?.name ?? '').length).toBeGreaterThan(0);
    }
    expect(screen.getAllByText('CMD').length).toBeGreaterThan(0);
  });

  it('leaves out the columns a host hides', () => {
    render(<ScriptsTable rows={LIBRARY} hideColumns={['authorId']} />);
    expect(screen.queryByText('Added by')).toBeNull();
  });

  it('shows a schedule by its start, or by what triggers it when it has no date', () => {
    render(<ScriptSchedulesTable rows={SCHEDULES} />);
    expect(screen.getAllByText('Every week').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Device Online').length).toBeGreaterThan(0);
  });

  it('labels the shells the pages offer', () => {
    expect(SCRIPT_SHELL_TYPES.map(shell => shell.value)).toEqual(['powershell', 'cmd', 'bash']);
    expect(scriptShellLabel('cmd')).toBe('CMD');
    expect(scriptShellLabel('zsh')).toBe('zsh');
  });

  it('keeps column ids unique in each table', () => {
    for (const columns of [SCRIPTS_TABLE_COLUMNS, SCHEDULES_TABLE_COLUMNS, EXECUTIONS_TABLE_COLUMNS]) {
      expect(new Set(columns.map(column => column.id)).size).toBe(columns.length);
    }
  });

  it('presents every execution status, and nothing it does not know', () => {
    expect(scriptExecutionStatus('SUCCESS')).toEqual({ label: 'Completed', variant: 'success', inFlight: false });
    expect(scriptExecutionStatus('QUEUED')?.inFlight).toBe(true);
    expect(scriptExecutionStatus('toString')).toBeUndefined();
    expect(scriptExecutionStatus(null)).toBeUndefined();
  });

  it('shows an execution by its device, customer, status and what dispatched it', () => {
    render(<ScriptExecutionsTable rows={fixture.executions} />);
    expect(screen.getAllByText('SAM-T14').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Northbridge Legal').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Failed')).toHaveLength(1);
    expect(screen.getAllByText('Scheduled').length).toBeGreaterThan(0);
    // The conversation's test run was Mingo's.
    expect(screen.getAllByText('Mingo')).toHaveLength(1);
  });

  it('is a screen of the product demo', () => {
    expect(PRODUCT_SCREEN_KEYS).toContain('scripts');
    expect(loadScriptsScreen).toBeTypeOf('function');
  });

  it('draws the schedule form with its values: its name, the picked script and the repeat', () => {
    render(
      <ScheduleForm
        values={{
          ...DEFAULT_SCHEDULE_FORM_VALUES,
          name: 'Nightly temp cleanup',
          repeatEnabled: true,
          repeatInterval: 1,
          repeatUnit: 'day',
          scripts: [{ ...EMPTY_SCHEDULE_SCRIPT_ROW, scriptId: 'clear-temp', name: 'Clear temp files' }],
        }}
      />,
    );
    expect(screen.getByDisplayValue('Nightly temp cleanup')).toBeTruthy();
    expect(screen.getByDisplayValue('Clear temp files')).toBeTruthy();
    expect(screen.getByRole('checkbox', { name: 'Repeat Script Run' }).getAttribute('aria-checked')).toBe('true');
    // "Repeat in": every 1 day.
    expect(screen.getByText('Repeat in')).toBeTruthy();
    expect(screen.getByDisplayValue('1')).toBeTruthy();
    expect(screen.getAllByText('Day').length).toBeGreaterThan(0);
    // Every section of the product's page is there by default.
    expect(screen.getByText('Note')).toBeTruthy();
    expect(screen.getByText('Run on schedule')).toBeTruthy();
    expect(screen.getByText('Supported Platform')).toBeTruthy();
    expect(screen.getByText('If device is offline at scheduled time')).toBeTruthy();
    expect(screen.getByText('Scheduled Scripts')).toBeTruthy();
    expect(screen.getByText('Add Script')).toBeTruthy();
  });

  it('opens an empty schedule form locked to no script', () => {
    render(<ScheduleForm values={DEFAULT_SCHEDULE_FORM_VALUES} />);
    expect(screen.getByPlaceholderText('Enter schedule name')).toBeTruthy();
    expect(screen.getByPlaceholderText('Select a script...')).toBeTruthy();
    // Linux is offered unless the host narrows the platforms.
    expect(screen.getByText('Linux')).toBeTruthy();
  });

  it('shows the script beside its first night of runs on the wide screen, the runs alone on the narrow one', () => {
    const view = render(<ScriptsScreen />);
    const script = screen.getByRole('region', { name: 'Clear temp files' });
    expect(within(script).getByText('PowerShell')).toBeTruthy();
    expect(within(script).getByText('Every day 11:00 PM · 213 devices')).toBeTruthy();
    expect(within(script).getByText('Written by Mingo · approved by Alex Reed')).toBeTruthy();
    expect(script.textContent).toContain('Remove-Item -Recurse -Force');
    // The run: one failed, one still going, the rest finished.
    expect(screen.getAllByText('Failed')).toHaveLength(1);
    expect(screen.getAllByText('Running')).toHaveLength(1);
    expect(screen.getAllByText('Completed').length).toBeGreaterThan(1);
    expect(screen.getAllByText('RECEPTION-01').length).toBeGreaterThan(0);
    // One run's output is open, ending in what it freed and how it exited.
    expect(screen.getByText(/Freed 2\.7 GB\s+Exit code: 0$/)).toBeTruthy();
    // The schedule form and the library are not in the picture.
    expect(screen.queryByDisplayValue('Nightly temp cleanup')).toBeNull();
    expect(screen.queryByText('Restart print spooler')).toBeNull();
    view.unmount();

    render(<ScriptsScreen compact />);
    expect(screen.queryByRole('region', { name: 'Clear temp files' })).toBeNull();
    expect(screen.queryByText(/Freed/)).toBeNull();
    expect(screen.getAllByText('SAM-T14').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Failed')).toHaveLength(1);
    expect(screen.getAllByText('Running')).toHaveLength(1);
    // Four runs: the oldest stay out of the card.
    expect(screen.queryByText('RECEPTION-01')).toBeNull();
  });
});
