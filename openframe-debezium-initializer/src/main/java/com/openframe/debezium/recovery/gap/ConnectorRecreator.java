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
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Set;

@Slf4j
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(name = "openframe.debezium.recovery.gap.enabled", havingValue = "true")
public class ConnectorRecreator {

    private static final Set<ConnectorBackfillStatus> UNFINISHED_BACKFILL = Set.of(
            ConnectorBackfillStatus.PENDING, ConnectorBackfillStatus.SENT);

    private final DebeziumService debeziumService;
    private final SourceDialects sourceDialects;
    private final ConnectorCheckpointRepository checkpointRepository;
    private final ConnectorBackfillRepository backfillRepository;
    private final GapRecoveryProperties properties;
    private final UnfilledGapAlerts gapAlerts;

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
                .discardOffsets(false)
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
        if (canHandOver(request, config)) {
            handOver(request, recreationConfig);
            return;
        }
        debeziumService.createConnector(request.getNewName(), recreationConfig);
        scheduleBackfillOrDiscard(request, config);
    }

    private boolean canHandOver(RecreationRequest request, Map<String, Object> config) {
        if (request.isDiscardOffsets() || request.getLastKnownOffsets().isEmpty()) return false;
        if (offsetsBelongTo(request.getLastKnownOffsets(), config)) return true;
        log.warn("{} Offsets belong to another topic.prefix, recreating without them: base='{}' new='{}'",
                DebeziumLog.PREFIX, request.getBaseName(), request.getNewName());
        return false;
    }

    private boolean offsetsBelongTo(ConnectorOffsets offsets, Map<String, Object> config) {
        if (!sourceDialects.supports(config)) return true;
        SourceDialect dialect = sourceDialects.dialectFor(config);
        return dialect.belongsTo(offsets, config);
    }

    private void handOver(RecreationRequest request, Map<String, Object> recreationConfig) {
        String newName = request.getNewName();
        debeziumService.createStoppedConnector(newName, recreationConfig);
        boolean offsetsCarried = carryOffsets(newName, request.getLastKnownOffsets());
        resumeOrDiscard(newName);
        if (offsetsCarried) {
            log.warn("{} Offsets handed over: base='{}' new='{}'", DebeziumLog.PREFIX, request.getBaseName(), newName);
            return;
        }
        Map<String, Object> config = ConnectorSpecs.configOf(request.getSpec());
        scheduleBackfillOrDiscard(request, config);
    }

    // A version left STOPPED looks healthy to every check, so drop it and let the next tick recreate it.
    // The recreation slot is already spent, so the retry starts clean with a backfill instead of a handover.
    private void resumeOrDiscard(String connectorName) {
        try {
            debeziumService.resumeConnector(connectorName);
        } catch (Exception e) {
            discard(connectorName);
            throw new IllegalStateException("Failed to resume handed-over connector " + connectorName, e);
        }
    }

    // Without its backfill the new version would run with a silent gap; dropping it makes the next tick retry.
    private void scheduleBackfillOrDiscard(RecreationRequest request, Map<String, Object> config) {
        try {
            scheduleBackfill(request, config);
        } catch (Exception e) {
            String newName = request.getNewName();
            discard(newName);
            throw new IllegalStateException("Failed to schedule backfill for " + newName, e);
        }
    }

    private void discard(String connectorName) {
        boolean deleted = debeziumService.deleteConnector(connectorName);
        if (!deleted) {
            log.error("{} Connector left STOPPED or without its backfill, delete it by hand: name='{}'",
                    DebeziumLog.PREFIX, connectorName);
        }
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
        Instant offsetsGapFrom = gapFrom(request.getLastKnownOffsets(), config);
        Instant gapFrom = earliestUnfinishedGapFrom(request.getBaseName(), offsetsGapFrom);
        if (!sourceDialects.supports(config)) {
            gapAlerts.raise(request.getNewName(), gapFrom, "No source dialect for the connector class");
            return;
        }
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
        if (!hasSourceTime(offsets, config)) {
            return Instant.now().minus(properties.getFallbackLookback());
        }
        SourceDialect dialect = sourceDialects.dialectFor(config);
        Instant lastSourceTime = dialect.sourceTime(offsets);
        return lastSourceTime.minus(properties.getMargin());
    }

    // A previous version's incremental snapshot keeps its progress in that version's offsets, which are not carried
    // over here, so its window must be read again.
    private Instant earliestUnfinishedGapFrom(String baseName, Instant gapFrom) {
        Instant createdAfter = Instant.now().minus(properties.getBackfillExpiry());
        List<ConnectorBackfill> unfinished =
                backfillRepository.findByBaseNameAndStatusInAndCreatedAtAfter(baseName, UNFINISHED_BACKFILL, createdAfter);
        return unfinished.stream()
                .map(ConnectorBackfill::getGapFrom)
                .filter(previous -> previous != null && previous.isBefore(gapFrom))
                .min(Comparator.naturalOrder())
                .orElse(gapFrom);
    }

    private boolean hasSourceTime(ConnectorOffsets offsets, Map<String, Object> config) {
        return sourceDialects.supports(config) && sourceDialects.dialectFor(config).hasSourceTime(offsets);
    }
}
