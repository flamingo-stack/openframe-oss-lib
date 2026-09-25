package com.openframe.test.api.graphql;

/**
 * Tenant-scoped remote-access policy on {@code api/graphql} (schema: remote-access-policy.graphqls).
 *
 * <p>{@code RemoteAccessMode} is one of APPROVAL_REQUIRED, NOTIFY_ONLY, SILENT_ACCESS, DENY_ACCESS. The
 * backend resolves device → organization → tenant → code default, and that code default is
 * APPROVAL_REQUIRED ({@code RemoteAccessApprovalProperties}), which is why an unconfigured tenant makes
 * every remote session wait for an end user who is not there.
 */
public final class RemoteAccessQueries {

    private RemoteAccessQueries() {
    }

    public static final String TENANT_REMOTE_ACCESS_POLICY = """
            query RemoteAccessPolicy {
                remoteAccessPolicy {
                    mode
                    usingDefault
                }
            }
            """;

    public static final String SET_TENANT_REMOTE_ACCESS_MODE = """
            mutation SetTenantRemoteAccessMode($mode: RemoteAccessMode!) {
                setTenantRemoteAccessMode(mode: $mode) {
                    policy { mode usingDefault }
                    userErrors { field message }
                }
            }
            """;
}
