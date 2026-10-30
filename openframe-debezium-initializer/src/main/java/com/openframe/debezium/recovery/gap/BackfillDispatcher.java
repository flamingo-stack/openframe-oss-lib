package com.openframe.debezium.recovery.gap;

import com.openframe.data.document.connector.ConnectorBackfill;
import com.openframe.data.document.connector.ConnectorBackfillStatus;
import com.openframe.data.repository.connector.ConnectorBackfillRepository;
import com.openframe.debezium.dto.ConnectorStatus;
import com.openframe.debezium.naming.ConnectorNameStrategy;
import com.openframe.debezium.service.DebeziumService;
import com.openframe.debezium.util.ConnectorSpecs;
import com.openframe.debezium.util.DebeziumLog;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.List;
import java.util.Map;

@Slf4j
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(name = "openframe.debezium.recovery.gap.enabled", havingValue = "true")
public class BackfillDispatcher {

    private final ConnectorBackfillRepository backfillRepository;
    private final DebeziumService debeziumService;
    private final ConnectorNameStrategy nameStrategy;
    private final ToolConnectorSpecs toolConnectorSpecs;
    private final SourceDialects sourceDialects;
    private final SnapshotSignalPublisher signalPublisher;
    private final GapRecoveryProperties properties;
    private final UnfilledGapAlerts gapAlerts;

    public void dispatchPending() {
        List<ConnectorBackfill> pending = backfillRepository.findByStatus(ConnectorBackfillStatus.PENDING);
        if (pending.isEmpty()) return;
        List<String> connectors = debeziumService.listConnectors();
        pending.forEach(backfill -> dispatchSafely(backfill, connectors));
    }

    private void dispatchSafely(ConnectorBackfill backfill, List<String> connectors) {
        try {
            dispatch(backfill, connectors);
        } catch (Exception e) {
            log.error("{} Backfill signal failed, will retry: base='{}' gap_from={}",
                    DebeziumLog.PREFIX, backfill.getBaseName(), backfill.getGapFrom(), e);
        }
    }

    private void dispatch(ConnectorBackfill backfill, List<String> connectors) {
        if (isExpired(backfill)) {
            markExpired(backfill, "Backfill not requested before expiry");
            return;
        }
        String baseName = backfill.getBaseName();
        if (!nameStrategy.hasAnyVersion(baseName, connectors) || !toolConnectorSpecs.hasSpec(baseName)) return;
        String connectorName = nameStrategy.currentVersion(baseName, connectors).orElseThrow();
        if (!isRunning(connectorName)) return;

        Map<String, Object> spec = toolConnectorSpecs.specOf(baseName);
        Map<String, Object> config = ConnectorSpecs.configOf(spec);
        if (!signalPublisher.hasSignalChannel(config)) {
            markExpired(backfill, "No Kafka signal channel in the connector config");
            return;
        }
        Map<String, String> backfillFilters = ConnectorSpecs.backfillOf(spec);
        List<SnapshotCondition> conditions = sourceDialects.dialectFor(config)
                .gapConditions(config, backfillFilters, backfill.getGapFrom());
        signalPublisher.publishIncrementalSnapshot(config, conditions);
        markSent(backfill, connectorName);
    }

    private boolean isExpired(ConnectorBackfill backfill) {
        Instant deadline = backfill.getCreatedAt().plus(properties.getBackfillExpiry());
        return Instant.now().isAfter(deadline);
    }

    private boolean isRunning(String connectorName) {
        ConnectorStatus status = debeziumService.getConnectorStatus(connectorName);
        return status != null && status.isRunning();
    }

    private void markSent(ConnectorBackfill backfill, String connectorName) {
        backfill.setStatus(ConnectorBackfillStatus.SENT);
        backfill.setConnectorName(connectorName);
        backfill.setSentAt(Instant.now());
        backfillRepository.save(backfill);
        log.warn("{} Backfill requested: base='{}' connector='{}' gap_from={}",
                DebeziumLog.PREFIX, backfill.getBaseName(), connectorName, backfill.getGapFrom());
    }

    private void markExpired(ConnectorBackfill backfill, String reason) {
        backfill.setStatus(ConnectorBackfillStatus.EXPIRED);
        backfillRepository.save(backfill);
        gapAlerts.raise(backfill.getConnectorName(), backfill.getGapFrom(), reason);
    }
}
