package com.openframe.debezium.recovery.gap;

import com.openframe.data.document.connector.ConnectorCheckpoint;
import com.openframe.data.repository.connector.ConnectorCheckpointRepository;
import com.openframe.debezium.dto.ConnectorOffsets;
import com.openframe.debezium.dto.ConnectorStatus;
import com.openframe.debezium.naming.VersionedConnectorNameStrategy;
import com.openframe.debezium.service.DebeziumService;
import ch.qos.logback.classic.Logger;
import ch.qos.logback.classic.spi.ILoggingEvent;
import ch.qos.logback.core.read.ListAppender;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Captor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.slf4j.LoggerFactory;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class CheckpointRecorderTest {

    private static final String BASE = "shared-meshcentral-mongo-connector";
    private static final String NAME = BASE + "_v3";
    private static final String OTHER = "shared-fleet-mysql-connector_v1";
    private static final String OLDER = BASE + "_v2";
    private static final String LEFT_STOPPED = "[DEBEZIUM] Connector left STOPPED";

    @Mock private DebeziumService debeziumService;
    @Mock private ConnectorCheckpointRepository checkpointRepository;

    @Captor private ArgumentCaptor<ConnectorCheckpoint> checkpointCaptor;

    private CheckpointRecorder recorder;
    private ConnectorOffsets offsets;
    private ListAppender<ILoggingEvent> logs;

    @BeforeEach
    void setUp() {
        recorder = new CheckpointRecorder(debeziumService, checkpointRepository, new VersionedConnectorNameStrategy());
        Map<String, Object> entry = Map.of("partition", Map.of("server_id", "shared.meshcentral"), "offset", Map.of("sec", 7L));
        offsets = new ConnectorOffsets(List.of(entry));
        logs = new ListAppender<>();
        logs.start();
        recorderLogger().addAppender(logs);
    }

    @AfterEach
    void tearDown() {
        recorderLogger().detachAppender(logs);
    }

    @Test
    void recordAll_currentVersionStoppedOnTwoTicks_leftStoppedLoggedOnSecond() {
        // setup
        when(debeziumService.listConnectors()).thenReturn(List.of(NAME));
        when(debeziumService.getConnectorStatus(NAME)).thenReturn(stoppedStatus());

        // execution
        recorder.recordAll();
        long afterFirstTick = leftStoppedLines(NAME);
        recorder.recordAll();

        // verifications
        assertThat(afterFirstTick).isZero();
        assertThat(leftStoppedLines(NAME)).isEqualTo(1);
        verify(checkpointRepository, never()).save(any(ConnectorCheckpoint.class));
    }

    @Test
    void recordAll_currentVersionStoppedThenRunning_noLeftStoppedLine() {
        // setup
        when(debeziumService.listConnectors()).thenReturn(List.of(NAME));
        when(debeziumService.getConnectorStatus(NAME)).thenReturn(stoppedStatus(), status("RUNNING"), stoppedStatus());
        when(debeziumService.getConnectorOffsets(NAME)).thenReturn(offsets);

        // execution
        recorder.recordAll();
        recorder.recordAll();
        recorder.recordAll();

        // verifications
        assertThat(leftStoppedLines(NAME)).isZero();
    }

    @Test
    void recordAll_olderVersionStoppedOnTwoTicks_noLeftStoppedLine() {
        // setup
        when(debeziumService.listConnectors()).thenReturn(List.of(OLDER, NAME));
        when(debeziumService.getConnectorStatus(OLDER)).thenReturn(stoppedStatus());
        when(debeziumService.getConnectorStatus(NAME)).thenReturn(status("RUNNING"));
        when(debeziumService.getConnectorOffsets(NAME)).thenReturn(offsets);

        // execution
        recorder.recordAll();
        recorder.recordAll();

        // verifications
        assertThat(leftStoppedLines(OLDER)).isZero();
    }

    @Test
    void recordAll_runningConnectorWithOffsets_checkpointSavedUnderBaseName() {
        // setup
        when(debeziumService.listConnectors()).thenReturn(List.of(NAME));
        when(debeziumService.getConnectorStatus(NAME)).thenReturn(status("RUNNING"));
        when(debeziumService.getConnectorOffsets(NAME)).thenReturn(offsets);

        // execution
        recorder.recordAll();

        // verifications
        verify(checkpointRepository).save(checkpointCaptor.capture());
        assertThat(checkpointCaptor.getValue())
                .extracting(ConnectorCheckpoint::getBaseName, ConnectorCheckpoint::getConnectorName, ConnectorCheckpoint::getOffsets)
                .containsExactly(BASE, NAME, offsets.getOffsets());
    }

    @Test
    void recordAll_failedConnector_previousCheckpointKept() {
        // setup
        when(debeziumService.listConnectors()).thenReturn(List.of(NAME));
        when(debeziumService.getConnectorStatus(NAME)).thenReturn(status("FAILED"));

        // execution
        recorder.recordAll();

        // verifications
        verify(debeziumService, never()).getConnectorOffsets(NAME);
        verify(checkpointRepository, never()).save(any(ConnectorCheckpoint.class));
    }

    @Test
    void recordAll_connectorWithoutStatus_skipped() {
        // setup
        when(debeziumService.listConnectors()).thenReturn(List.of(NAME));
        when(debeziumService.getConnectorStatus(NAME)).thenReturn(null);

        // execution
        recorder.recordAll();

        // verifications
        verify(checkpointRepository, never()).save(any(ConnectorCheckpoint.class));
    }

    @Test
    void recordAll_runningConnectorWithoutOffsets_skipped() {
        // setup
        when(debeziumService.listConnectors()).thenReturn(List.of(NAME));
        when(debeziumService.getConnectorStatus(NAME)).thenReturn(status("RUNNING"));
        when(debeziumService.getConnectorOffsets(NAME)).thenReturn(ConnectorOffsets.empty());

        // execution
        recorder.recordAll();

        // verifications
        verify(checkpointRepository, never()).save(any(ConnectorCheckpoint.class));
    }

    @Test
    void recordAll_oneConnectorThrows_othersStillRecorded() {
        // setup
        when(debeziumService.listConnectors()).thenReturn(List.of(NAME, OTHER));
        doThrow(new IllegalStateException("status unavailable")).when(debeziumService).getConnectorStatus(NAME);
        when(debeziumService.getConnectorStatus(OTHER)).thenReturn(status("RUNNING"));
        when(debeziumService.getConnectorOffsets(OTHER)).thenReturn(offsets);

        // execution
        recorder.recordAll();

        // verifications
        verify(checkpointRepository).save(checkpointCaptor.capture());
        assertThat(checkpointCaptor.getValue().getConnectorName()).isEqualTo(OTHER);
    }

    private long leftStoppedLines(String connectorName) {
        return logs.list.stream()
                .map(ILoggingEvent::getFormattedMessage)
                .filter(message -> message.contains(LEFT_STOPPED) && message.contains(connectorName))
                .count();
    }

    private static Logger recorderLogger() {
        return (Logger) LoggerFactory.getLogger(CheckpointRecorder.class);
    }

    private static ConnectorStatus stoppedStatus() {
        ConnectorStatus.Connector connector = new ConnectorStatus.Connector();
        connector.setState("STOPPED");
        ConnectorStatus status = new ConnectorStatus();
        status.setConnector(connector);
        status.setTasks(List.of());
        return status;
    }

    private static ConnectorStatus status(String state) {
        ConnectorStatus.Connector connector = new ConnectorStatus.Connector();
        connector.setState(state);
        ConnectorStatus.TaskStatus task = new ConnectorStatus.TaskStatus();
        task.setState(state);
        ConnectorStatus status = new ConnectorStatus();
        status.setConnector(connector);
        status.setTasks(List.of(task));
        return status;
    }
}
