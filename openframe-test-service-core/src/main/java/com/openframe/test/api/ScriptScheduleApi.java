package com.openframe.test.api;

import com.openframe.test.data.dto.device.DeviceFilterInput;
import com.openframe.test.data.dto.execution.ScheduleRunConnection;
import com.openframe.test.data.dto.execution.ScheduleRunFilters;
import com.openframe.test.data.dto.execution.ScriptExecutionConnection;
import com.openframe.test.data.dto.execution.ScriptExecutionFilters;
import com.openframe.test.data.dto.schedule.CreateScriptScheduleInput;
import com.openframe.test.data.dto.schedule.ScheduleDeviceCriteriaInput;
import com.openframe.test.data.dto.schedule.ScheduleDevices;
import com.openframe.test.data.dto.schedule.ScriptSchedule;
import com.openframe.test.data.dto.schedule.ScriptScheduleConnection;
import com.openframe.test.data.dto.schedule.ScriptScheduleFilterInput;
import com.openframe.test.data.dto.schedule.ScriptScheduleFilters;
import com.openframe.test.data.dto.schedule.UpdateScriptScheduleInput;
import com.openframe.test.data.dto.shared.GraphqlError;
import io.restassured.path.json.JsonPath;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static com.openframe.test.api.graphql.ScriptScheduleQueries.ADD_ALL_DEVICES_TO_SCHEDULE;
import static com.openframe.test.api.graphql.ScriptScheduleQueries.SCHEDULE_EXECUTIONS;
import static com.openframe.test.api.graphql.ScriptScheduleQueries.SCHEDULE_EXECUTION_FILTERS;
import static com.openframe.test.api.graphql.ScriptScheduleQueries.SCHEDULE_RUNS;
import static com.openframe.test.api.graphql.ScriptScheduleQueries.SCHEDULE_RUN_FILTERS;
import static com.openframe.test.api.graphql.ScriptScheduleQueries.ADD_DEVICES_TO_SCHEDULE;
import static com.openframe.test.api.graphql.ScriptScheduleQueries.ARCHIVE_SCRIPT_SCHEDULE;
import static com.openframe.test.api.graphql.ScriptScheduleQueries.CREATE_SCRIPT_SCHEDULE;
import static com.openframe.test.api.graphql.ScriptScheduleQueries.DELETE_SCRIPT_SCHEDULE;
import static com.openframe.test.api.graphql.ScriptScheduleQueries.GET_SCHEDULE_DEVICES;
import static com.openframe.test.api.graphql.ScriptScheduleQueries.GET_SCRIPT_SCHEDULE;
import static com.openframe.test.api.graphql.ScriptScheduleQueries.REMOVE_ALL_DEVICES_FROM_SCHEDULE;
import static com.openframe.test.api.graphql.ScriptScheduleQueries.REMOVE_DEVICES_FROM_SCHEDULE;
import static com.openframe.test.api.graphql.ScriptScheduleQueries.SCRIPT_SCHEDULES;
import static com.openframe.test.api.graphql.ScriptScheduleQueries.SCRIPT_SCHEDULE_FILTERS;
import static com.openframe.test.api.graphql.ScriptScheduleQueries.SET_SCHEDULE_DEVICE_CRITERIA;
import static com.openframe.test.api.graphql.ScriptScheduleQueries.SET_SCRIPT_SCHEDULE_DEVICES;
import static com.openframe.test.api.graphql.ScriptScheduleQueries.UNARCHIVE_SCRIPT_SCHEDULE;
import static com.openframe.test.api.graphql.ScriptScheduleQueries.UPDATE_SCRIPT_SCHEDULE;
import static com.openframe.test.config.EnvironmentConfig.GRAPHQL;
import static com.openframe.test.helpers.RequestSpecHelper.getAuthorizedSpec;
import static com.openframe.test.helpers.RequestSpecHelper.graphqlSuccess;
import static io.restassured.RestAssured.given;

