package com.openframe.debezium.scheduler;

import com.openframe.data.document.tool.IntegratedTool;
import com.openframe.data.service.IntegratedToolService;
import com.openframe.data.service.TenantIdProvider;
import com.openframe.debezium.service.ConnectorRecoveryManager;
import com.openframe.debezium.service.DebeziumService;
import lombok.extern.slf4j.Slf4j;
import net.javacrumbs.shedlock.spring.annotation.SchedulerLock;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import jakarta.annotation.PostConstruct;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

@Component
@Slf4j
@ConditionalOnProperty(name = "openframe.debezium.health-check.enabled", havingValue = "true")
public class DebeziumHealthCheckScheduler {

    private final DebeziumService debeziumService;
    private final ConnectorRecoveryManager recoveryManager;
    private final IntegratedToolService integratedToolService;
    private final TenantIdProvider tenantIdProvider;

    @Autowired
    public DebeziumHealthCheckScheduler(DebeziumService debeziumService,
                                        ConnectorRecoveryManager recoveryManager,
                                        @Autowired(required = false) IntegratedToolService integratedToolService,
                                        TenantIdProvider tenantIdProvider) {
        this.debeziumService = debeziumService;
        this.recoveryManager = recoveryManager;
        this.integratedToolService = integratedToolService;
        this.tenantIdProvider = tenantIdProvider;
    }

    @PostConstruct
    public void init() {
        log.info("DebeziumHealthCheckScheduler initialized with distributed locking and auto-recovery");
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
    }

    private void reconcileMissingConnectors() {
        try {
            List<IntegratedTool> tools = integratedToolService.getAllTools();
            Set<String> expectedNames = debeziumService.extractExpectedConnectorNames(tools);
            if (expectedNames.isEmpty()) {
                return;
            }

            List<String> actualConnectors = debeziumService.listConnectors();
            Set<String> missing = new HashSet<>(expectedNames);
            missing.removeAll(new HashSet<>(actualConnectors));

            if (!missing.isEmpty()) {
                log.warn("Found {} missing connectors — reconciling: {}", missing.size(), missing);
                debeziumService.reconcileMissingConnectors(tools, missing);
            }
        } catch (Exception e) {
            log.error("Failed to reconcile missing connectors", e);
        }
    }
}
