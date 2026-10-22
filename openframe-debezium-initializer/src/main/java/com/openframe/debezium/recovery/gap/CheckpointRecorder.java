package com.openframe.debezium.recovery.gap;

import com.openframe.data.document.connector.ConnectorCheckpoint;
import com.openframe.data.repository.connector.ConnectorCheckpointRepository;
import com.openframe.debezium.dto.ConnectorOffsets;
import com.openframe.debezium.dto.ConnectorStatus;
import com.openframe.debezium.naming.ConnectorNameStrategy;
import com.openframe.debezium.service.DebeziumService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.List;

@Slf4j
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(name = "openframe.debezium.recovery.gap.enabled", havingValue = "true")
public class CheckpointRecorder {

    private final DebeziumService debeziumService;
    private final ConnectorCheckpointRepository checkpointRepository;
    private final ConnectorNameStrategy nameStrategy;

    public void recordAll() {
        List<String> connectors = debeziumService.listConnectors();
        connectors.forEach(this::recordSafely);
    }

    private void recordSafely(String connectorName) {
        try {
            record(connectorName);
        } catch (Exception e) {
            log.warn("Failed to record checkpoint for connector '{}'", connectorName, e);
        }
    }

    private void record(String connectorName) {
        ConnectorStatus status = debeziumService.getConnectorStatus(connectorName);
        if (status == null || !status.isRunning()) return;
        ConnectorOffsets offsets = debeziumService.getConnectorOffsets(connectorName);
        if (offsets.isEmpty()) return;
        ConnectorCheckpoint checkpoint = ConnectorCheckpoint.builder()
                .baseName(nameStrategy.extractBaseName(connectorName))
                .connectorName(connectorName)
                .offsets(offsets.getOffsets())
                .capturedAt(Instant.now())
                .build();
        checkpointRepository.save(checkpoint);
    }
}
