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

    private PipelineContext() {
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

    public static void clear() {
        orgId = null;
    }
}
