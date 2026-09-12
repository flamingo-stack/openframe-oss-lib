# Known gaps

Consulted by the analyser **before** ranking a gap. An operation that matches an entry here is not
reported as an open gap: it is listed under the entry's class instead. Add entries at the bottom with a
stable id; edit an entry when a decision changes.

**How matching works (`coverage_matrix.py`).** Only the backticked tokens in an entry's `- **Ops:**`
bullet select rows, and only these forms count: a matrix key (`query:node`, `POST /webhook/stripe`),
an operation name that is unique in the product (`installSoftware`), a controller class name
(`ImageController`), or a path pattern for any method (`/internal/**`, `/tools/{toolId}/health`,
`GET|POST /oauth/login/sso/complete`, `/{organizations,users}/image`). Module names and schema file
names never select anything. Do not backtick a class or path in the Ops line unless you mean to
exclude it; everything under **Why** is prose. The "Known gaps applied" line in `coverage.md` shows
how many rows each entry matched — check it after editing an entry.

Classes:

- `OUT-OF-SCOPE(<reason>)` — not something the E2E suite should call (plumbing, third-party payloads,
  endpoints not reachable through a tenant host).
- `THIRD-PARTY` — a proxy to an integrated tool; the tool's own API is covered only as far as a
  product feature depends on it.
- `DEFERRED(<what is needed>)` — real surface, agreed to leave uncovered until a precondition exists.
- `ACCEPTED` — covered another way (UI flow, another suite) or the drift is expected.
- `UNSURE` — needs a decision or a product-side answer; keep reporting until resolved.

Every entry below marked *proposed* was drafted from the 2026-09-12 survey and has **not** been
confirmed by the suite owner. Confirm, reclassify, or delete.

---

## KG-1 — Relay and federation plumbing — OUT-OF-SCOPE(plumbing) — *proposed*
- **Ops:** `query:node`, `query:nodes` (shared.graphqls), `query:_service`, `query:_entities`.
- **Why:** infrastructure fields with no business behaviour of their own; `node` is exercised implicitly
  by every Relay refetch.

## KG-2 — Test-clock and usage-seeding mutations — OUT-OF-SCOPE(test fixture) — *proposed*
- **Ops:** `mutation:advanceTestClock`, `mutation:resetTestClock`, `mutation:seedTestUsage`,
  `query:testClockTime`; REST `POST /internal/test-clock/{tenantId}/advance|reset`.
- **Why:** present only in the app's `schema.graphql` and in `openframe-saas-internal-api`
  (`TestClockController`); they exist to drive billing tests, they are not product surface. Worth using
  *as a fixture* if billing coverage (KG-3) is ever picked up.

## KG-3 — Billing and subscription — DEFERRED(Stripe test mode + a tenant on a paid plan) — *proposed*
- **Ops:** tenant.graphqls `createCheckoutSession`, `createBillingPortalSession`, `cancelSubscription`,
  `resumeSubscription`, `updateSubscription`, `cancelPendingDowngrade`, `detachPaymentMethods`,
  `updateAiSpendCap`, `billingPlan`, `subscription`, `subscriptionCancellationPreview`,
  `validateDiscount`, `aiModelRates`, `billingProvisioningStatus`; REST `/internal/subscription/**`,
  `/internal/billing/**`; webhooks in KG-4.
- **Why:** the UI uses most of these (settings/billing-usage), so they are real `gap-ui` items, but a
  test needs a Stripe test-mode account wired to the qa tenant and a way to reset the subscription
  state between runs. Decision needed on whether qa gets that.

## KG-4 — Third-party webhooks — OUT-OF-SCOPE(signed third-party payloads) — *proposed*
- **Ops:** `POST /webhook/stripe`, `POST /webhook/hubspot` (openframe-saas-webhook).
- **Why:** callers are Stripe and HubSpot with signed bodies; an E2E test would have to forge signatures.
  Unit/contract tests belong in the service.

## KG-5 — Endpoints not reachable through a tenant host — OUT-OF-SCOPE(not gateway-exposed) — *proposed*
- **Ops:** `openframe-saas-internal-api` `/internal/**` (except as fixtures, KG-2/KG-3),
  `openframe-saas-infra` `/infra/ns/**`, `openframe-saas-management` `/v1/cluster-registrations`,
  `/v1/tools/{id}`, `/health`; `openframe-management-service-core` `/v1/devices/pinot-resync`,
  `/v1/tools/**`; `openframe-config-core` `/logging/{filename}`; `openframe-saas-test`'s own
  `/tests/**` and `/tenants/report/auto`; `openframe-gateway-service-core` `/internal/authz/probe`.
- **Why:** cluster-internal or operator surface; no route on the tenant or shared gateway exposes them.

