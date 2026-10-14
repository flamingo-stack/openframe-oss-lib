import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { resolveProductDemoCast } from '../../product-demo/cast';
import { buildScriptsFixture } from '../../product-demo/fixtures/scripts';
import { PRODUCT_SCREEN_LOADERS } from '../../product-demo/registry';
import { PRODUCT_SCREEN_KEYS } from '../../product-demo/screen-keys';
import {
  SCHEDULES_TABLE_COLUMNS,
  SCRIPT_SHELL_TYPES,
  ScriptSchedulesTable,
  SCRIPTS_TABLE_COLUMNS,
  ScriptsTable,
  scriptShellLabel,
} from '../scripts';

const fixture = buildScriptsFixture(resolveProductDemoCast());

describe('scripts tables', () => {
  it('lists every script with its shell and who added it', () => {
    render(<ScriptsTable rows={fixture.scripts} />);
    for (const script of fixture.scripts) {
      expect(screen.getAllByText(script.name).length).toBeGreaterThan(0);
      expect(screen.getAllByText(script.author?.name ?? '').length).toBeGreaterThan(0);
    }
    expect(screen.getAllByText('CMD').length).toBeGreaterThan(0);
  });

  it('leaves out the columns a host hides', () => {
    render(<ScriptsTable rows={fixture.scripts} hideColumns={['authorId']} />);
    expect(screen.queryByText('Added by')).toBeNull();
  });

  it('shows a schedule by its start, or by what triggers it when it has no date', () => {
    render(<ScriptSchedulesTable rows={fixture.schedules} />);
    expect(screen.getAllByText('Every week').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Device Online').length).toBeGreaterThan(0);
  });

  it('runs every schedule from a script of the library', () => {
    const names = new Set(fixture.scripts.map(script => script.name));
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
    expect(PRODUCT_SCREEN_LOADERS.scripts).toBeTypeOf('function');
  });
});
