package com.openframe.management.initializer;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.openframe.data.document.toolagent.IntegratedToolAgent;
import com.openframe.data.service.IntegratedToolAgentService;
import com.openframe.management.config.AgentConfigurationProperties;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Component;

import java.util.List;

@Component
@RequiredArgsConstructor
@Slf4j
public class IntegratedToolAgentInitializer {

    private final ObjectMapper objectMapper;
    private final IntegratedToolAgentService integratedToolAgentService;
    private final AgentConfigurationProperties agentConfigurationProperties;

    @PostConstruct
    public void initializeToolAgents() {
        List<String> agentConfigurationPaths = agentConfigurationProperties.getAgentConfigurations();
        int agentConfigurationsCount = agentConfigurationPaths.size();

        if (agentConfigurationsCount == 0) {
            throw new IllegalStateException("No agent configuration found");
        }

        log.info("Initializing IntegratedToolAgent configurations from resources");
        log.info("Loading {} agent configuration(s) from configuration: {}",
                agentConfigurationsCount, agentConfigurationPaths);

        agentConfigurationPaths.forEach(this::processAgentConfiguration);

        log.info("IntegratedToolAgent configurations initialized successfully");
    }

    private void processAgentConfiguration(String agentConfigurationFilePath) {
        try {
            ClassPathResource resource = new ClassPathResource(agentConfigurationFilePath);
            if (!resource.exists()) {
                log.warn("Agent configuration file not found: {}, skipping", agentConfigurationFilePath);
                return;
            }

            IntegratedToolAgent fromConfig = objectMapper.readValue(resource.getInputStream(), IntegratedToolAgent.class);
            String fromConfigId = fromConfig.getId();

            integratedToolAgentService.updateConfigurationFields(fromConfig);
            log.info("Applied agent configuration: {} from {}", fromConfigId, agentConfigurationFilePath);
        } catch (Exception e) {
            String errorMessage = e.getMessage();
            log.error("Failed to load agent configuration from {}: {}", agentConfigurationFilePath, errorMessage, e);
        }
    }

}
