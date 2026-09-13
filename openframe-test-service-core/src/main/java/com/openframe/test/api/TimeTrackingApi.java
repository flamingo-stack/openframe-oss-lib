package com.openframe.test.api;

import com.openframe.test.data.dto.shared.DateRangeInput;
import com.openframe.test.data.dto.shared.GraphqlError;
import com.openframe.test.data.dto.timetracking.CreateTimeEntryInput;
import com.openframe.test.data.dto.timetracking.EmployeeTimeStats;
import com.openframe.test.data.dto.timetracking.TimeEntry;
import com.openframe.test.data.dto.timetracking.TimeEntryConnection;
import com.openframe.test.data.dto.timetracking.TimeEntryFilterInput;
import com.openframe.test.data.dto.timetracking.TimerInput;
import com.openframe.test.data.dto.timetracking.UpdateTimeEntryInput;
import io.restassured.path.json.JsonPath;
import io.restassured.response.Response;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static com.openframe.test.api.graphql.TimeTrackingQueries.CANCEL_TIMER;
import static com.openframe.test.api.graphql.TimeTrackingQueries.CREATE_TIME_ENTRY;
import static com.openframe.test.api.graphql.TimeTrackingQueries.CURRENT_TIMER;
import static com.openframe.test.api.graphql.TimeTrackingQueries.DELETE_TIME_ENTRY;
import static com.openframe.test.api.graphql.TimeTrackingQueries.EMPLOYEE_TIME_ENTRIES;
import static com.openframe.test.api.graphql.TimeTrackingQueries.EMPLOYEE_TIME_STATS;
import static com.openframe.test.api.graphql.TimeTrackingQueries.MY_TIME_ENTRIES;
import static com.openframe.test.api.graphql.TimeTrackingQueries.PAUSE_TIMER;
import static com.openframe.test.api.graphql.TimeTrackingQueries.RESUME_TIMER;
import static com.openframe.test.api.graphql.TimeTrackingQueries.START_TIMER;
import static com.openframe.test.api.graphql.TimeTrackingQueries.STOP_TIMER;
import static com.openframe.test.api.graphql.TimeTrackingQueries.TIME_ENTRY;
import static com.openframe.test.api.graphql.TimeTrackingQueries.UNLINK_TICKET_FROM_TIME_ENTRY;
import static com.openframe.test.api.graphql.TimeTrackingQueries.UPDATE_TIME_ENTRY;
import static com.openframe.test.config.EnvironmentConfig.GRAPHQL;
import static com.openframe.test.helpers.RequestSpecHelper.getAuthorizedSpec;
import static com.openframe.test.helpers.RequestSpecHelper.graphqlSuccess;
import static io.restassured.RestAssured.given;

/**
 * Client for the time-tracking GraphQL API: the caller's timer ({@code currentTimer},
 * start/pause/resume/stop/cancel), manual entries (create/update/unlink/delete) and the two lists
 * plus stats. Timer mutations act on the authenticated user's single active timer.
 */
public class TimeTrackingApi {

    /** The caller's active (running or paused) timer, or null. */
    public static TimeEntry currentTimer() {
        return query(CURRENT_TIMER, Map.of()).getObject("data.currentTimer", TimeEntry.class);
    }

    /** One entry by id, or null when absent. */
    public static TimeEntry getTimeEntry(String id) {
        return query(TIME_ENTRY, Map.of("id", id)).getObject("data.timeEntry", TimeEntry.class);
    }

    /** The caller's own entries; {@code period} and {@code search} may be null. */
    public static TimeEntryConnection myTimeEntries(DateRangeInput period, String search, int first) {
        Map<String, Object> variables = new HashMap<>();
        variables.put("first", first);
        if (period != null) {
            variables.put("period", period);
        }
        if (search != null) {
            variables.put("search", search);
        }
        return query(MY_TIME_ENTRIES, variables).getObject("data.myTimeEntries", TimeEntryConnection.class);
    }

    /** Tenant-wide entries narrowed by {@code filter} (employee / organization global ids, period). */
    public static TimeEntryConnection employeeTimeEntries(TimeEntryFilterInput filter, String search, int first) {
        Map<String, Object> variables = new HashMap<>();
        variables.put("first", first);
        if (filter != null) {
            variables.put("filter", filter);
        }
        if (search != null) {
            variables.put("search", search);
        }
        return query(EMPLOYEE_TIME_ENTRIES, variables).getObject("data.employeeTimeEntries", TimeEntryConnection.class);
    }

