package com.openframe.test.api.graphql;

// Software action documents on api/graphql (software-action.graphqls): the Software Actions page, its dropdowns and the per-device drill-down.
public class SoftwareActionQueries {

    private static final String RUN_FIELDS = """
            fragment runFields on SoftwareActionRun {
                id
                executionId
                software
                action
                engine
                status
                totalMachineCount
                respondedMachineCount
                scheduledAt
                dispatchedAt
                finishedAt
                initiatedBy
                bundleId
                scheduleId
            }
            """;

    private static final String OPTION = "{ value label count }";

    public static final String GET_SOFTWARE_ACTIONS = """
            query SoftwareActions($filter: SoftwareActionFilterInput, $search: String, $first: Int, $after: String) {
                softwareActions(filter: $filter, search: $search, first: $first, after: $after) {
                    edges { node { ...runFields } cursor }
                    pageInfo { hasNextPage hasPreviousPage startCursor endCursor }
                    filteredCount
                }
            }
            """ + RUN_FIELDS;

    public static final String GET_SOFTWARE_ACTION = """
            query SoftwareAction($id: ID!) {
                softwareAction(id: $id) {
                    ...runFields
                }
            }
            """ + RUN_FIELDS;

    public static final String GET_SOFTWARE_ACTION_FILTERS = """
            query SoftwareActionFilters($filter: SoftwareActionFilterInput, $search: String) {
                softwareActionFilters(filter: $filter, search: $search) {
                    statuses %s
                    actions %s
                    engines %s
                    filteredCount
                }
            }
            """.formatted(OPTION, OPTION, OPTION);

    public static final String GET_SOFTWARE_ACTION_EXECUTIONS = """
            query SoftwareActionExecutions($actionId: String!, $filter: SoftwareActionDeviceFilterInput, $search: String) {
                softwareActionExecutions(actionId: $actionId, filter: $filter, search: $search) {
                    machineId
                    hostname
                    organizationId
                    organizationName
                    status
                    exitCode
                    stdout
                    stdoutTruncated
                    stderr
                    stderrTruncated
                    error
                    dispatchedAt
                    finishedAt
                }
            }
            """;
}
