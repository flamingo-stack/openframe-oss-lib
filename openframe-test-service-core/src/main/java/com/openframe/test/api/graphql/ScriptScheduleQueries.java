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
}
