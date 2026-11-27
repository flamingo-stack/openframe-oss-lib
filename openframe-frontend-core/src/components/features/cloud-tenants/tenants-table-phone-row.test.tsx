import { render, screen } from '@testing-library/react';
import type { ReactElement } from 'react';
import { describe, expect, it } from 'vitest';
import { resolveProductDemoCast } from '../../product-demo/cast';
import { buildCloudTenantsFixture } from '../../product-demo/fixtures/cloud-tenants';
import CloudTenantsScreen from '../../product-demo/screens/cloud-tenants';
import type { MultiCustomerTenantRow } from './tenant-row';
import { TenantsTableView } from './tenants-table-view';

/**
 * CU-17tkuw6ajfr: on a phone the card row lays its cells out by their base classes (no `content-*:` class applies
 * below 720px of content), and the tenant column (`flex-1`, a zero basis) only gets what the other cells leave. The
 * access cell kept a 200px width there, so in the product page's carousel card the tenant shrank to 0px and the row
 * showed the access tag alone. jsdom lays nothing out, so this reads the row's flex constraints from its classes and
 * checks what they guarantee the tenant at the narrowest rows a phone draws.
 */

/** What a card row takes from its width before its cells: its 1px border and its inset (`--spacing-system-mf`). */
const ROW_CHROME = 2 + 2 * 16;
/** The page padding around a list on a phone (`--spacing-system-l`, 16px each side). */
const PHONE_PADDING = 2 * 16;
/**
 * The room for the cells of the product page's carousel card at a 375px window, the narrowest row a phone draws: the
 * card's screen is 218px wide and pads the table like a page.
 */
const CARD_ROW_CONTENT = 218 - PHONE_PADDING - ROW_CHROME;
/** The room for the cells of the product's tenants list on a 320px phone. */
const PHONE_ROW_CONTENT = 320 - PHONE_PADDING - ROW_CHROME;
/** The row's gap between two cells (`ROW_SHELL_CLASSES`, `--spacing-system-mf`). */
const CELL_GAP = 16;
/** The provider's 24px mark, its 4px gap and about six characters of the name: the least a tenant cell must keep. */
const TENANT_MIN_WIDTH = 24 + 4 + 36;

const REM = 16;
/** Tailwind's spacing step: `w-12` is 48px. */
const SPACING_STEP = 4;

/** What a cell's classes make of it on a phone. */
interface PhoneCell {
  hidden: boolean;
  /** Its `min-width`: how far it can shrink. */
  floor: number;
  /** Its stated width; `null` when its content sizes it. */
  width: number | null;
  /** `flex-none` / `shrink-0`: it never gives way. */
  rigid: boolean;
}

/** The classes that apply below `content-md`: the unprefixed ones. */
const phoneClasses = (element: Element) => [...element.classList].filter(name => !name.includes(':'));

function toPx(value: string, unit: string): number {
  return Number.parseFloat(value) * (unit === 'rem' ? REM : 1);
}

function phoneCell(cell: Element): PhoneCell {
  const classes = phoneClasses(cell);
  const result: PhoneCell = { hidden: classes.includes('hidden'), floor: 0, width: null, rigid: false };
  for (const name of classes) {
    const floor = /^min-w-\[(\d+(?:\.\d+)?)(px|rem)\]$/.exec(name);
    if (floor) result.floor = toPx(floor[1], floor[2]);
    const width = /^w-\[(\d+(?:\.\d+)?)(px|rem)\]$/.exec(name) ?? /^w-(\d+)$/.exec(name);
    if (width) result.width = width[2] ? toPx(width[1], width[2]) : Number(width[1]) * SPACING_STEP;
    if (name === 'flex-none' || name === 'shrink-0') result.rigid = true;
  }
  return result;
}

/** The cells of the card row that holds `text`, by the text each one holds. */
function rowCells(text: string): { tenant: Element; others: Element[] } {
  const cell = screen.getAllByText(text)[0].closest('a > div > div');
  if (!cell?.parentElement) throw new Error(`no card row holds "${text}"`);
  const cells = [...cell.parentElement.children];
  return { tenant: cell, others: cells.filter(other => other !== cell) };
}

