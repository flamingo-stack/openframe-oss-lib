/**
 * HubSpot's collected-forms opt-out — ONE owner for every `<form>` in the system.
 *
 * Hosts that run the HubSpot tracking tag (the hub's root layout does; so does
 * the OpenFrame dashboard, via GTM) also load HubSpot's "collected forms"
 * script, which binds to EVERY `<form>` on the page and re-posts its fields to
 * HubSpot as a "non-HubSpot form" submission. For a form that already reaches
 * HubSpot server-side (booking, contact) that double-counts the contact's
 * conversions and, with no id/name on the element, names the phantom form after
 * its class list ("Dashboard | OpenFrame: .flex, .flex-col, …"). For every
 * other form (search boxes, admin modals, sign-up) it ships fields HubSpot has
 * no business seeing.
 *
 * `data-hs-do-not-collect` is the script's own opt-out, checked at bind time,
 * so an opted-out form is never observed. Spread these props onto EVERY
 * `<form>` that is not itself a HubSpot form — the attribute must never be
 * spelled by hand at a call site.
 */
export const HUBSPOT_DO_NOT_COLLECT_FORM_PROPS = { 'data-hs-do-not-collect': 'true' } as const;
