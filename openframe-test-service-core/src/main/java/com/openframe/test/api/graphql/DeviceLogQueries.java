package com.openframe.test.api.graphql;

public class DeviceLogQueries {

    // machineIds are raw machine ids; omitting them reads every device of the tenant.
    public static final String DEVICE_LOGS = """
            query DeviceLogs($machineId: String, $machineIds: [String!], $filter: DeviceLogFilterInput, $first: Int, $after: String) {
                deviceLogs(machineId: $machineId, machineIds: $machineIds, filter: $filter, first: $first, after: $after) {
                    edges {
                        node {
                            timestamp
                            agentTimestamp
                            level
                            message
                            machineId
                            hostname
                            count
                        }
                        cursor
                    }
                    pageInfo {
                        hasNextPage
                        hasPreviousPage
                        startCursor
                        endCursor
                    }
                }
            }
            """;
}
