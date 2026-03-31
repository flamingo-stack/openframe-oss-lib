package com.openframe.management.initializer;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.openframe.data.document.toolagent.IntegratedToolAgent;
import com.openframe.data.document.toolagent.ToolAgentAsset;
import com.openframe.data.nats.publisher.ToolAgentUpdateUpdatePublisher;
import com.openframe.data.service.IntegratedToolAgentService;
import com.openframe.management.config.AgentConfigurationProperties;
import io.micrometer.common.util.StringUtils;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.function.Function;
import java.util.stream.Collectors;

import static io.micrometer.common.util.StringUtils.isNotEmpty;
import static org.springframework.util.CollectionUtils.isEmpty;

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

        newAgent.setPublishState(existingAgent.getPublishState());

        integratedToolAgentService.save(newAgent);
        log.info("Updated agent configuration: {} from {}", newAgent.getId(), filePath);
        
        processConfigurationUpdate(existingAgent, newAgent);
    }

    private void processNewAgent(IntegratedToolAgent agent, String filePath) {
        log.info("Found no existing agent configuration for {}", agent.getId());
        integratedToolAgentService.save(agent);
        log.info("Created new agent configuration: {} from {}", agent.getId(), filePath);
    }

    private void processConfigurationUpdate(IntegratedToolAgent existingAgent, IntegratedToolAgent newAgent) {
        String toolAgentId = newAgent.getId();
        String existingVersion = existingAgent.getVersion();
        String newVersion = newAgent.getVersion();

        if (newAgent.isReleaseVersion()) {
            log.info("Skip update for release version {} {}", toolAgentId, existingVersion);
            return;
        }

        boolean versionChanged = !Objects.equals(existingVersion, newVersion);
        boolean assetChanged = hasAssetChanges(existingAgent, newAgent);

        if (versionChanged || assetChanged) {
            log.info("Detected configuration update for {}: versionChanged={}, assetChanged={}", toolAgentId, versionChanged, assetChanged);
            toolAgentUpdatePublisher.publish(newAgent);
            log.info("Processed configuration update for {}", toolAgentId);
        }
    }

    private boolean hasAssetChanges(IntegratedToolAgent existingAgent, IntegratedToolAgent newAgent) {
        List<ToolAgentAsset> existingAssets = existingAgent.getAssets();
        List<ToolAgentAsset> newAssets = newAgent.getAssets();

        if (isEmpty(existingAssets) || isEmpty(newAssets)) {
            return false;
        }

        Map<String, String> existingVersionsById = existingAssets.stream()
                .filter(existingAsset -> isNotEmpty(existingAsset.getVersion()))
                .collect(Collectors.toMap(ToolAgentAsset::getId, ToolAgentAsset::getVersion));

        for (ToolAgentAsset newAsset : newAssets) {
            if (StringUtils.isEmpty(newAgent.getVersion())) {
                continue;
            }

            String existingVersion = existingVersionsById.get(newAsset.getId());
            if (existingVersion == null) {
                continue;
            }

            if (!existingVersion.equals(newAsset.getVersion())) {
                return true;
            }
        }

        return false;
    }

}
