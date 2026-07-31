package com.openframe.debezium.service;

import com.openframe.data.document.connector.ConnectorAlert;
import com.openframe.data.document.connector.ConnectorAlertType;
import com.openframe.data.repository.connector.ConnectorAlertRepository;
import com.openframe.data.service.IntegratedToolService;
import com.openframe.debezium.dto.ConnectorBackoffState;
import com.openframe.debezium.dto.ConnectorStatus;
import com.openframe.debezium.naming.ConnectorNameStrategy;
import com.openframe.debezium.recovery.RecreationTracker;
import com.openframe.debezium.util.ConnectorSpecs;
import com.openframe.debezium.util.DebeziumLog;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.time.Instant;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Manages health checking and auto-recovery for Debezium connectors.
 * Checks both connector and task states, applies exponential backoff,
 * and triggers KIP-745 restarts.
 *
 * When a non-default {@link ConnectorNameStrategy} is in scope together with a
 * {@link RecreationTracker} bean (SaaS shared cluster), exhausted retries and
 * non-recoverable errors lead to recreation under a new versioned name with
 * removal of the stale versions, instead of just raising an alert.
 */
@Slf4j
@Component
public class ConnectorRecoveryManager {

    private static final long BACKOFF_INCREMENT_MS = Duration.ofMinutes(2).toMillis();
    private static final int MAX_RECOVERY_ATTEMPTS = 5;
    private static final String MAX_RETRIES_MSG = "Max recovery attempts (" + MAX_RECOVERY_ATTEMPTS + ") exceeded";
    private static final String TRIGGER_NON_RECOVERABLE = "non-recoverable";
    private static final String TRIGGER_MAX_ATTEMPTS = "max-attempts";
    private static final String TRIGGER_NO_STATUS = "no-status";
    private static final String NO_STATUS_MSG = "Connector registered but Kafka Connect reports no status";

    private static final Set<String> NON_RECOVERABLE_ERROR_PATTERNS = Set.of(
            "org.apache.kafka.common.config.ConfigException",
            "java.lang.ClassNotFoundException",
            "java.lang.NoClassDefFoundError",
            "org.apache.kafka.common.errors.InvalidConfigurationException",
            "io.debezium.DebeziumException: Access denied",
            "io.debezium.DebeziumException: Authentication failed"
    );

    private final DebeziumService debeziumService;
    private final ConnectorAlertRepository connectorAlertRepository;
    private final ConnectorNameStrategy nameStrategy;
    private final RecreationTracker recreationTracker;
    private final IntegratedToolService integratedToolService;
    private final ConcurrentHashMap<String, ConnectorBackoffState> backoffStates = new ConcurrentHashMap<>();

    @Autowired
    public ConnectorRecoveryManager(DebeziumService debeziumService,
                                    ConnectorAlertRepository connectorAlertRepository,
                                    ConnectorNameStrategy nameStrategy,
                                    @Autowired(required = false) RecreationTracker recreationTracker,
                                    @Autowired(required = false) IntegratedToolService integratedToolService) {
        this.debeziumService = debeziumService;
        this.connectorAlertRepository = connectorAlertRepository;
        this.nameStrategy = nameStrategy;
        this.recreationTracker = recreationTracker;
        this.integratedToolService = integratedToolService;
    }

    /**
     * Check all connectors and recover any that are in a failed state.
     */
    public void checkAndRecoverAll() {
        List<String> connectors = debeziumService.listConnectors();
        if (connectors.isEmpty()) {
            log.debug("No connectors found");
            return;
        }

        for (String connector : connectors) {
            checkAndRecover(connector);
        }
        // Drop in-memory backoff state for connectors that disappeared from
        // Kafka Connect (e.g. deleted by an operator). Otherwise the map grows
        // unboundedly over the pod's lifetime.
        Set<String> live = new HashSet<>(connectors);
        backoffStates.keySet().removeIf(name -> !live.contains(name));
    }

    /**
     * Check a single connector's health and attempt recovery if failed.
     */
    public void checkAndRecover(String connectorName) {
        try {
            ConnectorStatus status = debeziumService.getConnectorStatus(connectorName);
            if (status == null) {
                handleMissingStatus(connectorName);
                return;
            }

            if (!status.hasFailures()) {
                clearFailureState(connectorName);
                return;
            }

            logFailureDetails(connectorName, status);

            if (isNonRecoverable(status)) {
                log.error("{} Non-recoverable error: name='{}' trace={}",
                        DebeziumLog.PREFIX, connectorName, status.getFirstFailureTrace());
                if (tryRecreate(connectorName, status.getFirstFailureTrace(), TRIGGER_NON_RECOVERABLE)) {
                    return;
                }
                createAlert(connectorName, ConnectorAlertType.NON_RECOVERABLE_ERROR,
                        status.getFirstFailureTrace(), 0);
                return;
            }

            attemptRecovery(connectorName);
        } catch (Exception e) {
            log.error("Failed to check health of connector '{}'", connectorName, e);
        }
    }

