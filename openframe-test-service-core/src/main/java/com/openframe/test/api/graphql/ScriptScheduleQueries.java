package com.openframe.test.api.graphql;

/**
 * GraphQL documents for the script-schedule API (openframe-api-service-core
 * {@code script-schedule.graphqls}), served on {@code api/graphql}. Every document that returns a
 * schedule selects the same {@code scheduleFields} fragment so the client maps one DTO.
 */
public class ScriptScheduleQueries {

    private static final String SCHEDULE_FIELDS = """
            fragment scheduleFields on ScriptSchedule {
                id
                name
                description
                supportedPlatforms
                selectionMode
                deviceCriteria { organizationIds deviceTypes osTypes }
                trigger
                timeReference
                offlineBehavior
                reconnectWindowSeconds
                startAt
                repeat
                nextRunAt
                lastRunAt
                deviceCount
                status
                statusChangedAt
                createdAt
                updatedAt
                scripts {
                    id
                    name
                    shell
                    supportedPlatforms
                }
            }
            """;

    public static final String GET_SCRIPT_SCHEDULE = """
            query GetScriptSchedule($id: ID!) {
                scriptSchedule(id: $id) {
                    ...scheduleFields
                }
            }
            """ + SCHEDULE_FIELDS;

    public static final String SCRIPT_SCHEDULES = """
            query ScriptSchedules($filter: ScriptScheduleFilterInput, $search: String, $first: Int, $after: String) {
                scriptSchedules(filter: $filter, search: $search, first: $first, after: $after) {
                    filteredCount
                    edges {
                        node {
                            ...scheduleFields
                        }
                        cursor
                    }
                    pageInfo { hasNextPage hasPreviousPage startCursor endCursor }
                }
            }
            """ + SCHEDULE_FIELDS;

    public static final String SCRIPT_SCHEDULE_FILTERS = """
            query ScriptScheduleFilters($filter: ScriptScheduleFilterInput) {
                scriptScheduleFilters(filter: $filter) {
                    platforms { value label count }
                    authors { value label count }
                    filteredCount
                }
            }
            """;

    public static final String CREATE_SCRIPT_SCHEDULE = """
            mutation CreateScriptSchedule($input: CreateScriptScheduleInput!) {
                createScriptSchedule(input: $input) {
                    ...scheduleFields
                }
            }
            """ + SCHEDULE_FIELDS;

    public static final String UPDATE_SCRIPT_SCHEDULE = """
            mutation UpdateScriptSchedule($input: UpdateScriptScheduleInput!) {
                updateScriptSchedule(input: $input) {
                    ...scheduleFields
                }
            }
            """ + SCHEDULE_FIELDS;

    public static final String ARCHIVE_SCRIPT_SCHEDULE = """
            mutation ArchiveScriptSchedule($id: ID!) {
                archiveScriptSchedule(id: $id) {
                    ...scheduleFields
                }
            }
            """ + SCHEDULE_FIELDS;

    public static final String UNARCHIVE_SCRIPT_SCHEDULE = """
            mutation UnarchiveScriptSchedule($id: ID!) {
                unarchiveScriptSchedule(id: $id) {
                    ...scheduleFields
                }
            }
            """ + SCHEDULE_FIELDS;

    /** Soft-delete; the only cleanup that hides a schedule from default queries. Idempotent. */
    public static final String DELETE_SCRIPT_SCHEDULE = """
            mutation DeleteScriptSchedule($id: ID!) {
                deleteScriptSchedule(id: $id)
            }
            """;

    // ---- device targeting (plan item CP-2) ----

    private static final String DEVICE_NODE = "node { id machineId hostname osType status organizationId }";

    /**
     * The two device pickers of a schedule, narrowed by {@code search} (hostname substring) so a
     * shared tenant does not page: {@code assignedDevices} is what the schedule targets today,
     * {@code availableDevices} is the platform-scoped selectable set with an {@code assigned} flag per
     * edge. {@code deviceCount} is the DEVICES column, independent of the pickers' paging.
     */
    public static final String GET_SCHEDULE_DEVICES = """
            query ScheduleDevices($id: ID!, $first: Int, $search: String) {
                scriptSchedule(id: $id) {
                    id
                    deviceCount
                    selectionMode
                    deviceCriteria { organizationIds deviceTypes osTypes }
                    assignedDevices(first: $first, search: $search) {
                        filteredCount
                        edges { %s cursor }
                    }
                    availableDevices(first: $first, search: $search) {
                        filteredCount
                        edges { %s cursor assigned }
                    }
                }
            }
            """.formatted(DEVICE_NODE, DEVICE_NODE);

    public static final String ADD_DEVICES_TO_SCHEDULE = """
            mutation AddDevicesToSchedule($scheduleId: ID!, $machineIds: [ID!]!) {
                addDevicesToSchedule(scheduleId: $scheduleId, machineIds: $machineIds) {
                    ...scheduleFields
                }
            }
            """ + SCHEDULE_FIELDS;

    public static final String REMOVE_DEVICES_FROM_SCHEDULE = """
            mutation RemoveDevicesFromSchedule($scheduleId: ID!, $machineIds: [ID!]!) {
                removeDevicesFromSchedule(scheduleId: $scheduleId, machineIds: $machineIds) {
                    ...scheduleFields
                }
            }
            """ + SCHEDULE_FIELDS;

    public static final String ADD_ALL_DEVICES_TO_SCHEDULE = """
            mutation AddAllDevicesToSchedule($scheduleId: ID!, $filter: DeviceFilterInput, $search: String) {
                addAllDevicesToSchedule(scheduleId: $scheduleId, filter: $filter, search: $search) {
                    ...scheduleFields
                }
            }
            """ + SCHEDULE_FIELDS;

    public static final String REMOVE_ALL_DEVICES_FROM_SCHEDULE = """
            mutation RemoveAllDevicesFromSchedule($scheduleId: ID!, $filter: DeviceFilterInput, $search: String) {
                removeAllDevicesFromSchedule(scheduleId: $scheduleId, filter: $filter, search: $search) {
                    ...scheduleFields
                }
            }
            """ + SCHEDULE_FIELDS;

    /** PUT semantics — backs "Edit Devices": the given set replaces the whole assignment. */
    public static final String SET_SCRIPT_SCHEDULE_DEVICES = """
            mutation SetScriptScheduleDevices($scheduleId: ID!, $machineIds: [ID!]!) {
                setScriptScheduleDevices(scheduleId: $scheduleId, machineIds: $machineIds) {
                    ...scheduleFields
                }
            }
            """ + SCHEDULE_FIELDS;

    public static final String SET_SCHEDULE_DEVICE_CRITERIA = """
            mutation SetScheduleDeviceCriteria($scheduleId: ID!, $criteria: ScheduleDeviceCriteriaInput!) {
                setScheduleDeviceCriteria(scheduleId: $scheduleId, criteria: $criteria) {
                    ...scheduleFields
                }
            }
            """ + SCHEDULE_FIELDS;
}
