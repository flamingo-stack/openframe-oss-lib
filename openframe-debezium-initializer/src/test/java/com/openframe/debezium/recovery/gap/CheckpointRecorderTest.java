package com.openframe.debezium.recovery.gap;

import com.openframe.data.document.connector.ConnectorCheckpoint;
import com.openframe.data.repository.connector.ConnectorCheckpointRepository;
import com.openframe.debezium.dto.ConnectorOffsets;
import com.openframe.debezium.dto.ConnectorStatus;
import com.openframe.debezium.naming.VersionedConnectorNameStrategy;
import com.openframe.debezium.service.DebeziumService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Captor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

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

    @Mock private DebeziumService debeziumService;
    @Mock private ConnectorCheckpointRepository checkpointRepository;

    @Captor private ArgumentCaptor<ConnectorCheckpoint> checkpointCaptor;

    private CheckpointRecorder recorder;
    private ConnectorOffsets offsets;

    @BeforeEach
    void setUp() {
        recorder = new CheckpointRecorder(debeziumService, checkpointRepository, new VersionedConnectorNameStrategy());
        Map<String, Object> entry = Map.of("partition", Map.of("server_id", "shared.meshcentral"), "offset", Map.of("sec", 7L));
        offsets = new ConnectorOffsets(List.of(entry));
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
