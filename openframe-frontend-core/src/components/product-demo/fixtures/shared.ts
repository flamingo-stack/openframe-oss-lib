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

export const DEMO_PEOPLE = {
  jen: { id: 'user-jen', name: 'Jen Park', initials: 'JP' },
  leo: { id: 'user-leo', name: 'Leo Martin', initials: 'LM' },
  maya: { id: 'user-maya', name: 'Maya Lopez', initials: 'ML' },
  priya: { id: 'user-priya', name: 'Priya Shah', initials: 'PS' },
  sam: { id: 'user-sam', name: 'Sam Okafor', initials: 'SO' },
  dana: { id: 'user-dana', name: 'Dana Reyes', initials: 'DR' },
  alex: { id: 'user-alex', name: 'Alex Reed', initials: 'AR' },
} as const;

export const DEMO_DEVICES = {
  frontDesk: { id: 'device-frontdesk', hostname: 'FRONTDESK-LT02', os: 'WINDOWS', organization: 'harbor' },
  mayaAir: { id: 'device-maya', hostname: 'MAYA-MBA', os: 'MAC_OS', organization: 'northbridge' },
  samT14: { id: 'device-sam', hostname: 'SAM-T14', os: 'WINDOWS', organization: 'northbridge' },
  reception: { id: 'device-reception', hostname: 'RECEPTION-01', os: 'WINDOWS', organization: 'acme' },
  leoThinkPad: { id: 'device-leo', hostname: 'LEO-THINKPAD', os: 'WINDOWS', organization: 'harbor' },
  buildServer: { id: 'device-build', hostname: 'BUILD-SRV-01', os: 'LINUX', organization: 'acme' },
} as const;

/**
 * A fixed "now" for relative times, so a screen reads the same on every render
 * and never drifts between the server and the browser.
 */
export const DEMO_NOW = '2026-10-06T14:05:00.000Z';

/** An instant `minutes` before {@link DEMO_NOW}. */
export function demoMinutesAgo(minutes: number): string {
  return new Date(Date.parse(DEMO_NOW) - minutes * 60_000).toISOString();
}
