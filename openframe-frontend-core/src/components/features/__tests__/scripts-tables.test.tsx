import { render, screen } from '@testing-library/react';
import { FormProvider, useForm } from 'react-hook-form';
import { describe, expect, it } from 'vitest';
import { resolveProductDemoCast } from '../../product-demo/cast';
import { buildScriptsFixture } from '../../product-demo/fixtures/scripts';
import { PRODUCT_SCREEN_LOADERS } from '../../product-demo/registry';
import { PRODUCT_SCREEN_KEYS } from '../../product-demo/screen-keys';
import ScriptsScreen from '../../product-demo/screens/scripts';
import {
  DEFAULT_SCHEDULE_FORM_VALUES,
  SCHEDULES_TABLE_COLUMNS,
  type ScheduleFormData,
  ScheduleFormFields,
  ScheduleScriptSearchField,
  SCRIPT_SHELL_TYPES,
  ScriptSchedulesTable,
  SCRIPTS_TABLE_COLUMNS,
  ScriptsTable,
  scriptShellLabel,
} from '../scripts';

const fixture = buildScriptsFixture(resolveProductDemoCast());
// Read once under names of their own: `.scripts` on anything reads as `document.scripts` to the lint rule.
const { scripts: library, scheduleForm } = fixture;
const { scripts: searchResults } = scheduleForm;
const { scripts: loadScriptsScreen } = PRODUCT_SCREEN_LOADERS;

/** The schedule form as a host mounts it: its own form, the fields off the context. */
function ScheduleForm({ values }: { values: ScheduleFormData }) {
  const form = useForm<ScheduleFormData>({ defaultValues: values });
  return (
    <FormProvider {...form}>
      <ScheduleFormFields
        showErrors={false}
        getTimeSlots={() => scheduleForm.timeSlots}
        renderScriptSearch={field => (
          <ScheduleScriptSearchField
            scriptId={field.scriptId}
            name={field.name}
            scripts={searchResults}
            onChange={() => {}}
          />
        )}
      />
    </FormProvider>
  );
}

describe('scripts tables', () => {
  it('lists every script with its shell and who added it', () => {
    render(<ScriptsTable rows={library} />);
    for (const script of library) {
      expect(screen.getAllByText(script.name).length).toBeGreaterThan(0);
      expect(screen.getAllByText(script.author?.name ?? '').length).toBeGreaterThan(0);
    }
    expect(screen.getAllByText('CMD').length).toBeGreaterThan(0);
  });

  it('leaves out the columns a host hides', () => {
    render(<ScriptsTable rows={library} hideColumns={['authorId']} />);
    expect(screen.queryByText('Added by')).toBeNull();
  });

  it('shows a schedule by its start, or by what triggers it when it has no date', () => {
    render(<ScriptSchedulesTable rows={fixture.schedules} />);
    expect(screen.getAllByText('Every week').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Device Online').length).toBeGreaterThan(0);
  });

  it('runs every schedule from a script of the library', () => {
    const names = new Set(library.map(script => script.name));
    for (const schedule of fixture.schedules) expect(names.has(schedule.name)).toBe(true);
  });

  it('labels the shells the pages offer', () => {
    expect(SCRIPT_SHELL_TYPES.map(shell => shell.value)).toEqual(['powershell', 'cmd', 'bash']);
    expect(scriptShellLabel('cmd')).toBe('CMD');
    expect(scriptShellLabel('zsh')).toBe('zsh');
  });

  it('keeps column ids unique in each table', () => {
    for (const columns of [SCRIPTS_TABLE_COLUMNS, SCHEDULES_TABLE_COLUMNS]) {
      expect(new Set(columns.map(column => column.id)).size).toBe(columns.length);
    }
  });

  it('is a screen of the product demo', () => {
    expect(PRODUCT_SCREEN_KEYS).toContain('scripts');
    expect(loadScriptsScreen).toBeTypeOf('function');
  });

  it('draws the schedule form with the fixture: its name, the picked script and the repeat', () => {
    render(<ScheduleForm values={scheduleForm.values} />);
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

  it('shows the schedule form over the library on the wide screen, the schedules alone on the narrow one', () => {
    const view = render(<ScriptsScreen />);
    expect(screen.getByDisplayValue('Nightly temp cleanup')).toBeTruthy();
    expect(screen.getByDisplayValue('Clear temp files')).toBeTruthy();
    expect(screen.getByRole('checkbox', { name: 'Repeat Script Run' }).getAttribute('aria-checked')).toBe('true');
    // The library is under it.
    expect(screen.getAllByText('Restart print spooler').length).toBeGreaterThan(0);
    // The picture's arrangement leaves these sections out.
    expect(screen.queryByText('Note')).toBeNull();
    expect(screen.queryByText('Run on schedule')).toBeNull();
    expect(screen.queryByText('Supported Platform')).toBeNull();
    expect(screen.queryByText('If device is offline at scheduled time')).toBeNull();
    expect(screen.queryByText('Add Script')).toBeNull();
    view.unmount();

    render(<ScriptsScreen compact />);
    expect(screen.queryByDisplayValue('Nightly temp cleanup')).toBeNull();
    expect(screen.getAllByText('Every week').length).toBeGreaterThan(0);
  });
});
