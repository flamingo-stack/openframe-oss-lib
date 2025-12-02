package com.openframe.management.initializer;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.openframe.data.document.toolagent.IntegratedToolAgent;
import com.openframe.data.service.IntegratedToolAgentService;
import com.openframe.data.service.ToolAgentUpdateUpdatePublisher;
import com.openframe.management.config.AgentConfigurationProperties;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Component;

import javax.annotation.PostConstruct;
import java.util.List;

@Component
@RequiredArgsConstructor
@Slf4j
public class IntegratedToolAgentInitializer {

    private final ObjectMapper objectMapper;
    private final IntegratedToolAgentService integratedToolAgentService;
    private final ToolAgentUpdateUpdatePublisher toolAgentUpdatePublisher;
    private final AgentConfigurationProperties agentConfigurationProperties;

    @PostConstruct
    public void initializeToolAgents() {
        List<String> agentConfigurationPaths = agentConfigurationProperties.getAgentConfigurations();
        log.info("Initializing IntegratedToolAgent configurations from resources...");
        log.info("Loading {} agent configuration(s) from configuration: {}", 
                agentConfigurationPaths.size(), agentConfigurationPaths);
        
        agentConfigurationPaths
                .forEach(this::processAgentConfiguration);
        
        log.info("IntegratedToolAgent configurations initialized successfully");
    }

    private void processAgentConfiguration(String agentConfigurationFilePath) {
        try {
            ClassPathResource resource = new ClassPathResource(agentConfigurationFilePath);
            if (!resource.exists()) {
                log.warn("Agent configuration file not found: {}, skipping", agentConfigurationFilePath);
                return;
            }
            
            IntegratedToolAgent agent = objectMapper.readValue(resource.getInputStream(), IntegratedToolAgent.class);
            
            integratedToolAgentService.findById(agent.getId())
                .ifPresentOrElse(
                    existingAgent -> processExistingAgent(existingAgent, agent, agentConfigurationFilePath),
                    () -> processNewAgent(agent, agentConfigurationFilePath)
                );
        } catch (Exception e) {
            log.error("Failed to load agent configuration from {}: {}", agentConfigurationFilePath, e.getMessage(), e);
        }
    }

    private void processExistingAgent(IntegratedToolAgent existingAgent, IntegratedToolAgent newAgent, String filePath) {
        log.info("Agent configuration {} already exists, updating", newAgent.getId());
        
        // Preserve version for release agents to prevent overriding
        if (existingAgent.isReleaseVersion()) {
            String existingVersion = existingAgent.getVersion();
            newAgent.setVersion(existingVersion);
            log.info("Preserving version {} for release agent {}", existingVersion, newAgent.getId());
        }
        
        integratedToolAgentService.save(newAgent);
        log.info("Updated agent configuration: {} from {}", newAgent.getId(), filePath);
        
        processVersionUpdate(existingAgent, newAgent);
    }

    private void processNewAgent(IntegratedToolAgent agent, String filePath) {
        log.info("Found no existing agent configuration for {}", agent.getId());
        integratedToolAgentService.save(agent);
        log.info("Created new agent configuration: {} from {}", agent.getId(), filePath);
    }

    private void processVersionUpdate(IntegratedToolAgent existingAgent, IntegratedToolAgent newAgent) {
        String toolAgentId = newAgent.getId();
        String existingVersion = existingAgent.getVersion();
        String newVersion = newAgent.getVersion();

        if (newAgent.isReleaseVersion()) {
           log.info("Skip update for release version {} {}", toolAgentId, existingVersion);
           return;
        }

        if (!existingVersion.equals(newVersion)) {
            log.info("Detected version update for {} from {} to {}", toolAgentId, existingVersion, newVersion);
            toolAgentUpdatePublisher.publish(newAgent);
            log.info("Processed version update for {}", newAgent.getId());
        }
    }

}
