import { fireEvent, render, screen } from '@testing-library/react';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { GRID_ACTION_COLUMN_SIZE, GRID_MIN_WIDTH } from '../../ui/data-table';
import { LoadingWhen } from '../../ui/loading-scope';
import {
  IdleIntersectionObserver,
  SCRIPT_EXECUTIONS_TABLE,
  SCRIPT_SCHEDULES_TABLE,
  SCRIPTS_TABLE,
} from '../feature-tables.fixtures';
import { ExecutionDeviceGridCell, ExecutionInitiatorGridCell, ExecutionTimestampGridCell } from './execution-cells';
import { ScheduleDateTimeGridCell, ScriptNameGridCell } from './script-cells';
import { ScriptExecutionsTable } from './script-executions-table';
import { ScriptSchedulesTable } from './script-schedules-table';
import { ScriptShellGridCell } from './script-shell-badge';
import { ScriptsTable } from './scripts-table';
import {
  EXECUTION_COLUMNS,
  EXECUTIONS_TABLE_COLUMNS,
  SCHEDULE_COLUMNS,
  SCHEDULES_TABLE_COLUMNS,
  SCRIPT_COLUMNS,
  SCRIPTS_TABLE_COLUMNS,
  type ScriptsTableColumnLayout,
} from './scripts-table-columns';

/**
 * The three Scripts tables in the grid layout: every cell is one 48px line and the row actions are columns of their
 * own. The card form of each cell (a name over its description, a date over its time) stays for the cards layout and
 * is locked by `feature-tables-cards-markup`; these lock the grid form.
 */

/** The markup of the grid form of the body (from its opening tag on). */
function gridBodyMarkup(container: HTMLElement): string {
  return container.innerHTML.slice(container.innerHTML.indexOf('data-grid-body'));
}

/** The grid body's rows, as markup: one string per row. */
function gridRows(container: HTMLElement): string[] {
  return gridBodyMarkup(container).split('group/gridrow').slice(1);
}

/**
 * A cell of a subject and its detail (`GridTextWithDetailCell`), as markup: the subject's text takes its own width and
 * the detail right after it takes what the column leaves (`flex-1`), so the detail is the part a narrow column cuts.
 */
function subjectThenDetail(subject: string, detail: string): RegExp {
  return new RegExp(
    `<span class="(?![^"]*flex-1)[^"]*"><span[^>]*>${subject}</span></span>` +
      `<span class="[^"]*flex-1[^"]*"><span[^>]*>${detail}</span>`,
  );
}

/** The same cell with no detail: the subject closes its line. */
function subjectAlone(subject: string): RegExp {
  return new RegExp(`<span[^>]*>${subject}</span></span></div>`);
}

/** The grid header's data columns, in drawn order. An action column has no header cell of this kind. */
function headerColumns(container: HTMLElement): string[] {
  return [...container.innerHTML.matchAll(/<[a-z]+[^>]*data-grid-header-cell[^>]*>/g)].map(
    match => /data-grid-col="(\w+)"/.exec(match[0])?.[1] ?? '',
  );
}

/** The names the settings menu lists, top to bottom. */
function menuColumns(): string[] {
  fireEvent.pointerDown(screen.getByRole('button', { name: 'Table settings' }), { button: 0, pointerType: 'mouse' });
  return screen.getAllByRole('menuitemcheckbox').map(row => row.textContent ?? '');
}

const renderActions = () => <button type="button">Row menu</button>;

const LAYOUTS: { name: string; columns: readonly ScriptsTableColumnLayout[] }[] = [
  { name: 'scripts', columns: SCRIPTS_TABLE_COLUMNS },
  { name: 'schedules', columns: SCHEDULES_TABLE_COLUMNS },
  { name: 'executions', columns: EXECUTIONS_TABLE_COLUMNS },
];

