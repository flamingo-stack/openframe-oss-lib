package com.openframe.debezium.recovery.gap;

import com.openframe.data.document.connector.ConnectorCheckpoint;
import com.openframe.data.repository.connector.ConnectorCheckpointRepository;
import com.openframe.debezium.dto.ConnectorOffsets;
import com.openframe.debezium.dto.ConnectorStatus;
import com.openframe.debezium.naming.ConnectorNameStrategy;
import com.openframe.debezium.service.DebeziumService;
import com.openframe.debezium.util.DebeziumLog;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

@Slf4j
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(name = "openframe.debezium.recovery.gap.enabled", havingValue = "true")
public class CheckpointRecorder {

    private final DebeziumService debeziumService;
    private final ConnectorCheckpointRepository checkpointRepository;
    private final ConnectorNameStrategy nameStrategy;
    // A handover keeps the new version STOPPED for seconds, so only a version stopped on two ticks in a row is stuck.
    private final Set<String> stoppedOnLastTick = new HashSet<>();

    public void recordAll() {
        List<String> connectors = debeziumService.listConnectors();
        Set<String> stoppedNow = new HashSet<>();
        connectors.forEach(connectorName -> recordSafely(connectorName, connectors, stoppedNow));
        stoppedOnLastTick.clear();
        stoppedOnLastTick.addAll(stoppedNow);
    }

    private void recordSafely(String connectorName, List<String> connectors, Set<String> stoppedNow) {
        try {
            record(connectorName, connectors, stoppedNow);
        } catch (Exception e) {
            log.warn("Failed to record checkpoint for connector '{}'", connectorName, e);
        }
    }

    private void record(String connectorName, List<String> connectors, Set<String> stoppedNow) {
        ConnectorStatus status = debeziumService.getConnectorStatus(connectorName);
        if (status == null) return;
        if (status.isStopped()) {
            trackStopped(connectorName, connectors, stoppedNow);
            return;
        }
        if (!status.isRunning()) return;
        ConnectorOffsets offsets = debeziumService.getConnectorOffsets(connectorName);
        if (offsets.isEmpty()) return;
        String baseName = nameStrategy.extractBaseName(connectorName);
        List<Map<String, Object>> offsetEntries = offsets.getOffsets();
        Instant capturedAt = Instant.now();
        ConnectorCheckpoint checkpoint = ConnectorCheckpoint.builder()
                .baseName(baseName)
                .connectorName(connectorName)
                .offsets(offsetEntries)
                .capturedAt(capturedAt)
                .build();
        checkpointRepository.save(checkpoint);
    }

    // Older versions stay STOPPED briefly after a drift recreate until they are deleted; only the current one carries CDC.
    private void trackStopped(String connectorName, List<String> connectors, Set<String> stoppedNow) {
        String baseName = nameStrategy.extractBaseName(connectorName);
        boolean current = nameStrategy.currentVersion(baseName, connectors)
                .filter(connectorName::equals)
                .isPresent();
        if (!current) return;
        stoppedNow.add(connectorName);
        if (stoppedOnLastTick.contains(connectorName)) {
            log.error("{} Connector left STOPPED, CDC for its base is paused; resume or delete it: name='{}'",
                    DebeziumLog.PREFIX, connectorName);
        }
    }
}
