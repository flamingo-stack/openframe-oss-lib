package com.openframe.debezium.scheduler;

import com.openframe.data.document.tool.IntegratedTool;
import com.openframe.data.service.IntegratedToolService;
import com.openframe.data.service.TenantIdProvider;
import com.openframe.debezium.naming.ConnectorNameStrategy;
import com.openframe.debezium.recovery.RecreationTracker;
import com.openframe.debezium.recovery.gap.BackfillDispatcher;
import com.openframe.debezium.recovery.gap.CheckpointRecorder;
import com.openframe.debezium.recovery.gap.ConnectorRecreator;
import com.openframe.debezium.util.ConnectorSpecs;
import com.openframe.debezium.service.ConnectorRecoveryManager;
import com.openframe.debezium.service.DebeziumService;
import jakarta.annotation.PostConstruct;
import lombok.extern.slf4j.Slf4j;
import net.javacrumbs.shedlock.spring.annotation.SchedulerLock;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

@Slf4j
@Component
@ConditionalOnProperty(name = "openframe.debezium.health-check.enabled", havingValue = "true")
public class DebeziumHealthCheckScheduler {

    private final DebeziumService debeziumService;
    private final ConnectorRecoveryManager recoveryManager;
    private final IntegratedToolService integratedToolService;
    private final TenantIdProvider tenantIdProvider;
    private final ConnectorNameStrategy nameStrategy;
    private final ConnectorRecreator connectorRecreator;
    private final CheckpointRecorder checkpointRecorder;
    private final BackfillDispatcher backfillDispatcher;
    private final RecreationTracker recreationTracker;

    public DebeziumHealthCheckScheduler(DebeziumService debeziumService,
                                        ConnectorRecoveryManager recoveryManager,
                                        @Autowired(required = false) IntegratedToolService integratedToolService,
                                        TenantIdProvider tenantIdProvider,
                                        ConnectorNameStrategy nameStrategy,
                                        @Autowired(required = false) ConnectorRecreator connectorRecreator,
                                        @Autowired(required = false) CheckpointRecorder checkpointRecorder,
                                        @Autowired(required = false) BackfillDispatcher backfillDispatcher,
                                        @Autowired(required = false) RecreationTracker recreationTracker) {
        this.debeziumService = debeziumService;
        this.recoveryManager = recoveryManager;
        this.integratedToolService = integratedToolService;
        this.tenantIdProvider = tenantIdProvider;
        this.nameStrategy = nameStrategy;
        this.connectorRecreator = connectorRecreator;
        this.checkpointRecorder = checkpointRecorder;
        this.backfillDispatcher = backfillDispatcher;
        this.recreationTracker = recreationTracker;
    }

    @PostConstruct
    public void init() {
        log.info("DebeziumHealthCheckScheduler initialized with distributed locking and auto-recovery (strategy={})",
                nameStrategy.getClass().getSimpleName());
    }

    @Scheduled(fixedDelayString = "${openframe.debezium.health-check.interval:300000}")
    @SchedulerLock(
            name = "debeziumHealthCheck",
            lockAtMostFor = "${openframe.debezium.health-check.lock-at-most-for:5m}",
            lockAtLeastFor = "${openframe.debezium.health-check.lock-at-least-for:1m}"
    )
    public void checkAndRestartFailedTasks() {
        log.debug("Running Debezium health check with auto-recovery...");

        // Only reconcile/create connectors if a tenant is registered — prevents creating
        // connectors on empty clusters (e.g. before the first customer signs up).
        if (integratedToolService != null && tenantIdProvider.isTenantRegistered()) {
            reconcileMissingConnectors();
        }

        recoveryManager.checkAndRecoverAll();

        if (connectorRecreator != null) {
            runGapRecovery();
        }
    }

    private void runGapRecovery() {
        try {
            checkpointRecorder.recordAll();
        } catch (Exception e) {
            log.error("Failed to record connector checkpoints", e);
        }
        try {
            backfillDispatcher.dispatchPending();
        } catch (Exception e) {
            log.error("Failed to dispatch pending backfills", e);
        }
    }

    private void reconcileMissingConnectors() {
        try {
            List<IntegratedTool> tools = integratedToolService.getAllTools();
            Set<String> expectedBaseNames = debeziumService.extractExpectedConnectorNames(tools);
            if (expectedBaseNames.isEmpty()) {
                return;
            }

            List<String> actualConnectors = debeziumService.listConnectors();
            // Defence against transient Kafka Connect outage: listConnectors() returns
            // empty list on any failure. If we expect connectors but got nothing, it's
            // far more likely the API is unreachable than that the entire cluster
            // vanished — skip reconcile so we don't trigger redundant 409-noisy
            // re-creations once Kafka Connect comes back.
            if (actualConnectors.isEmpty()) {
                log.warn("Skipping reconcile — Kafka Connect returned no connectors but {} were expected " +
                        "(likely transient API outage)", expectedBaseNames.size());
                return;
            }
            Set<String> missing = expectedBaseNames.stream()
                    .filter(base -> !nameStrategy.hasAnyVersion(base, actualConnectors))
                    .collect(Collectors.toSet());

            if (!missing.isEmpty()) {
                log.warn("Found {} missing connectors — reconciling: {}", missing.size(), missing);
                Set<String> restorable = restorableFromCheckpoint(missing);
                restorable.forEach(base -> restoreFromCheckpoint(base, tools, actualConnectors));
                Set<String> fresh = missing.stream()
                        .filter(base -> !restorable.contains(base))
                        .collect(Collectors.toSet());
                debeziumService.reconcileMissingConnectors(tools, fresh);
            }
        } catch (Exception e) {
            log.error("Failed to reconcile missing connectors", e);
        }
    }

    private Set<String> restorableFromCheckpoint(Set<String> missing) {
        if (connectorRecreator == null) return Set.of();
        return missing.stream()
                .filter(connectorRecreator::hasFreshCheckpoint)
                .collect(Collectors.toSet());
    }

    // Rate-limited like every other recreate; the checkpoint keeps the position, so waiting loses no events.
    private void restoreFromCheckpoint(String baseName, List<IntegratedTool> tools, List<String> actualConnectors) {
        try {
            if (recreationTracker != null && !recreationTracker.canRecreate(baseName)) {
                log.warn("Restore of connector '{}' deferred — recreation limit reached", baseName);
                return;
            }
            String newName = nameStrategy.resolveNextName(baseName, actualConnectors);
            Map<String, Object> spec = specOf(baseName, tools);
            if (recreationTracker != null) {
                recreationTracker.record(baseName);
            }
            connectorRecreator.restoreFromCheckpoint(baseName, newName, spec);
        } catch (Exception e) {
            log.error("Failed to restore connector '{}' from checkpoint", baseName, e);
        }
    }

    private static Map<String, Object> specOf(String baseName, List<IntegratedTool> tools) {
        return tools.stream()
                .filter(IntegratedTool::isEnabled)
                .flatMap(ConnectorSpecs::specStreamOf)
                .filter(spec -> baseName.equals(ConnectorSpecs.nameOf(spec)))
                .findFirst()
                .orElseThrow();
    }
}
