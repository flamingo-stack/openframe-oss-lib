package com.openframe.management.listener;

import com.openframe.data.document.tool.IntegratedTool;
import com.openframe.data.service.IntegratedToolService;
import com.openframe.management.service.DebeziumService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;

import java.util.List;

@Component
@Slf4j
@ConditionalOnProperty(name = "openframe.debezium.health-check.enabled", havingValue = "true")
public class DebeziumConnectorInitializer {

    private final DebeziumService debeziumService;
    private final IntegratedToolService integratedToolService;

    @Autowired
    public DebeziumConnectorInitializer(DebeziumService debeziumService,
                                        @Autowired(required = false) IntegratedToolService integratedToolService) {
        this.debeziumService = debeziumService;
        this.integratedToolService = integratedToolService;
    }

    @EventListener(ApplicationReadyEvent.class)
    public void onApplicationReady() {
        log.info("Application ready, checking Debezium connectors...");
        initializeConnectorsIfEmpty();
    }

    /**
     * Initializes Debezium connectors from MongoDB if no connectors exist.
     * Fetches all IntegratedTools with debeziumConnectors configured and creates them.
     */
    public void initializeConnectorsIfEmpty() {
        if (integratedToolService == null) {
            log.debug("IntegratedToolService is not available, skipping connector initialization");
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