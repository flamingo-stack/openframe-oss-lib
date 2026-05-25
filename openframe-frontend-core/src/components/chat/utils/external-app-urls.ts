/**
 * Unified URL builders for the third-party app deep-links used by chat
 * surfaces (chip clicks, inline-card tracking rows).
 *
 * Lib-side subset of the hub's `lib/utils/external-app-urls.ts`. Today
 * it carries the ClickUp deep-link helper only — HubSpot and admin
 * routes stay hub-side because they're consumed exclusively by
 * hub-internal mappers.
 */

const CLICKUP_APP_BASE = 'https://app.clickup.com'

/** ClickUp task detail page in the ClickUp UI. Returns `null` when the
 *  external id is missing so consumers don't end up with a
 *  `.../t/undefined` link. */
export function clickupTaskUrl(externalId: string | null | undefined): string | null {
  if (!externalId) return null
  return `${CLICKUP_APP_BASE}/t/${externalId}`
}
