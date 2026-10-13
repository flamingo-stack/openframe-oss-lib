package com.openframe.debezium.recovery.gap;

import com.openframe.data.document.connector.ConnectorBackfill;
import com.openframe.data.document.connector.ConnectorBackfillStatus;
import com.openframe.data.document.connector.ConnectorCheckpoint;
import com.openframe.data.repository.connector.ConnectorBackfillRepository;
import com.openframe.data.repository.connector.ConnectorCheckpointRepository;
import com.openframe.debezium.dto.ConnectorOffsets;
import com.openframe.debezium.dto.ConnectorStatus;
import com.openframe.debezium.service.DebeziumService;
import com.openframe.debezium.util.ConnectorSpecs;
import com.openframe.debezium.util.DebeziumLog;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.Map;

@Slf4j
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(name = "openframe.debezium.recovery.gap.enabled", havingValue = "true")
public class ConnectorRecreator {

    private final DebeziumService debeziumService;
    private final SourceDialects sourceDialects;
    private final ConnectorCheckpointRepository checkpointRepository;
    private final ConnectorBackfillRepository backfillRepository;
    private final GapRecoveryProperties properties;

    public boolean isHistoryLost(ConnectorStatus status) {
        return sourceDialects.isHistoryLost(status.getFailureTraces());
    }

    // A stale checkpoint (tool disabled for weeks) would turn into a huge backfill, so it counts as none.
    public boolean hasFreshCheckpoint(String baseName) {
        Instant oldestAccepted = Instant.now().minus(properties.getCheckpointMaxAge());
        return checkpointRepository.findById(baseName)
                .map(ConnectorCheckpoint::getCapturedAt)
                .filter(capturedAt -> capturedAt.isAfter(oldestAccepted))
                .isPresent();
    }

    public void restoreFromCheckpoint(String baseName, String newName, Map<String, Object> spec) {
        ConnectorOffsets offsets = checkpointOffsets(baseName);
        RecreationRequest request = RecreationRequest.builder()
                .baseName(baseName)
                .newName(newName)
                .spec(spec)
                .lastKnownOffsets(offsets)
                .historyLost(false)
                .build();
        log.warn("{} Restoring missing connector from checkpoint: base='{}' new='{}'",
                DebeziumLog.PREFIX, baseName, newName);
        recreate(request);
    }

    public ConnectorOffsets lastKnownOffsets(String baseName, String connectorName) {
        ConnectorOffsets live = debeziumService.getConnectorOffsets(connectorName);
        if (!live.isEmpty()) return live;
        return checkpointOffsets(baseName);
    }

    public ConnectorOffsets checkpointOffsets(String baseName) {
        return checkpointRepository.findById(baseName)
                .map(ConnectorCheckpoint::getOffsets)
                .map(ConnectorOffsets::new)
                .orElseGet(ConnectorOffsets::empty);
    }

    public void recreate(RecreationRequest request) {
        Map<String, Object> config = ConnectorSpecs.configOf(request.getSpec());
        Map<String, Object> recreationConfig = debeziumService.recreationConfig(config);
        if (canHandOver(request)) {
            handOver(request, recreationConfig);
            return;
        }
        debeziumService.createConnector(request.getNewName(), recreationConfig);
        scheduleBackfill(request, config);
    }

    private boolean canHandOver(RecreationRequest request) {
        return !request.isHistoryLost() && !request.getLastKnownOffsets().isEmpty();
    }

    private void handOver(RecreationRequest request, Map<String, Object> recreationConfig) {
        String newName = request.getNewName();
        debeziumService.createStoppedConnector(newName, recreationConfig);
        boolean offsetsCarried = carryOffsets(newName, request.getLastKnownOffsets());
        debeziumService.resumeConnector(newName);
        if (offsetsCarried) {
            log.warn("{} Offsets handed over: base='{}' new='{}'", DebeziumLog.PREFIX, request.getBaseName(), newName);
            return;
        }
        Map<String, Object> config = ConnectorSpecs.configOf(request.getSpec());
        scheduleBackfill(request, config);
    }

    private boolean carryOffsets(String connectorName, ConnectorOffsets offsets) {
        try {
            debeziumService.alterConnectorOffsets(connectorName, offsets);
            return true;
        } catch (Exception e) {
            log.error("{} Offset handover failed, falling back to backfill: connector='{}'",
                    DebeziumLog.PREFIX, connectorName, e);
            return false;
        }
    }

    private void scheduleBackfill(RecreationRequest request, Map<String, Object> config) {
        if (!sourceDialects.supports(config)) {
            log.error("{} Gap left unfilled — no source dialect: base='{}'", DebeziumLog.PREFIX, request.getBaseName());
            return;
        }
        Instant gapFrom = gapFrom(request.getLastKnownOffsets(), config);
        ConnectorBackfill backfill = ConnectorBackfill.builder()
                .baseName(request.getBaseName())
                .connectorName(request.getNewName())
                .gapFrom(gapFrom)
                .status(ConnectorBackfillStatus.PENDING)
                .createdAt(Instant.now())
                .build();
        backfillRepository.save(backfill);
        log.warn("{} Backfill scheduled: base='{}' new='{}' gap_from={}",
                DebeziumLog.PREFIX, request.getBaseName(), request.getNewName(), gapFrom);
    }

    private Instant gapFrom(ConnectorOffsets offsets, Map<String, Object> config) {
        SourceDialect dialect = sourceDialects.dialectFor(config);
        if (!dialect.hasSourceTime(offsets)) {
            return Instant.now().minus(properties.getFallbackLookback());
        }
        Instant lastSourceTime = dialect.sourceTime(offsets);
        return lastSourceTime.minus(properties.getMargin());
    }
}
