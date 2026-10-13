package com.openframe.debezium.dto;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class ConnectorStatusTest {

    @ParameterizedTest
    @CsvSource({
            "RUNNING, RUNNING,    true",
            "RUNNING, FAILED,     false",
            "PAUSED,  RUNNING,    false",
            "RUNNING, UNASSIGNED, false"
    })
    void isRunning_byConnectorAndTaskState_runningOnlyWhenBoth(String connectorState, String taskState, boolean expected) {
        // setup
        ConnectorStatus status = status(connectorState, List.of(task(taskState)));

        // execution
        boolean running = status.isRunning();

        // verifications
        assertThat(running).isEqualTo(expected);
    }

    @Test
    void isRunning_runningConnectorWithNullTasks_false() {
        // setup
        ConnectorStatus status = status("RUNNING", null);

        // execution
        boolean running = status.isRunning();

        // verifications
        assertThat(running).isFalse();
    }

    @Test
    void isRunning_runningConnectorWithNoTasks_false() {
        // setup
        ConnectorStatus status = status("RUNNING", List.of());

        // execution
        boolean running = status.isRunning();

        // verifications
        assertThat(running).isFalse();
    }

    private static ConnectorStatus status(String connectorState, List<ConnectorStatus.TaskStatus> tasks) {
        ConnectorStatus.Connector connector = new ConnectorStatus.Connector();
        connector.setState(connectorState);
        ConnectorStatus status = new ConnectorStatus();
        status.setConnector(connector);
        status.setTasks(tasks);
        return status;
    }

    private static ConnectorStatus.TaskStatus task(String state) {
        ConnectorStatus.TaskStatus task = new ConnectorStatus.TaskStatus();
        task.setState(state);
        return task;
    }
}