describe('the Scripts tables, grid layout', () => {
  beforeAll(() => vi.stubGlobal('IntersectionObserver', IdleIntersectionObserver));
  afterAll(() => vi.unstubAllGlobals());
  beforeEach(() => localStorage.clear());
  afterEach(() => localStorage.clear());

  describe.each(LAYOUTS)('the $name column layout', ({ columns }) => {
    const data = columns.filter(column => column.gridKind !== 'action');
    const actions = columns.filter(column => column.gridKind === 'action');

    it('gives every data column a width, a name for the settings menu and a minimum no wider than the width', () => {
      for (const column of data) {
        expect(column.size, column.id).toBeGreaterThanOrEqual(column.minSize ?? GRID_MIN_WIDTH.text);
        expect(column.label, column.id).toBeTruthy();
      }
    });

    it('states a minimum only as one of the table’s own (an icon and text, an avatar and text)', () => {
      const stated = data.flatMap(column => (column.minSize === undefined ? [] : [column.minSize]));
      for (const minSize of stated) expect([GRID_MIN_WIDTH.icon, GRID_MIN_WIDTH.media]).toContain(minSize);
    });

    it('ends in the two row-action columns, each as wide as one action', () => {
      expect(actions.map(column => column.id)).toEqual(['actions', 'open']);
      expect(columns.slice(-2)).toEqual(actions);
      for (const column of actions) expect(column.size).toBe(GRID_ACTION_COLUMN_SIZE);
    });
  });

  describe('a row still being read', () => {
    /** A text line's loading form (`TextLineSkeleton`): one line-high bar. */
    const BAR = 'h-[1lh]';
    /** A field of a host's placeholder row (an id and nothing else): typed as its string, absent at run time. */
    const absent = undefined as unknown as string;

    it.each([
      ['the script name', <ScriptNameGridCell key="name" name={absent} />],
      ['the shell', <ScriptShellGridCell key="shell" value={absent} />],
      ['the schedule date', <ScheduleDateTimeGridCell key="date" date={absent} time={absent} />],
      ['the execution time', <ExecutionTimestampGridCell key="time" timestamp={absent} executionId={absent} />],
      ['the device', <ExecutionDeviceGridCell key="device" name={absent} />],
      ['who it ran for', <ExecutionInitiatorGridCell key="initiator" name={absent} />],
    ])('draws %s as a bar while its field is not here yet', (_name, cell) => {
      const { container: loading } = render(<LoadingWhen loading>{cell}</LoadingWhen>);
      expect(loading.innerHTML).toContain(BAR);
      // Outside a loading scope an empty field is an empty cell, not a bar that never resolves.
      const { container: loaded } = render(cell);
      expect(loaded.innerHTML).not.toContain(BAR);
    });

    it('holds the shell icon’s place while the shell is read, as the card cell does', () => {
      const cell = <ScriptShellGridCell value={absent} />;
      const { container: loading } = render(<LoadingWhen loading>{cell}</LoadingWhen>);
      expect(loading.innerHTML).toContain('data-part="leading"');
      // A shell the table does not know (no icon) has no icon box once loaded.
      const { container: loaded } = render(<ScriptShellGridCell value="fish" />);
      expect(loaded.innerHTML).not.toContain('data-part="leading"');
    });
  });

  describe('the chip of what dispatched a run', () => {
    it.each([
      ['SCHEDULED', 'Scheduled'],
      ['AI_ASSISTANT', 'Mingo'],
    ])('is the cell’s tag for a %s run', (source, label) => {
      const { container } = render(<ExecutionInitiatorGridCell name="Maya Chen" source={source} />);
      expect(container.innerHTML).toMatch(new RegExp(`data-part="tag"[\\s\\S]*${label}`));
    });

    it.each(['MANUAL', null, undefined])('is left out for a %s run: the cell has no tag', source => {
      const { container } = render(<ExecutionInitiatorGridCell name="Maya Chen" source={source} />);
      expect(container.innerHTML).not.toContain('data-part="tag"');
    });
  });

  describe('ScriptsTable', () => {
    it('puts the description beside the name, not under it', () => {
      const { container } = render(<ScriptsTable {...SCRIPTS_TABLE.loaded} layout="grid" />);
      // The name keeps its width; the description after it is the part a narrow column cuts.
      const [first, second] = gridRows(container);
      expect(first).toMatch(subjectThenDetail('Restart print spooler', 'Stops and starts the spooler service'));
      // A script with no description is its name alone.
      expect(second).toMatch(subjectAlone('Clear temp files'));
      // No cell of the grid stacks two lines.
      expect(gridBodyMarkup(container)).not.toContain('flex-col');
    });

    it('draws the author with an avatar on the name’s line, and nothing where nobody is recorded', () => {
      const { container } = render(<ScriptsTable {...SCRIPTS_TABLE.loaded} layout="grid" />);
      const [first, second] = gridRows(container);
      expect(first).toMatch(/data-part="leading"[\s\S]*Maya Chen/);
      expect(second).not.toContain('Maya Chen');
    });

    it('keeps the row actions out of the data columns: a column each, after them', () => {
      const { container } = render(
        <ScriptsTable {...SCRIPTS_TABLE.loaded} renderActions={renderActions} layout="grid" tableSettings={{}} />,
      );
      expect(headerColumns(container)).toEqual([
        SCRIPT_COLUMNS.name.id,
        SCRIPT_COLUMNS.shellType.id,
        SCRIPT_COLUMNS.supportedPlatforms.id,
        SCRIPT_COLUMNS.authorId.id,
      ]);
      const [first] = gridRows(container);
      // The menu, then the open button, both after the last data cell and outside the row's link.
      expect(first).toMatch(
        /Maya Chen[\s\S]*data-no-row-click[\s\S]*Row menu[\s\S]*data-no-row-click[\s\S]*Open in new tab/,
      );
      // The settings menu lists the data columns by name, and no action.
      expect(menuColumns()).toEqual(['Name', 'Shell type', 'OS', 'Added by']);
    });

    it('has no actions column without a row menu, and keeps the open column', () => {
      const { container } = render(<ScriptsTable {...SCRIPTS_TABLE.loaded} layout="grid" />);
      const [first] = gridRows(container);
      expect(first).not.toContain('Row menu');
      expect(first).toMatch(/data-no-row-click[\s\S]*Open in new tab/);
    });

    it('names no column while loading: the header is bars, and names its columns once loaded', () => {
      const { container, rerender } = render(<ScriptsTable {...SCRIPTS_TABLE.loading} layout="grid" />);
      expect(container.innerHTML).toContain('data-grid-header-loading');
      expect(headerColumns(container).filter(Boolean)).toEqual([]);

      rerender(<ScriptsTable {...SCRIPTS_TABLE.loaded} layout="grid" />);
      expect(container.innerHTML).not.toContain('data-grid-header-loading');
      expect(headerColumns(container)).toContain(SCRIPT_COLUMNS.name.id);
    });
  });

  describe('ScriptSchedulesTable', () => {
    it('puts the time beside the date, and what starts a schedule with no date in its place', () => {
      const { container } = render(<ScriptSchedulesTable {...SCRIPT_SCHEDULES_TABLE.loaded} layout="grid" />);
      const [first, second] = gridRows(container);
      expect(first).toMatch(/12 Nov 2026[\s\S]*data-part="secondary"[^>]*>02:00</);
      expect(second).toContain('Device Online');
      expect(gridBodyMarkup(container)).not.toContain('flex-col');
    });

    it('draws the repeat and the device count as one line each, and no repeat where there is none', () => {
      const { container } = render(<ScriptSchedulesTable {...SCRIPT_SCHEDULES_TABLE.loaded} layout="grid" />);
      const [first, second] = gridRows(container);
      expect(first).toMatch(/Every day[\s\S]*14/);
      expect(second).not.toContain('Every day');
    });

    it('lists its data columns by name in the settings menu, the actions in none', () => {
      const { container } = render(
        <ScriptSchedulesTable
          {...SCRIPT_SCHEDULES_TABLE.loaded}
          renderActions={renderActions}
          layout="grid"
          tableSettings={{}}
        />,
      );
      expect(headerColumns(container)).toEqual([
        SCHEDULE_COLUMNS.name.id,
        SCHEDULE_COLUMNS.supportedPlatforms.id,
        SCHEDULE_COLUMNS.dateTime.id,
        SCHEDULE_COLUMNS.repeat.id,
        SCHEDULE_COLUMNS.deviceCount.id,
      ]);
      expect(menuColumns()).toEqual(['Script', 'OS', 'Date and time', 'Repeat', 'Devices']);
    });
  });

  describe('ScriptExecutionsTable', () => {
    it('puts the id beside the time and the customer beside the device', () => {
      const { container } = render(<ScriptExecutionsTable {...SCRIPT_EXECUTIONS_TABLE.loaded} layout="grid" />);
      // The time and the device keep their width; the id and the customer are the parts a narrow column cuts.
      const [first, second] = gridRows(container);
      expect(first).toMatch(subjectThenDetail('11 Nov 2026, 10:15', 'EX-1001'));
      expect(first).toMatch(subjectThenDetail('reception-01', 'Acme Logistics'));
      // The device's icon stays before its name.
      expect(first).toMatch(/data-part="leading"[\s\S]*reception-01/);
      // A device with no customer is its name alone.
      expect(second).toMatch(subjectAlone('maya-mba'));
    });

    it('draws the status as the cell’s tag', () => {
      const { container } = render(<ScriptExecutionsTable {...SCRIPT_EXECUTIONS_TABLE.loaded} layout="grid" />);
      const [first, second] = gridRows(container);
      expect(first).toMatch(/data-part="tag"[\s\S]*Success/i);
      expect(second).toMatch(/data-part="tag"[\s\S]*Failed/i);
    });

    it('draws who it ran for on one line: the chip only for a run a person did not start', () => {
      const { container } = render(<ScriptExecutionsTable {...SCRIPT_EXECUTIONS_TABLE.loaded} layout="grid" />);
      const [manual, byMingo] = gridRows(container);
      // A manual run: the name and the script it ran, no chip (the status is the row's only tag).
      expect(manual).toMatch(/Maya Chen[\s\S]*data-part="secondary"[^>]*>[\s\S]*Restart print spooler/);
      expect(manual.split('data-part="tag"')).toHaveLength(1 + 1);
      expect(byMingo).toMatch(/Fae[\s\S]*data-part="tag"[\s\S]*Mingo/);
    });

    it('draws the output on one line, and keeps the sub-row under the cells', () => {
      const { container } = render(<ScriptExecutionsTable {...SCRIPT_EXECUTIONS_TABLE.loaded} layout="grid" />);
      const [first] = gridRows(container);
      expect(first).toContain('Service restarted');
      expect(gridBodyMarkup(container)).not.toContain('line-clamp-2');
      expect(gridBodyMarkup(container)).toMatch(/data-sub-row[^>]*>Service restarted</);
    });

    it('lists its data columns by name in the settings menu; the open button is a column after them', () => {
      const { container } = render(
        <ScriptExecutionsTable {...SCRIPT_EXECUTIONS_TABLE.loaded} layout="grid" tableSettings={{}} />,
      );
      expect(headerColumns(container)).toEqual([
        EXECUTION_COLUMNS.executionId.id,
        EXECUTION_COLUMNS.status.id,
        EXECUTION_COLUMNS.machineId.id,
        EXECUTION_COLUMNS.initiatorId.id,
        EXECUTION_COLUMNS.result.id,
      ]);
      expect(gridRows(container)[0]).toMatch(/Service restarted[\s\S]*data-no-row-click[\s\S]*Open in new tab/);
      expect(menuColumns()).toEqual(['Execution', 'Status', 'Device', 'Executed by', 'Result']);
    });
  });
});