    public static EmployeeTimeStats employeeTimeStats(TimeEntryFilterInput filter) {
        Map<String, Object> variables = new HashMap<>();
        if (filter != null) {
            variables.put("filter", filter);
        }
        return query(EMPLOYEE_TIME_STATS, variables).getObject("data.employeeTimeStats", EmployeeTimeStats.class);
    }

    // ---- timer ----

    public static TimeEntry startTimer(TimerInput input) {
        return entry(START_TIMER, "startTimer", inputOrEmpty(input));
    }

    /** A start expected to be refused (a timer is already active); returns the GraphQL errors. */
    public static List<GraphqlError> attemptStartTimerErrors(TimerInput input) {
        return errorsOf(START_TIMER, inputOrEmpty(input));
    }

    public static TimeEntry pauseTimer() {
        return entry(PAUSE_TIMER, "pauseTimer", Map.of());
    }

    /** A pause expected to be refused (no active timer); returns the GraphQL errors. */
    public static List<GraphqlError> attemptPauseTimerErrors() {
        return errorsOf(PAUSE_TIMER, Map.of());
    }

    public static TimeEntry resumeTimer() {
        return entry(RESUME_TIMER, "resumeTimer", Map.of());
    }

    public static TimeEntry stopTimer(TimerInput input) {
        return entry(STOP_TIMER, "stopTimer", inputOrEmpty(input));
    }

    /** Discards the active timer; false when there was none. */
    public static boolean cancelTimer() {
        return Boolean.TRUE.equals(query(CANCEL_TIMER, Map.of()).getObject("data.cancelTimer", Boolean.class));
    }

    // ---- manual entries ----

    public static TimeEntry createTimeEntry(CreateTimeEntryInput input) {
        return entry(CREATE_TIME_ENTRY, "createTimeEntry", Map.of("input", input));
    }

    /** A create expected to be refused (no content, non-positive duration); returns the GraphQL errors. */
    public static List<GraphqlError> attemptCreateTimeEntryErrors(CreateTimeEntryInput input) {
        return errorsOf(CREATE_TIME_ENTRY, Map.of("input", input));
    }

    public static TimeEntry updateTimeEntry(UpdateTimeEntryInput input) {
        return entry(UPDATE_TIME_ENTRY, "updateTimeEntry", Map.of("input", input));
    }

    /** An update expected to be refused (running timer); returns the GraphQL errors. */
    public static List<GraphqlError> attemptUpdateTimeEntryErrors(UpdateTimeEntryInput input) {
        return errorsOf(UPDATE_TIME_ENTRY, Map.of("input", input));
    }

    public static TimeEntry unlinkTicket(String id) {
        return entry(UNLINK_TICKET_FROM_TIME_ENTRY, "unlinkTicketFromTimeEntry", Map.of("id", id));
    }

    /** True when the entry existed and was deleted; false for an unknown or already-deleted id. */
    public static boolean deleteTimeEntry(String id) {
        return Boolean.TRUE.equals(query(DELETE_TIME_ENTRY, Map.of("id", id)).getObject("data.deleteTimeEntry", Boolean.class));
    }

    // ---- plumbing ----

    private static Map<String, Object> inputOrEmpty(TimerInput input) {
        return input == null ? Map.of() : Map.of("input", input);
    }

    private static JsonPath query(String document, Map<String, Object> variables) {
        Map<String, Object> body = Map.of("query", document, "variables", variables);
        return given(getAuthorizedSpec())
                .body(body).post(GRAPHQL)
                .then().spec(graphqlSuccess())
                .extract().jsonPath();
    }

    private static TimeEntry entry(String document, String field, Map<String, Object> variables) {
        return query(document, variables).getObject("data." + field, TimeEntry.class);
    }

    /**
     * Sends a document without the success spec and returns its top-level GraphQL errors (never
     * null). A non-200 answer is a contract violation in its own right — GraphQL reports rejections
     * as 200 + errors — so it fails with the status and the body instead of a bare status mismatch.
     */
    private static List<GraphqlError> errorsOf(String document, Map<String, Object> variables) {
        Map<String, Object> body = Map.of("query", document, "variables", variables);
        Response response = given(getAuthorizedSpec()).body(body).post(GRAPHQL);
        if (response.statusCode() != 200) {
            String operation = document.lines().findFirst().orElse("").trim();
            throw new AssertionError("api/graphql answered HTTP " + response.statusCode() + " to \"" + operation
                    + "\" instead of 200 with a GraphQL error; body: "
                    + response.asString().replaceAll("\\s+", " ").strip());
        }
        List<GraphqlError> errors = response.jsonPath().getList("errors", GraphqlError.class);
        return errors == null ? List.of() : errors;
    }
}