/**
 * Client for the script-schedule GraphQL API: {@code scriptSchedule}, {@code scriptSchedules},
 * {@code scriptScheduleFilters}, the create/update/archive/unarchive/delete mutations, and the
 * device-targeting mutations plus the two device pickers.
 */
public class ScriptScheduleApi {

    // ---- device targeting ----

    /** The DEVICES count, selection mode and rule, and both pickers narrowed by a hostname search. */
    public static ScheduleDevices getScheduleDevices(String scheduleId, String search, int first) {
        Map<String, Object> variables = new HashMap<>();
        variables.put("id", scheduleId);
        variables.put("first", first);
        if (search != null) {
            variables.put("search", search);
        }
        Map<String, Object> body = Map.of(
                "query", GET_SCHEDULE_DEVICES,
                "variables", variables
        );
        return given(getAuthorizedSpec())
                .body(body).post(GRAPHQL)
                .then().spec(graphqlSuccess())
                .extract().jsonPath().getObject("data.scriptSchedule", ScheduleDevices.class);
    }

    /** Incremental assign; already-assigned devices are skipped. {@code machineIds} are Machine global ids. */
    public static ScriptSchedule addDevices(String scheduleId, List<String> machineIds) {
        return scheduleMutation(ADD_DEVICES_TO_SCHEDULE, "addDevicesToSchedule",
                Map.of("scheduleId", scheduleId, "machineIds", machineIds));
    }

    /**
     * An assign that is expected to be rejected (a device whose OS the schedule does not support);
     * returns the top-level GraphQL errors, empty when the server accepted it.
     */
    public static List<GraphqlError> attemptAddDevicesErrors(String scheduleId, List<String> machineIds) {
        return errorsOf(ADD_DEVICES_TO_SCHEDULE, Map.of("scheduleId", scheduleId, "machineIds", machineIds));
    }

    /** Incremental unassign; missing ids are no-ops. */
    public static ScriptSchedule removeDevices(String scheduleId, List<String> machineIds) {
        return scheduleMutation(REMOVE_DEVICES_FROM_SCHEDULE, "removeDevicesFromSchedule",
                Map.of("scheduleId", scheduleId, "machineIds", machineIds));
    }

    /** Assigns every device matching the filter/search, scoped to the schedule's platforms. */
    public static ScriptSchedule addAllDevices(String scheduleId, DeviceFilterInput filter, String search) {
        return scheduleMutation(ADD_ALL_DEVICES_TO_SCHEDULE, "addAllDevicesToSchedule",
                deviceSelection(scheduleId, filter, search));
    }

    /** Unassigns every assigned device matching the filter/search; with neither, clears the assignment. */
    public static ScriptSchedule removeAllDevices(String scheduleId, DeviceFilterInput filter, String search) {
        return scheduleMutation(REMOVE_ALL_DEVICES_FROM_SCHEDULE, "removeAllDevicesFromSchedule",
                deviceSelection(scheduleId, filter, search));
    }

    /** PUT semantics: the given set replaces the whole assignment ("Edit Devices"). */
    public static ScriptSchedule setDevices(String scheduleId, List<String> machineIds) {
        return scheduleMutation(SET_SCRIPT_SCHEDULE_DEVICES, "setScriptScheduleDevices",
                Map.of("scheduleId", scheduleId, "machineIds", machineIds));
    }

    /** Switches the schedule to CRITERIA selection and stores the rule. */
    public static ScriptSchedule setDeviceCriteria(String scheduleId, ScheduleDeviceCriteriaInput criteria) {
        return scheduleMutation(SET_SCHEDULE_DEVICE_CRITERIA, "setScheduleDeviceCriteria",
                Map.of("scheduleId", scheduleId, "criteria", criteria));
    }