## KG-6 — Integrated-tool proxies — THIRD-PARTY — *proposed*
- **Ops:** every mapping of `IntegrationController` (gateway: /tools/{toolId}/**, /agent/{toolId}/**,
  /tools/{toolId}/health, /tools/{toolId}/test; external-api: /tools/{toolId}/**). Selected by class
  name on purpose: a path pattern on /agent/{toolId}/** would also swallow the api-service's
  /agent/registration-secret endpoints, which are real product surface.
- **Why:** unbounded path space proxied to Fleet and MeshCentral. The suite already goes through the
  proxy for Fleet policies/queries/hosts (`MonitoringApi`) and Mesh device status (`DeviceApi`); count
  that as the coverage that matters and do not enumerate tool endpoints.

## KG-7 — Rendered login pages — ACCEPTED — *proposed*
- **Ops:** `LoginController` `GET /login`, `GET /` (view controllers, no `@ResponseBody`).
- **Why:** exercised by the Playwright login flow (`UILoginFlow`) and by `AuthFlowSAAS` fetching the page
  for the CSRF token. Not an API to assert on.

## KG-8 — `POST sas/login` has no controller — ACCEPTED drift — *proposed*
- **Ops:** test call `POST sas/login` (`AuthFlowSAAS.postCredentials`).
- **Why:** handled by Spring Security's form-login filter, so it never appears in the controller
  inventory. The test call is correct; the drift line is expected.

## KG-9 — Mobile presence and push registration — DEFERRED(a device push token) — *proposed*
- **Ops:** `mutation:recordPresence`, `mutation:registerPushDevice`, `mutation:unregisterPushDevice`,
  `mutation:cancelPendingPush`.
- **Why:** the UI calls them from the native/desktop shell; registering a push device needs a real token
  from a platform push service. `recordPresence` alone could be asserted cheaply if presence ever
  becomes a feature under test.

## KG-10 — UI calls `DELETE api/organizations/{id}`, no product endpoint — UNSURE
- **Ops:** UI REST `DELETE api/organizations/{id}` (customers feature). OrganizationController exposes
  only POST, PUT /{id}, GET /{id}/can-archive, PATCH /{id}/status — those four stay open gaps.
- **Why:** either dead UI code or a missing endpoint. Ask the frontend owner; if the button is live it
  fails today and deserves a test once the endpoint exists.

## KG-11 — Entity image upload/URL endpoints — DEFERRED(multipart + presigned upload fixture) — *proposed*
- **Ops:** `openframe-saas-web-common` `ImageController`: `POST|PUT|DELETE /{organizations,users,tenants,client-agent-settings}/image`,
  `.../image/upload-url`, `.../image/url`, `GET /images/{entityType}/{entityId}`, `GET /tenants/image`.
- **Why:** 19 endpoints behind one controller; the UI uses only `DELETE /users/image` today. A single
  round-trip test (upload URL → PUT → GET → DELETE) on one entity type would cover the mechanism; the
  rest is repetition. Keep as a P3 candidate.

## KG-12 — Fleet enrichment passthrough — THIRD-PARTY — *proposed*
- **Ops:** tenant gateway route `/v0/fleet/enrichment/api/v1/fleet/queries/*` and
  `.../global/policies/*` (StripPrefix=3 to the platform Fleet service).
- **Why:** a route, not a controller; the analyser does not see it. Covered as far as `MonitoringApi`
  exercises Fleet policies and queries.

## KG-13 — Software and software-schedule GraphQL — DEFERRED(a UI consumer) — *proposed*
- **Ops:** `software.graphqls` `installSoftware`, `updateSoftware`; `software-schedule.graphqls`
  `createSoftwareSchedule`, `updateSoftwareSchedule`, `archiveSoftwareSchedule`,
  `unarchiveSoftwareSchedule`, `deleteSoftwareSchedule`, `addDevicesToSoftwareSchedule`,
  `removeDevicesFromSoftwareSchedule`, `setSoftwareScheduleDevices`, `softwareSchedule`,
  `softwareSchedules`; `script-execution.graphqls` `softwareExecutions`, `softwareExecutionFilters`
  (14 ops, all in `openframe-api-service-core`).
- **Why:** every one of them was introduced on 2026-09-12 and the dashboard app at
  `openframe-oss-frontend` f1d0227 selects none of them — the backend shipped ahead of its UI. Nothing
  consumes them yet, so a test would assert against a contract still in motion. Revisit as soon as the
  app ships the screens: the surface mirrors script-schedule almost field for field, so the
  script-schedule tests are the template.

## KG-14 — SSO / OAuth browser redirect endpoints — DEFERRED(an IdP test account) — *proposed*
- **Ops:** `openframe-authorization-service-core` `SsoLoginController` (`GET /oauth/login/sso`,
  `/oauth/login/sso/pending`, `GET|POST /oauth/login/sso/complete`), `SsoJoinController`
  (`GET /oauth/join/pending`, `/oauth/join/complete`), `SsoDiscoveryController`
  (`GET /sso/providers/invite`, `/sso/providers/registration`), `AppleNativeDiscoveryController`
  (`POST /oauth/apple/native/discover`, `/oauth/apple/native/register`),
  `InvitationRegistrationController` `GET /invitations/accept/sso`, `TenantRegistrationController`
  `GET /oauth/register/sso`; `openframe-security-oauth` `OAuthBffController`
  (`GET /oauth/join-return`, `/oauth/signup-continue`, `POST /oauth/login/sso/complete`,
  `/oauth/apple/native-register`).
- **Why:** browser redirect flows that need a live session at an external identity provider; an API
  test can only drive them with a real IdP account and a cookie jar. Nine of them landed after
  2026-09-01, so this is the fastest-growing untested area in the matrix — deferring it is a choice
  that should be revisited, not a dismissal. The library already has `pages/SsoLoginPage.java` and
  `UILoginFlow`, so the cheaper path may be a Playwright case in the `device` phase rather than API
  tests. Decide which before writing anything.
