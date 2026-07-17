package com.openframe.test.context;

/**
 * Process-wide holder for fixtures shared across an ordered pipeline run.
 *
 * <p>The all-tests pipeline creates an organization in its first phase and installs a device into
 * it; later phases (and their teardown) must target that same organization. Tests publish/consume
 * the id here so the phases stay wired even though the individual tests are otherwise stateless.
 *
 * <p>{@code volatile} because the publishing test runs on the async test-executor thread while the
 * orchestrator reads it on its own thread (after blocking on the phase future, which establishes
 * happens-before, but volatile keeps standalone reads correct too).
 *
 * <p>When unset (any standalone / single-tag run), consumers fall back to their default behavior.
 */
public final class PipelineContext {

    private static volatile String orgId;

    // Tenant registered by OwnerRegistrationTest (random email + subdomain). The all-tests pipeline
    // reads these after the registration phase so the E2E lifecycle runs against the tenant that was
    // just registered, rather than the static param tenant.
    private static volatile String registeredEmail;
    private static volatile String registeredDomain;

    // The target tenant's active agent registration secret, used as the device install --initialKey.
    private static volatile String initialKey;

    private PipelineContext() {
    }

    public static void setInitialKey(String key) {
        initialKey = key;
    }

    public static String getInitialKey() {
        return initialKey;
    }

    public static boolean hasInitialKey() {
        return initialKey != null && !initialKey.isBlank();
    }

    public static void setOrgId(String id) {
        orgId = id;
    }

    public static String getOrgId() {
        return orgId;
    }

    public static boolean hasOrgId() {
        return orgId != null && !orgId.isBlank();
    }

    public static void setRegisteredTenant(String email, String domain) {
        registeredEmail = email;
        registeredDomain = domain;
    }

    public static String getRegisteredEmail() {
        return registeredEmail;
    }

    public static String getRegisteredDomain() {
        return registeredDomain;
    }

    public static boolean hasRegisteredTenant() {
        return registeredEmail != null && !registeredEmail.isBlank()
                && registeredDomain != null && !registeredDomain.isBlank();
    }

    public static void clear() {
        orgId = null;
        registeredEmail = null;
        registeredDomain = null;
        initialKey = null;
    }
}
