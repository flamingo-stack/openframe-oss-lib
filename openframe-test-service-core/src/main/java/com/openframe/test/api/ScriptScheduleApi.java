package com.openframe.test.api;

import com.openframe.test.data.dto.schedule.CreateScriptScheduleInput;
import com.openframe.test.data.dto.schedule.ScriptSchedule;
import com.openframe.test.data.dto.schedule.ScriptScheduleConnection;
import com.openframe.test.data.dto.schedule.ScriptScheduleFilterInput;
import com.openframe.test.data.dto.schedule.ScriptScheduleFilters;
import com.openframe.test.data.dto.schedule.UpdateScriptScheduleInput;
import com.openframe.test.data.dto.shared.GraphqlError;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static com.openframe.test.api.graphql.ScriptScheduleQueries.ARCHIVE_SCRIPT_SCHEDULE;
import static com.openframe.test.api.graphql.ScriptScheduleQueries.CREATE_SCRIPT_SCHEDULE;
import static com.openframe.test.api.graphql.ScriptScheduleQueries.DELETE_SCRIPT_SCHEDULE;
import static com.openframe.test.api.graphql.ScriptScheduleQueries.GET_SCRIPT_SCHEDULE;
import static com.openframe.test.api.graphql.ScriptScheduleQueries.SCRIPT_SCHEDULES;
import static com.openframe.test.api.graphql.ScriptScheduleQueries.SCRIPT_SCHEDULE_FILTERS;
import static com.openframe.test.api.graphql.ScriptScheduleQueries.UNARCHIVE_SCRIPT_SCHEDULE;
import static com.openframe.test.api.graphql.ScriptScheduleQueries.UPDATE_SCRIPT_SCHEDULE;
import static com.openframe.test.config.EnvironmentConfig.GRAPHQL;
import static com.openframe.test.helpers.RequestSpecHelper.getAuthorizedSpec;
import static com.openframe.test.helpers.RequestSpecHelper.graphqlSuccess;
import static io.restassured.RestAssured.given;

/**
 * Client for the script-schedule GraphQL API ({@code scriptSchedule}, {@code scriptSchedules},
 * {@code scriptScheduleFilters} and the create/update/archive/unarchive/delete mutations).
 * Device assignment mutations are not here yet (plan item CP-2).
 */
public class ScriptScheduleApi {

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
        Map<String, Object> body = Map.of(
                "query", CREATE_SCRIPT_SCHEDULE,
                "variables", Map.of("input", input)
        );
        List<GraphqlError> errors = given(getAuthorizedSpec())
                .body(body).post(GRAPHQL)
                .then().statusCode(200)
                .extract().jsonPath().getList("errors", GraphqlError.class);
        return errors == null ? List.of() : errors;
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
}
