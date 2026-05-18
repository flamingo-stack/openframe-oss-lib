package com.openframe.debezium.service;

import com.openframe.data.document.connector.ConnectorAlert;
import com.openframe.data.document.connector.ConnectorAlertType;
import com.openframe.data.document.tool.IntegratedTool;
import com.openframe.data.repository.connector.ConnectorAlertRepository;
import com.openframe.data.service.IntegratedToolService;
import com.openframe.debezium.dto.ConnectorBackoffState;
import com.openframe.debezium.dto.ConnectorStatus;
import com.openframe.debezium.naming.ConnectorNameStrategy;
import com.openframe.debezium.naming.IdentityConnectorNameStrategy;
import com.openframe.debezium.recovery.RecreationTracker;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.Objects;
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

    private static final long BACKOFF_INCREMENT_MS = 2 * 60 * 1000L; // 2 minutes
    private static final int MAX_RECOVERY_ATTEMPTS = 5;

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
    }

    /**
     * Check a single connector's health and attempt recovery if failed.
     */
    public void checkAndRecover(String connectorName) {
        try {
            ConnectorStatus status = debeziumService.getConnectorStatus(connectorName);
            if (status == null) {
                log.warn("Could not get status for connector '{}'", connectorName);
                return;
            }

            if (!status.hasFailures()) {
                resetBackoffIfPresent(connectorName);
                return;
            }

            logFailureDetails(connectorName, status);

            if (isNonRecoverable(status)) {
                log.error("[DEBEZIUM] Non-recoverable error: name='{}' trace={}",
                        connectorName, status.getFirstFailureTrace());
                if (tryRecreate(connectorName, status.getFirstFailureTrace(), "non-recoverable")) {
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

    private void resetBackoffIfPresent(String connectorName) {
        if (backoffStates.containsKey(connectorName)) {
            log.info("Connector '{}' recovered successfully — resetting backoff state", connectorName);
            backoffStates.remove(connectorName);
            resolveAlert(connectorName);
        }
    }

    private void logFailureDetails(String connectorName, ConnectorStatus status) {
        String base = nameStrategy.extractBaseName(connectorName);
        if (status.isConnectorFailed()) {
            log.error("[DEBEZIUM] Connector failed: name='{}' base='{}'", connectorName, base);
        }
        for (ConnectorStatus.TaskStatus task : status.getFailedTasks()) {
            log.error("[DEBEZIUM] Task failed: name='{}' base='{}' task={} trace={}",
                    connectorName, base, task.getId(), task.firstTraceLine());
        }
    }

    private void attemptRecovery(String connectorName) {
        ConnectorBackoffState backoff = backoffStates.computeIfAbsent(connectorName, k -> new ConnectorBackoffState());

        if (backoff.getConsecutiveFailures() >= MAX_RECOVERY_ATTEMPTS) {
            log.error("[DEBEZIUM] Max retries exceeded: name='{}' attempts={}",
                    connectorName, backoff.getConsecutiveFailures());
            if (tryRecreate(connectorName,
                    "Max recovery attempts (" + MAX_RECOVERY_ATTEMPTS + ") exceeded",
                    "max-attempts")) {
                return;
            }
            createAlert(connectorName, ConnectorAlertType.MAX_RETRIES_EXCEEDED,
                    "Max recovery attempts (" + MAX_RECOVERY_ATTEMPTS + ") exceeded",
                    backoff.getConsecutiveFailures());
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
            log.warn("[DEBEZIUM] Restart attempted: name='{}' attempt={}/{} next_backoff_ms={}",
                    connectorName, backoff.getConsecutiveFailures(), MAX_RECOVERY_ATTEMPTS, nextBackoffMs);
        } catch (Exception e) {
            backoff.recordFailure(nextBackoffMs);
            log.error("[DEBEZIUM] Restart failed: name='{}' attempt={}/{} next_backoff_ms={}",
                    connectorName, backoff.getConsecutiveFailures(), MAX_RECOVERY_ATTEMPTS, nextBackoffMs, e);
        }
    }

    /**
     * Attempt to recreate a connector under a new versioned name when the active
     * strategy is non-identity and a {@link RecreationTracker} is present.
     *
     * @return true if recreation was attempted (caller should NOT raise an alert).
     */
    private boolean tryRecreate(String failedName, String reason, String trigger) {
        if (!isRecreationEnabled()) return false;

        String base = nameStrategy.extractBaseName(failedName);
        if (!recreationTracker.canRecreate(base)) {
            log.error("[DEBEZIUM] Recreation limit reached: base='{}' trigger={}", base, trigger);
            return false;
        }
        return lookupConfigForBase(base)
                .map(cfg -> performRecreation(failedName, base, cfg, reason, trigger))
                .orElseGet(() -> {
                    log.warn("[DEBEZIUM] Recreation skipped — no source config: base='{}'", base);
                    return false;
                });
    }

    private boolean isRecreationEnabled() {
        return recreationTracker != null
                && integratedToolService != null
                && !(nameStrategy instanceof IdentityConnectorNameStrategy);
    }

    private boolean performRecreation(String failedName, String base, Map<String, Object> config,
                                      String reason, String trigger) {
        String newName = nameStrategy.resolveNextName(base, debeziumService.listConnectors());
        try {
            debeziumService.createConnector(newName, config);
        } catch (Exception e) {
            log.error("[DEBEZIUM] Recreation failed: base='{}' new='{}' trigger={}", base, newName, trigger, e);
            return false;
        }

        // After POST succeeded the new version exists. Fix the limit before
        // best-effort cleanup so the next tick doesn't loop on recreate even
        // if delete calls fail mid-way.
        recreationTracker.record(base);
        backoffStates.remove(failedName);
        resolveAlert(failedName);
        log.warn("[DEBEZIUM] Connector recreated: base='{}' old='{}' new='{}' trigger={} reason={}",
                base, failedName, newName, trigger, reason);

        nameStrategy.staleVersions(base, newName, debeziumService.listConnectors())
                .forEach(debeziumService::deleteConnector);
        return true;
    }

    private Optional<Map<String, Object>> lookupConfigForBase(String baseName) {
        return integratedToolService.getAllTools().stream()
                .map(IntegratedTool::getDebeziumConnectors)
                .filter(Objects::nonNull)
                .flatMap(Arrays::stream)
                .map(this::asMap)
                .filter(c -> baseName.equals(c.get("name")))
                .findFirst()
                .map(c -> asMap(c.get("config")));
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> asMap(Object value) {
        return (Map<String, Object>) value;
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
