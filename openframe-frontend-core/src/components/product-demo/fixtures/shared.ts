/**
 * The cast every product-screen fixture draws from, so the screens of one page
 * tell one story. The people are the hub's demo personas (invented names); the
 * organizations and devices are invented too.
 */
export const DEMO_ORGANIZATIONS = {
  acme: { id: 'org-acme', name: 'Acme Logistics', initials: 'AL', domain: 'acmelogistics.example' },
  northbridge: { id: 'org-northbridge', name: 'Northbridge Legal', initials: 'NL', domain: 'northbridgelegal.example' },
  harbor: { id: 'org-harbor', name: 'Harbor Dental', initials: 'HD', domain: 'harbordental.example' },
} as const;

/**
 * `slug` is the persona's slug at the host (the key its portrait arrives by,
 * see `ProductDemoCastProvider`; the host's own technician is `tech`); `role` decides how the product draws the
 * person: a technician works in the product, an end user is the customer's
 * employee on the other end.
 */
export const DEMO_PEOPLE = {
  jen: { id: 'user-jen', slug: 'jen', name: 'Jen Park', initials: 'JP', role: 'end_user' },
  leo: { id: 'user-leo', slug: 'leo', name: 'Leo Martin', initials: 'LM', role: 'end_user' },
  maya: { id: 'user-maya', slug: 'maya', name: 'Maya Lopez', initials: 'ML', role: 'end_user' },
  priya: { id: 'user-priya', slug: 'priya', name: 'Priya Shah', initials: 'PS', role: 'end_user' },
  sam: { id: 'user-sam', slug: 'sam', name: 'Sam Okafor', initials: 'SO', role: 'end_user' },
  dana: { id: 'user-dana', slug: 'tech', name: 'Dana Reyes', initials: 'DR', role: 'technician' },
  alex: { id: 'user-alex', slug: 'alex-reed', name: 'Alex Reed', initials: 'AR', role: 'technician' },
  roman: { id: 'user-roman', slug: 'roman-smith', name: 'Roman Smith', initials: 'RS', role: 'technician' },
  sara: { id: 'user-sara', slug: 'sara-kim', name: 'Sara Kim', initials: 'SK', role: 'technician' },
} as const;

export type DemoPersonKey = keyof typeof DEMO_PEOPLE;
export type DemoOrganizationKey = keyof typeof DEMO_ORGANIZATIONS;

export const DEMO_DEVICES = {
  frontDesk: { id: 'device-frontdesk', hostname: 'FRONTDESK-LT02', os: 'WINDOWS', organization: 'harbor' },
  mayaAir: { id: 'device-maya', hostname: 'MAYA-MBA', os: 'MAC_OS', organization: 'northbridge' },
  samT14: { id: 'device-sam', hostname: 'SAM-T14', os: 'WINDOWS', organization: 'northbridge' },
  reception: { id: 'device-reception', hostname: 'RECEPTION-01', os: 'WINDOWS', organization: 'acme' },
  leoThinkPad: { id: 'device-leo', hostname: 'LEO-THINKPAD', os: 'WINDOWS', organization: 'harbor' },
  buildServer: { id: 'device-build', hostname: 'BUILD-SRV-01', os: 'LINUX', organization: 'acme' },
  jenSurface: { id: 'device-jen', hostname: 'JEN-SURFACE', os: 'WINDOWS', organization: 'acme' },
  priyaXps: { id: 'device-priya', hostname: 'PRIYA-XPS', os: 'WINDOWS', organization: 'northbridge' },
  warehouse: { id: 'device-warehouse', hostname: 'WAREHOUSE-PC03', os: 'WINDOWS', organization: 'acme' },
} as const;

/**
 * The fleet the Devices screen lists, in its order: each device with its kind, its status and how long ago it was
 * seen. The fixture builds its rows from it, and the screen's loading state counts its rows from it, so the two
 * always draw the same number of rows.
 */
export const DEMO_FLEET = [
  { device: DEMO_DEVICES.frontDesk, type: 'laptop', status: 'ONLINE', lastSeenMinutesAgo: 2 },
  { device: DEMO_DEVICES.reception, type: 'desktop', status: 'OFFLINE', lastSeenMinutesAgo: 190 },
  { device: DEMO_DEVICES.mayaAir, type: 'laptop', status: 'ONLINE', lastSeenMinutesAgo: 1 },
  { device: DEMO_DEVICES.buildServer, type: 'server', status: 'ONLINE', lastSeenMinutesAgo: 1 },
  { device: DEMO_DEVICES.leoThinkPad, type: 'laptop', status: 'OFFLINE', lastSeenMinutesAgo: 64 },
  { device: DEMO_DEVICES.samT14, type: 'laptop', status: 'ONLINE', lastSeenMinutesAgo: 3 },
  { device: DEMO_DEVICES.jenSurface, type: 'laptop', status: 'ONLINE', lastSeenMinutesAgo: 6 },
  { device: DEMO_DEVICES.priyaXps, type: 'laptop', status: 'ONLINE', lastSeenMinutesAgo: 2 },
] as const;

/** The OS the Devices screen's search answers, and how many fleet devices run it (the rows the search shows). */
export const DEMO_FLEET_SEARCH_OS = 'WINDOWS';
export const DEMO_FLEET_SEARCH_ROWS = DEMO_FLEET.filter(entry => entry.device.os === DEMO_FLEET_SEARCH_OS).length;

/**
 * A fixed "now" for relative times, so a screen reads the same on every render
 * and never drifts between the server and the browser.
 */
export const DEMO_NOW = '2026-10-06T14:05:00.000Z';

/** The demo day as a local calendar day, so a date field reads the same in every timezone. */
export function demoDay(): Date {
  const [year, month, day] = DEMO_NOW.slice(0, 10).split('-').map(Number);
  return new Date(year, month - 1, day);
}

/** An instant `minutes` before {@link DEMO_NOW}. */
export function demoMinutesAgo(minutes: number): string {
  return new Date(Date.parse(DEMO_NOW) - minutes * 60_000).toISOString();
}