/**
 * The width the row guarantees its tenant cell, and the room the other cells leave it once each has given all the
 * way it can. A cell that never gives way and has no stated width is sized by its content: it can take any width, so
 * the room it leaves is unknown (NaN).
 */
function tenantRoom(text: string, rowContent: number) {
  const { tenant, others } = rowCells(text);
  const shown = others.map(phoneCell).filter(cell => !cell.hidden);
  const othersLeast = shown.reduce((total, cell) => total + (cell.rigid ? (cell.width ?? Number.NaN) : cell.floor), 0);
  return {
    guaranteed: phoneCell(tenant).floor,
    room: rowContent - shown.length * CELL_GAP - othersLeast,
  };
}

/** Whether the element is drawn on a phone: neither it nor a box around it is `hidden` there. */
function shownOnPhone(element: Element): boolean {
  for (let node: Element | null = element; node && node.tagName !== 'A'; node = node.parentElement) {
    if (phoneClasses(node).includes('hidden')) return false;
  }
  return true;
}

const FIXTURE = buildCloudTenantsFixture(resolveProductDemoCast());
const FIRST_TENANT = FIXTURE.rows[0].name;

const MULTI_CUSTOMER_ROW: MultiCustomerTenantRow = {
  id: 't1',
  name: 'Green Valley Manufacturing',
  provider: 'MICROSOFT_365',
  domain: 'greenvalleymanufacturing.onmicrosoft.com',
  customers: [{ name: 'Green Valley Manufacturing' }],
  accessState: 'WRITE_ENABLED',
  lastReadAt: '2026-10-28T09:00:00Z',
};

const LISTS: { name: string; tenant: string; rowContent: number; ui: () => ReactElement }[] = [
  {
    name: 'the product page card (the compact Cloud tenants screen)',
    tenant: FIRST_TENANT,
    rowContent: CARD_ROW_CONTENT,
    ui: () => <CloudTenantsScreen compact />,
  },
  {
    name: "the product's tenants list",
    tenant: FIRST_TENANT,
    rowContent: PHONE_ROW_CONTENT,
    ui: () => <TenantsTableView rows={FIXTURE.rows} getHref={row => `#${row.id}`} now={FIXTURE.now} />,
  },
  {
    name: 'the multi-customer tenants list',
    tenant: MULTI_CUSTOMER_ROW.name,
    rowContent: PHONE_ROW_CONTENT,
    ui: () => <TenantsTableView variant="multi-customer" rows={[MULTI_CUSTOMER_ROW]} getHref={row => `#${row.id}`} />,
  },
];

describe('a tenants card row on a phone', () => {
  it.each(LISTS)('$name keeps room for the tenant beside the access tag', ({ tenant, rowContent, ui }) => {
    render(ui());
    const { guaranteed, room } = tenantRoom(tenant, rowContent);

    expect(guaranteed).toBeGreaterThanOrEqual(TENANT_MIN_WIDTH);
    // What the tenant keeps fits beside what the other cells cannot give up, so nothing is pushed past the row's edge.
    expect(guaranteed).toBeLessThanOrEqual(room);
  });

  it.each(LISTS)('$name cuts the access tag before the tenant, by its own ellipsis', ({ tenant, ui }) => {
    render(ui());
    const tag = screen.getAllByText('Write enabled')[0].closest('.inline-flex');

    expect(shownOnPhone(screen.getAllByText(tenant)[0])).toBe(true);
    expect(tag).not.toBeNull();
    expect(shownOnPhone(tag as Element)).toBe(true);
    // Never wider than its cell: the label's ellipsis cuts it, not the cell's edge.
    expect(tag).toHaveClass('max-w-full');
  });

  it('draws the access tag alone, as the phone design does: the last read waits for a wider layout', () => {
    render(<CloudTenantsScreen compact />);

    expect(shownOnPhone(screen.getAllByText(/^Last read: /)[0])).toBe(false);
  });
});
