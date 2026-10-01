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

    public static final String ORGANIZATION_REMOTE_ACCESS_POLICY = """
            query OrganizationRemoteAccessPolicy($organizationId: String!) {
                organizationRemoteAccessPolicy(organizationId: $organizationId) {
                    organizationId
                    mode
                    effectiveMode
                    updatedBy
                    updatedAt
                }
            }
            """;

    // mode null clears the override; refusals come back as userErrors with a code.
    public static final String SET_ORGANIZATION_REMOTE_ACCESS_MODE = """
            mutation SetOrganizationRemoteAccessMode($organizationId: String!, $mode: RemoteAccessMode) {
                setOrganizationRemoteAccessMode(organizationId: $organizationId, mode: $mode) {
                    policy { organizationId mode effectiveMode updatedBy updatedAt }
                    userErrors { code message field }
                }
            }
            """;

    // mode null clears the override; refusals are GraphQL errors with extensions.code, not userErrors.
    public static final String SET_DEVICE_REMOTE_ACCESS_MODE = """
            mutation SetDeviceRemoteAccessMode($machineId: String!, $mode: RemoteAccessMode) {
                setDeviceRemoteAccessMode(machineId: $machineId, mode: $mode) {
                    id
                    machineId
                    hostname
                    organizationId
                    remoteAccess { mode effectiveMode effectiveScope updatedBy updatedAt }
                }
            }
            """;
}
