package com.openframe.test.api.graphql;

public class CommandQueries {

    public static final String RUN_COMMAND = """
            mutation RunCommand($input: RunCommandInput!) {
                runCommand(input: $input) { executionId }
            }
            """;

    public static final String BATCH_RUN_COMMAND = """
            mutation BatchRunCommand($input: BatchRunCommandInput!) {
                batchRunCommand(input: $input) { executionId }
            }
            """;

    public static final String CANCEL_EXECUTION = """
            mutation CancelExecution($input: CancelExecutionInput!) {
                cancelExecution(input: $input) { executionId }
            }
            """;
}
