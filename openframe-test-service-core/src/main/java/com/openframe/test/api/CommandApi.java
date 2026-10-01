package com.openframe.test.api;

import com.openframe.test.data.dto.command.BatchRunCommandInput;
import com.openframe.test.data.dto.command.RunCommandInput;
import com.openframe.test.data.dto.shared.GraphqlError;

import java.util.List;
import java.util.Map;

import static com.openframe.test.api.graphql.CommandQueries.BATCH_RUN_COMMAND;
import static com.openframe.test.api.graphql.CommandQueries.CANCEL_EXECUTION;
import static com.openframe.test.api.graphql.CommandQueries.RUN_COMMAND;
import static com.openframe.test.config.EnvironmentConfig.GRAPHQL;
import static com.openframe.test.helpers.RequestSpecHelper.getAuthorizedSpec;
import static com.openframe.test.helpers.RequestSpecHelper.graphqlSuccess;
import static io.restassured.RestAssured.given;

// Ad-hoc command dispatch (command.graphqls): fire-and-forget over NATS, each call answers with an executionId.
public class CommandApi {

    public static String runCommand(RunCommandInput input) {
        return dispatch(RUN_COMMAND, "runCommand", Map.of("input", input));
    }

    public static String batchRunCommand(BatchRunCommandInput input) {
        return dispatch(BATCH_RUN_COMMAND, "batchRunCommand", Map.of("input", input));
    }

    // Asks the machine's agent to stop an in-flight execution; the answer echoes the executionId.
    public static String cancelExecution(String machineId, String executionId) {
        return dispatch(CANCEL_EXECUTION, "cancelExecution",
                Map.of("input", Map.of("machineId", machineId, "executionId", executionId)));
    }

    // A dispatch expected to be refused; returns the top-level GraphQL errors, empty when it was accepted.
    public static List<GraphqlError> attemptRunCommandErrors(RunCommandInput input) {
        return errorsOf(RUN_COMMAND, Map.of("input", input));
    }

    public static List<GraphqlError> attemptBatchRunCommandErrors(BatchRunCommandInput input) {
        return errorsOf(BATCH_RUN_COMMAND, Map.of("input", input));
    }

    private static String dispatch(String document, String field, Map<String, Object> variables) {
        return given(getAuthorizedSpec())
                .body(Map.of("query", document, "variables", variables))
                .post(GRAPHQL)
                .then().spec(graphqlSuccess())
                .extract().jsonPath().getString("data." + field + ".executionId");
    }

    private static List<GraphqlError> errorsOf(String document, Map<String, Object> variables) {
        List<GraphqlError> errors = given(getAuthorizedSpec())
                .body(Map.of("query", document, "variables", variables))
                .post(GRAPHQL)
                .then().statusCode(200)
                .extract().jsonPath().getList("errors", GraphqlError.class);
        return errors == null ? List.of() : errors;
    }
}
