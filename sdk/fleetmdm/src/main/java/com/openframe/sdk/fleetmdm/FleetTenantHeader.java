package com.openframe.sdk.fleetmdm;

/**
 * Startup-time guard for the {@code X-Tenant-Id} header value consumers pass into
 * {@link FleetMdmClient}/{@link FleetMdmSetupClient}.
 *
 * <p>The header itself is value-driven (blank ⇒ not sent) and always safe: a Fleet server without
 * multi-tenancy ignores it, and a shared multi-tenant Fleet fails closed (401) without it — a
 * missing header can never read another tenant's data. This guard exists for operability: in a
 * deployment that declares {@code openframe.fleet.multi-tenancy.enabled=true}, a blank tenant id is
 * a misconfiguration that would otherwise surface as opaque 401s at runtime; failing at
 * construction names the problem instead.
 */
public final class FleetTenantHeader {

    private FleetTenantHeader() {
    }

    /**
     * Validates the tenant id against the deployment's multi-tenancy declaration and returns it for
     * pass-through into a client constructor.
     *
     * @param multiTenancyEnabled the deployment's {@code openframe.fleet.multi-tenancy.enabled}
     * @param tenantId            the tenant UUID (typically the {@code TENANT_ID} env var); may be
     *                            null/blank when multi-tenancy is disabled
     * @throws IllegalStateException when multi-tenancy is enabled but the tenant id is blank
     */
    public static String validate(boolean multiTenancyEnabled, String tenantId) {
        if (multiTenancyEnabled && (tenantId == null || tenantId.isBlank())) {
            throw new IllegalStateException(
                    "openframe.fleet.multi-tenancy.enabled=true but no tenant id is configured "
                            + "(TENANT_ID env var missing?)");
        }
        return tenantId;
    }
}