    private static Map<String, Object> deviceSelection(String scheduleId, DeviceFilterInput filter, String search) {
        Map<String, Object> variables = new HashMap<>();
        variables.put("scheduleId", scheduleId);
        if (filter != null) {
            variables.put("filter", filter);
        }
        if (search != null) {
            variables.put("search", search);
        }
        return variables;
    }

    private static ScriptSchedule scheduleMutation(String document, String field, Map<String, Object> variables) {
        Map<String, Object> body = Map.of("query", document, "variables", variables);
        return given(getAuthorizedSpec())
                .body(body).post(GRAPHQL)
                .then().spec(graphqlSuccess())
                .extract().jsonPath().getObject("data." + field, ScriptSchedule.class);
    }

    /** Sends a document without the success spec and returns its top-level GraphQL errors (never null). */
    private static List<GraphqlError> errorsOf(String document, Map<String, Object> variables) {
        Map<String, Object> body = Map.of("query", document, "variables", variables);
        List<GraphqlError> errors = given(getAuthorizedSpec())
                .body(body).post(GRAPHQL)
                .then().statusCode(200)
                .extract().jsonPath().getList("errors", GraphqlError.class);
        return errors == null ? List.of() : errors;
    }

    // ---- lifecycle ----

    public static ScriptSchedule getSchedule(String id) {
        Map<String, Object> body = Map.of(
                "query", GET_SCRIPT_SCHEDULE,
                "variables", Map.of("id", id)
        );
        return given(getAuthorizedSpec())
                .body(body).post(GRAPHQL)
                .then().spec(graphqlSuccess())
                .extract().jsonPath().getObject("data.scriptSchedule", ScriptSchedule.class);
    }

    /**
     * First page of schedules. {@code filter} and {@code search} may be null; a null filter hides
     * DELETED schedules and returns every other status (the schema default).
     */
    public static ScriptScheduleConnection listSchedules(ScriptScheduleFilterInput filter, String search, int first) {
        Map<String, Object> variables = new HashMap<>();
        variables.put("first", first);
        if (filter != null) {
            variables.put("filter", filter);
        }
        if (search != null) {
            variables.put("search", search);
        }
        Map<String, Object> body = Map.of(
                "query", SCRIPT_SCHEDULES,
                "variables", variables
        );
        return given(getAuthorizedSpec())
                .body(body).post(GRAPHQL)
                .then().spec(graphqlSuccess())
                .extract().jsonPath().getObject("data.scriptSchedules", ScriptScheduleConnection.class);
    }

    public static ScriptScheduleFilters getFilters(ScriptScheduleFilterInput filter) {
        Map<String, Object> variables = new HashMap<>();
        if (filter != null) {
            variables.put("filter", filter);
        }
        Map<String, Object> body = Map.of(
                "query", SCRIPT_SCHEDULE_FILTERS,
                "variables", variables
        );
        return given(getAuthorizedSpec())
                .body(body).post(GRAPHQL)
                .then().spec(graphqlSuccess())
                .extract().jsonPath().getObject("data.scriptScheduleFilters", ScriptScheduleFilters.class);
    }

    public static ScriptSchedule createSchedule(CreateScriptScheduleInput input) {
        Map<String, Object> body = Map.of(
                "query", CREATE_SCRIPT_SCHEDULE,
                "variables", Map.of("input", input)
        );
        return given(getAuthorizedSpec())
                .body(body).post(GRAPHQL)
                .then().spec(graphqlSuccess())
                .extract().jsonPath().getObject("data.createScriptSchedule", ScriptSchedule.class);
    }

    /**
     * Sends a create that is expected to be rejected and returns the top-level GraphQL errors
     * (empty when the server accepted it). The schema rejects a {@code startAt} off the 30-minute
     * grid, a {@code startAt} on a DEVICE_ONLINE schedule and a {@code repeat} that is not a whole
     * number of 30-minute slots as GraphQL errors, not {@code userErrors}, so this does not use the
     * {@code graphqlSuccess()} spec.
     */
    public static List<GraphqlError> attemptCreateScheduleErrors(CreateScriptScheduleInput input) {
        return errorsOf(CREATE_SCRIPT_SCHEDULE, Map.of("input", input));
    }