    /**
     * A 404 on {@code /status} is ambiguous: the connector may have been deleted
     * between the list and the status call (a benign race), or it may be
     * registered in the config topic while Kafka Connect never assigned tasks or
     * wrote a status record — a "No status found" state where CDC is silently
     * dead. The presence of a live config distinguishes the two: config present
     * means the connector is stuck, not gone, so recreate it under a fresh
     * versioned name with a clean offset namespace.
     */
    private void handleMissingStatus(String connectorName) {
        if (debeziumService.getConnectorConfig(connectorName) == null) {
            log.debug("Connector '{}' gone (no status, no config) — skipping", connectorName);
            return;
        }
        log.error("{} Connector registered but has no status — recreating: name='{}'",
                DebeziumLog.PREFIX, connectorName);
        if (tryRecreate(connectorName, NO_STATUS_MSG, TRIGGER_NO_STATUS)) {
            return;
        }
        createAlert(connectorName, ConnectorAlertType.NON_RECOVERABLE_ERROR, NO_STATUS_MSG, 0);
    }

    /**
     * Healthy-path cleanup: drop the in-memory backoff entry and resolve any
     * open Mongo alert. Called every healthy tick (idempotent on both sides),
     * which survives JVM restart where {@code backoffStates} is empty but a
     * pre-restart alert is still open.
     */
    private void clearFailureState(String connectorName) {
        backoffStates.remove(connectorName);
        resolveAlert(connectorName);
    }

    private void logFailureDetails(String connectorName, ConnectorStatus status) {
        String base = nameStrategy.extractBaseName(connectorName);
        if (status.isConnectorFailed()) {
            log.error("{} Connector failed: name='{}' base='{}'", DebeziumLog.PREFIX, connectorName, base);
        }
        for (ConnectorStatus.TaskStatus task : status.getFailedTasks()) {
            log.error("{} Task failed: name='{}' base='{}' task={} trace={}",
                    DebeziumLog.PREFIX, connectorName, base, task.getId(), task.firstTraceLine());
        }
    }

    private void attemptRecovery(String connectorName) {
        ConnectorBackoffState backoff = backoffStates.computeIfAbsent(connectorName, k -> new ConnectorBackoffState());

        if (backoff.getConsecutiveFailures() >= MAX_RECOVERY_ATTEMPTS) {
            log.error("{} Max retries exceeded: name='{}' attempts={}",
                    DebeziumLog.PREFIX, connectorName, backoff.getConsecutiveFailures());
            if (tryRecreate(connectorName, MAX_RETRIES_MSG, TRIGGER_MAX_ATTEMPTS)) {
                return;
            }
            createAlert(connectorName, ConnectorAlertType.MAX_RETRIES_EXCEEDED,
                    MAX_RETRIES_MSG, backoff.getConsecutiveFailures());
            return;
        }

        if (!backoff.isEligibleForRestart()) {
            log.info("Connector '{}' restart deferred — backoff active until {} (attempt {}/{})",
                    connectorName, backoff.getNextEligibleRestart(), backoff.getConsecutiveFailures(), MAX_RECOVERY_ATTEMPTS);
            return;
        }

        long nextBackoffMs = calculateBackoff(backoff.getConsecutiveFailures());
        try {
            debeziumService.restartConnectorWithFailedTasks(connectorName);
            backoff.recordFailure(nextBackoffMs);
            log.warn("{} Restart attempted: name='{}' attempt={}/{} next_backoff_ms={}",
                    DebeziumLog.PREFIX, connectorName, backoff.getConsecutiveFailures(), MAX_RECOVERY_ATTEMPTS, nextBackoffMs);
        } catch (Exception e) {
            backoff.recordFailure(nextBackoffMs);
            log.error("{} Restart failed: name='{}' attempt={}/{} next_backoff_ms={}",
                    DebeziumLog.PREFIX, connectorName, backoff.getConsecutiveFailures(), MAX_RECOVERY_ATTEMPTS, nextBackoffMs, e);
        }
    }

    /**
     * Attempt to recreate a connector under a new versioned name when the active
     * strategy supports recreation and a {@link RecreationTracker} is present.
     *
     * @return true if recreation was attempted (caller should NOT raise an alert).
     */
    private boolean tryRecreate(String failedName, String reason, String trigger) {
        if (!isRecreationEnabled()) return false;

        String base = nameStrategy.extractBaseName(failedName);
        if (!recreationTracker.canRecreate(base)) {
            log.error("{} Recreation limit reached: base='{}' trigger={}", DebeziumLog.PREFIX, base, trigger);
            return false;
        }
        return lookupConfigForBase(base)
                .map(cfg -> performRecreation(failedName, base, cfg, reason, trigger))
                .orElseGet(() -> {
                    log.warn("{} Recreation skipped — no source config: base='{}'", DebeziumLog.PREFIX, base);
                    return false;
                });
    }

