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

    // User created during the invitation flow (accepted invitation). The run deletes exactly this user at
    // teardown so it cleans up after itself and does not delete a shared admin other tests depend on.
    private static volatile String invitedUserId;
    private static volatile String invitedUserEmail;

    // A pipeline-scoped admin user created by the admin-setup phase and torn down at the very end. A freshly
    // registered tenant has only the OWNER (not an ADMIN), yet tests like ticket-assignment require an ADMIN
    // member; this fixture guarantees one exists for the whole functional run, independent of test ordering.
    private static volatile String fixtureAdminId;
    private static volatile String fixtureAdminEmail;

    private PipelineContext() {
    }

    public static void setFixtureAdmin(String id, String email) {
        fixtureAdminId = id;
        fixtureAdminEmail = email;
    }

    public static String getFixtureAdminId() {
        return fixtureAdminId;
    }

    public static String getFixtureAdminEmail() {
        return fixtureAdminEmail;
    }

    public static boolean hasFixtureAdmin() {
        return fixtureAdminId != null && !fixtureAdminId.isBlank();
    }

    public static void setInvitedUser(String id, String email) {
        invitedUserId = id;
        invitedUserEmail = email;
    }

    public static String getInvitedUserId() {
        return invitedUserId;
    }

    public static String getInvitedUserEmail() {
        return invitedUserEmail;
    }

    public static boolean hasInvitedUser() {
        return invitedUserId != null && !invitedUserId.isBlank();
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
        invitedUserId = null;
        invitedUserEmail = null;
        fixtureAdminId = null;
        fixtureAdminEmail = null;
    }
}
