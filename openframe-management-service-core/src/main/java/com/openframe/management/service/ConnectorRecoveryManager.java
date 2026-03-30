package com.openframe.management.service;

import com.openframe.management.dto.debezium.ConnectorBackoffState;
import com.openframe.management.dto.debezium.ConnectorStatus;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Manages health checking and auto-recovery for Debezium connectors.
 * Checks both connector and task states, applies exponential backoff,
 * and triggers KIP-745 restarts.
 */
@Slf4j
@Component
@RequiredArgsConstructor
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
    private final ConcurrentHashMap<String, ConnectorBackoffState> backoffStates = new ConcurrentHashMap<>();

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
                log.error("Connector '{}' has a non-recoverable error — skipping restart, manual intervention required",
                        connectorName);
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
        }
    }

    private void logFailureDetails(String connectorName, ConnectorStatus status) {
        if (status.isConnectorFailed()) {
            log.warn("Connector '{}' itself is in FAILED state", connectorName);
        }
        for (ConnectorStatus.TaskStatus task : status.getFailedTasks()) {
            log.warn("Connector '{}' task {} is FAILED. Trace: {}",
                    connectorName, task.getId(), task.firstTraceLine());
        }
    }

    private void attemptRecovery(String connectorName) {
        ConnectorBackoffState backoff = backoffStates.computeIfAbsent(connectorName, k -> new ConnectorBackoffState());

        if (backoff.getConsecutiveFailures() >= MAX_RECOVERY_ATTEMPTS) {
            log.error("Connector '{}' has failed {} times — max recovery attempts ({}) exceeded, manual intervention required",
                    connectorName, backoff.getConsecutiveFailures(), MAX_RECOVERY_ATTEMPTS);
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
            log.info("Restart attempted for connector '{}' — attempt {}/{}, next retry eligible after {}ms",
                    connectorName, backoff.getConsecutiveFailures(), MAX_RECOVERY_ATTEMPTS, nextBackoffMs);
        } catch (Exception e) {
            backoff.recordFailure(nextBackoffMs);
            log.error("Failed to restart connector '{}' — attempt {}/{}, next retry after {}ms",
                    connectorName, backoff.getConsecutiveFailures(), MAX_RECOVERY_ATTEMPTS, nextBackoffMs, e);
        }
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
}