    private boolean isRecreationEnabled() {
        return recreationTracker != null
                && integratedToolService != null
                && nameStrategy.supportsRecreation();
    }

    private boolean performRecreation(String failedName, String base, Map<String, Object> config,
                                      String reason, String trigger) {
        List<String> existingBefore = debeziumService.listConnectors();
        String newName = nameStrategy.resolveNextName(base, existingBefore);

        // Reserve the rate-limit slot BEFORE the create POST. If record() fails the
        // recreate is aborted; if record() succeeds but create POST fails the slot is
        // already spent — next tick will not retry within the rolling window, which is
        // the safer outcome (no runaway recreates against broken Kafka Connect).
        try {
            recreationTracker.record(base);
        } catch (Exception e) {
            log.error("{} Recreation aborted — tracker record failed: base='{}'", DebeziumLog.PREFIX, base, e);
            return false;
        }

        try {
            debeziumService.createConnector(newName, config);
        } catch (Exception e) {
            log.error("{} Recreation failed: base='{}' new='{}' trigger={}",
                    DebeziumLog.PREFIX, base, newName, trigger, e);
            return false;
        }

        clearFailureState(failedName);
        log.warn("{} Connector recreated: base='{}' old='{}' new='{}' trigger={} reason={}",
                DebeziumLog.PREFIX, base, failedName, newName, trigger, reason);

        // Use the pre-create snapshot — the new version is necessarily not in it,
        // and the stale versions we want to remove are exactly the ones that were
        // there before. Saves one HTTP round-trip and is race-free.
        nameStrategy.staleVersions(base, newName, existingBefore)
                .forEach(debeziumService::deleteConnector);
        return true;
    }

    private Optional<Map<String, Object>> lookupConfigForBase(String baseName) {
        // Symmetric with DebeziumService.extractExpectedConnectorNames — disabled
        // tools must not drive recreation. If a tool is later disabled, the
        // operator is responsible for deleting the running connector.
        return integratedToolService.getAllTools().stream()
                .filter(com.openframe.data.document.tool.IntegratedTool::isEnabled)
                .flatMap(ConnectorSpecs::specStreamOf)
                .filter(spec -> baseName.equals(ConnectorSpecs.nameOf(spec)))
                .findFirst()
                .map(ConnectorSpecs::configOf);
    }

    private long calculateBackoff(int consecutiveFailures) {
        return BACKOFF_INCREMENT_MS * (consecutiveFailures + 1);
    }

    /**
     * Check if any failure trace matches a known non-recoverable error pattern.
     * These errors require manual intervention (config fix, class deployment, etc.)
     * and restarting the connector will not resolve them.
     */
    private boolean isNonRecoverable(ConnectorStatus status) {
        for (String trace : status.getFailureTraces()) {
            for (String pattern : NON_RECOVERABLE_ERROR_PATTERNS) {
                if (trace.contains(pattern)) {
                    return true;
                }
            }
        }
        return false;
    }

    private void createAlert(String connectorName, ConnectorAlertType errorType, String errorMessage, int attempts) {
        if (connectorAlertRepository == null) {
            return;
        }
        try {
            if (connectorAlertRepository.findByConnectorNameAndResolvedFalse(connectorName).isPresent()) {
                log.debug("Active alert already exists for connector '{}'", connectorName);
                return;
            }
            ConnectorAlert alert = ConnectorAlert.builder()
                    .connectorName(connectorName)
                    .errorType(errorType)
                    .errorMessage(errorMessage)
                    .attempts(attempts)
                    .createdAt(Instant.now())
                    .resolved(false)
                    .build();
            connectorAlertRepository.save(alert);
            log.info("Created connector alert for '{}': {}", connectorName, errorType);
        } catch (Exception e) {
            log.warn("Failed to create connector alert for '{}'", connectorName, e);
        }
    }

    private void resolveAlert(String connectorName) {
        if (connectorAlertRepository == null) {
            return;
        }
        try {
            connectorAlertRepository.findByConnectorNameAndResolvedFalse(connectorName)
                    .ifPresent(alert -> {
                        alert.setResolved(true);
                        alert.setResolvedAt(Instant.now());
                        connectorAlertRepository.save(alert);
                        log.info("Resolved connector alert for '{}'", connectorName);
                    });
        } catch (Exception e) {
            log.warn("Failed to resolve connector alert for '{}'", connectorName, e);
        }
    }
}
