package com.openframe.debezium.listener;

import com.openframe.data.document.tool.IntegratedTool;
import com.openframe.data.service.IntegratedToolService;
import com.openframe.data.service.TenantIdProvider;
import com.openframe.debezium.service.DebeziumService;
import com.openframe.debezium.util.ConnectorSpecs;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;

@Component
@Slf4j
@ConditionalOnProperty(name = "openframe.debezium.health-check.enabled", havingValue = "true")
public class DebeziumConnectorInitializer {

    private final DebeziumService debeziumService;
    private final IntegratedToolService integratedToolService;
    private final TenantIdProvider tenantIdProvider;

    @Value("${openframe.debezium.reconcile.delete-orphans:false}")
    private boolean deleteOrphans;

    @Autowired
    public DebeziumConnectorInitializer(DebeziumService debeziumService,
                                        @Autowired(required = false) IntegratedToolService integratedToolService,
                                        TenantIdProvider tenantIdProvider) {
        this.debeziumService = debeziumService;
        this.integratedToolService = integratedToolService;
        this.tenantIdProvider = tenantIdProvider;
    }

    @EventListener(ApplicationReadyEvent.class)
    public void onApplicationReady() {
        log.info("Application ready, checking Debezium connectors...");
        reconcileOrphanedConnectors();
        initializeConnectorsIfEmpty();
    }

    /**
     * Prune connectors in Kafka Connect down to one canonical version per known
     * base — deletes orphans (base maps to no tool spec, e.g. an old tenant-prefixed
     * naming scheme) and stale older {@code _vN} versions left by an interrupted
     * recreate. Runs once on startup; disabled by default, opt in with
     * {@code openframe.debezium.reconcile.delete-orphans=true}. Known base names
     * are taken from ALL tools (enabled and disabled) so a temporarily-disabled
     * tool's connector is not treated as an orphan.
     *
     * <p>Runs before {@link #initializeConnectorsIfEmpty()}: clearing orphans
     * first lets an otherwise orphan-only cluster fall through to a clean
     * initialization from MongoDB.
     */
    public void reconcileOrphanedConnectors() {
        if (!deleteOrphans || integratedToolService == null) {
            return;
        }
        if (!tenantIdProvider.isTenantRegistered()) {
            return;
        }
        Set<String> knownBaseNames = integratedToolService.getAllTools().stream()
                .flatMap(ConnectorSpecs::specStreamOf)
                .map(ConnectorSpecs::nameOf)
                .filter(Objects::nonNull)
                .collect(Collectors.toSet());
        // No known specs → cannot distinguish orphans from everything; skip rather
        // than delete the whole cluster.
        if (knownBaseNames.isEmpty()) {
            return;
        }
        List<String> existingConnectors = debeziumService.listConnectors();
        // listConnectors() returns empty on transient API failure — never treat
        // that as "every connector is an orphan".
        if (existingConnectors.isEmpty()) {
            return;
        }
        debeziumService.deleteOrphanedConnectors(knownBaseNames, existingConnectors);
    }

    /**
     * Initializes Debezium connectors from MongoDB if no connectors exist.
     * Fetches all IntegratedTools with debeziumConnectors configured and creates them.
     * Only runs if a tenant is registered — prevents creating connectors on empty clusters.
     */
    public void initializeConnectorsIfEmpty() {
        if (integratedToolService == null) {
            log.debug("IntegratedToolService is not available, skipping connector initialization");
            return;
        }

        if (!tenantIdProvider.isTenantRegistered()) {
            log.info("No tenant registered yet, skipping Debezium connector initialization");
            return;
        }

        List<String> existingConnectors = debeziumService.listConnectors();
        if (!existingConnectors.isEmpty()) {
            log.debug("Connectors already exist ({}), skipping initialization", existingConnectors.size());
            return;
        }

        log.info("No Debezium connectors found, initializing from MongoDB...");

        List<IntegratedTool> tools = integratedToolService.getAllTools();
        int createdCount = 0;

        for (IntegratedTool tool : tools) {
            Object[] debeziumConnectors = tool.getDebeziumConnectors();
            if (debeziumConnectors != null && debeziumConnectors.length > 0) {
                log.info("Creating Debezium connectors for tool: {}", tool.getName());
                debeziumService.createOrUpdateDebeziumConnector(debeziumConnectors);
                createdCount++;
            }
        }

        log.info("Connector initialization complete. Processed {} tools with Debezium configs", createdCount);
    }
}