    public static ScriptSchedule updateSchedule(UpdateScriptScheduleInput input) {
        Map<String, Object> body = Map.of(
                "query", UPDATE_SCRIPT_SCHEDULE,
                "variables", Map.of("input", input)
        );
        return given(getAuthorizedSpec())
                .body(body).post(GRAPHQL)
                .then().spec(graphqlSuccess())
                .extract().jsonPath().getObject("data.updateScriptSchedule", ScriptSchedule.class);
    }

    public static ScriptSchedule archiveSchedule(String id) {
        Map<String, Object> body = Map.of(
                "query", ARCHIVE_SCRIPT_SCHEDULE,
                "variables", Map.of("id", id)
        );
        return given(getAuthorizedSpec())
                .body(body).post(GRAPHQL)
                .then().spec(graphqlSuccess())
                .extract().jsonPath().getObject("data.archiveScriptSchedule", ScriptSchedule.class);
    }

    public static ScriptSchedule unarchiveSchedule(String id) {
        Map<String, Object> body = Map.of(
                "query", UNARCHIVE_SCRIPT_SCHEDULE,
                "variables", Map.of("id", id)
        );
        return given(getAuthorizedSpec())
                .body(body).post(GRAPHQL)
                .then().spec(graphqlSuccess())
                .extract().jsonPath().getObject("data.unarchiveScriptSchedule", ScriptSchedule.class);
    }

    /** Soft-deletes the schedule and returns its id. Idempotent on an already-deleted schedule. */
    public static String deleteSchedule(String id) {
        Map<String, Object> body = Map.of(
                "query", DELETE_SCRIPT_SCHEDULE,
                "variables", Map.of("id", id)
        );
        return given(getAuthorizedSpec())
                .body(body).post(GRAPHQL)
                .then().spec(graphqlSuccess())
                .extract().jsonPath().getString("data.deleteScriptSchedule");
    }

    // ---- execution history and runs of a schedule (plan item CP-17) ----
    //
    // Each read holds the response in a named local before taking a field out of it, so a failure
    // says which step produced nothing.

    /** Every execution this schedule has dispatched, newest first. */
    public static ScriptExecutionConnection getScheduleExecutions(String scheduleId, int first) {
        return object(SCHEDULE_EXECUTIONS, "scheduleExecutions",
                Map.of("scheduleId", scheduleId, "first", first), ScriptExecutionConnection.class);
    }

    /** The facet block beside that list: initiators, statuses and machines. */
    public static ScriptExecutionFilters getScheduleExecutionFilters(String scheduleId) {
        return object(SCHEDULE_EXECUTION_FILTERS, "scheduleExecutionFilters",
                Map.of("scheduleId", scheduleId), ScriptExecutionFilters.class);
    }

    /** A run is one firing of the schedule across its devices; executions are its per-device legs. */
    public static ScheduleRunConnection getScheduleRuns(String scheduleId, int first) {
        return object(SCHEDULE_RUNS, "scheduleRuns",
                Map.of("scheduleId", scheduleId, "first", first), ScheduleRunConnection.class);
    }

    public static ScheduleRunFilters getScheduleRunFilters(String scheduleId) {
        return object(SCHEDULE_RUN_FILTERS, "scheduleRunFilters",
                Map.of("scheduleId", scheduleId), ScheduleRunFilters.class);
    }

    private static <T> T object(String document, String field, Map<String, Object> variables, Class<T> type) {
        Map<String, Object> body = Map.of("query", document, "variables", variables);
        JsonPath response = given(getAuthorizedSpec())
                .body(body).post(GRAPHQL)
                .then().spec(graphqlSuccess())
                .extract().jsonPath();
        return response.getObject("data." + field, type);
    }
}
