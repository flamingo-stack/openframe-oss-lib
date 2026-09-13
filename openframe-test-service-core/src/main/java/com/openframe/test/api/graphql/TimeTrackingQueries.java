package com.openframe.test.api.graphql;

/**
 * GraphQL documents for the time-tracking API (openframe-api-service-core
 * {@code time-tracking.graphqls}), served on {@code api/graphql}. Every document that returns an
 * entry selects the same {@code timeEntryFields} fragment; {@code user { id }} is selected because
 * it is the Relay global id the mutation inputs and employee filters expect.
 */
public class TimeTrackingQueries {

    private static final String TIME_ENTRY_FIELDS = """
            fragment timeEntryFields on TimeEntry {
                id
                userId
                user { id firstName lastName email }
                ticketId
                ticketNumber
                ticketTitle
                organizationId
                notes
                startedAt
                endedAt
                pausedAt
                durationSeconds
                breakSeconds
                state
                source
                createdAt
                updatedAt
            }
            """;

    private static final String CONNECTION_BODY = """
                    filteredCount
                    edges {
                        node { ...timeEntryFields }
                        cursor
                    }
                    pageInfo { hasNextPage hasPreviousPage startCursor endCursor }
            """;

    public static final String CURRENT_TIMER = """
            query CurrentTimer {
                currentTimer { ...timeEntryFields }
            }
            """ + TIME_ENTRY_FIELDS;

    public static final String TIME_ENTRY = """
            query TimeEntry($id: ID!) {
                timeEntry(id: $id) { ...timeEntryFields }
            }
            """ + TIME_ENTRY_FIELDS;

    public static final String MY_TIME_ENTRIES = """
            query MyTimeEntries($period: DateRangeInput, $search: String, $first: Int, $after: String) {
                myTimeEntries(period: $period, search: $search, first: $first, after: $after) {
            """ + CONNECTION_BODY + """
                }
            }
            """ + TIME_ENTRY_FIELDS;

    public static final String EMPLOYEE_TIME_ENTRIES = """
            query EmployeeTimeEntries($filter: TimeEntryFilterInput, $search: String, $first: Int, $after: String) {
                employeeTimeEntries(filter: $filter, search: $search, first: $first, after: $after) {
            """ + CONNECTION_BODY + """
                }
            }
            """ + TIME_ENTRY_FIELDS;

    public static final String EMPLOYEE_TIME_STATS = """
            query EmployeeTimeStats($filter: TimeEntryFilterInput) {
                employeeTimeStats(filter: $filter) {
                    todayTotalSeconds
                    todayEntryCount
                    periodTotalSeconds
                    periodEntryCount
                    averagePerDaySeconds
                }
            }
            """;

    public static final String START_TIMER = """
            mutation StartTimer($input: StartTimerInput) {
                startTimer(input: $input) { ...timeEntryFields }
            }
            """ + TIME_ENTRY_FIELDS;

    public static final String PAUSE_TIMER = """
            mutation PauseTimer {
                pauseTimer { ...timeEntryFields }
            }
            """ + TIME_ENTRY_FIELDS;

    public static final String RESUME_TIMER = """
            mutation ResumeTimer {
                resumeTimer { ...timeEntryFields }
            }
            """ + TIME_ENTRY_FIELDS;

    public static final String STOP_TIMER = """
            mutation StopTimer($input: StopTimerInput) {
                stopTimer(input: $input) { ...timeEntryFields }
            }
            """ + TIME_ENTRY_FIELDS;

    /** Discards the caller's active timer; false when there is none. */
    public static final String CANCEL_TIMER = """
            mutation CancelTimer {
                cancelTimer
            }
            """;

    public static final String CREATE_TIME_ENTRY = """
            mutation CreateTimeEntry($input: CreateTimeEntryInput!) {
                createTimeEntry(input: $input) { ...timeEntryFields }
            }
            """ + TIME_ENTRY_FIELDS;

    public static final String UPDATE_TIME_ENTRY = """
            mutation UpdateTimeEntry($input: UpdateTimeEntryInput!) {
                updateTimeEntry(input: $input) { ...timeEntryFields }
            }
            """ + TIME_ENTRY_FIELDS;

    public static final String UNLINK_TICKET_FROM_TIME_ENTRY = """
            mutation UnlinkTicketFromTimeEntry($id: ID!) {
                unlinkTicketFromTimeEntry(id: $id) { ...timeEntryFields }
            }
            """ + TIME_ENTRY_FIELDS;

    /** True when the entry existed and was deleted; false for an unknown id. */
    public static final String DELETE_TIME_ENTRY = """
            mutation DeleteTimeEntry($id: ID!) {
                deleteTimeEntry(id: $id)
            }
            """;
}
