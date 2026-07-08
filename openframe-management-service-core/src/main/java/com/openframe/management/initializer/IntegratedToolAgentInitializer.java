package com.openframe.management.initializer;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.openframe.data.document.toolagent.IntegratedToolAgentConfiguration;
import com.openframe.data.document.toolagent.ToolAgentAsset;
import com.openframe.data.service.IntegratedToolAgentService;
import com.openframe.management.config.AgentConfigurationProperties;
import com.openframe.management.config.ClientVersionsProperties;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.annotation.Order;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Component;

import java.io.InputStream;
import java.util.Arrays;
import java.util.List;
import java.util.Optional;

@Component
@Order(20)
@RequiredArgsConstructor
@Slf4j
public class IntegratedToolAgentInitializer implements ApplicationRunner {

    private static final String OSQUERY_ASSET_ID = "osqueryd";

    private final ObjectMapper objectMapper;
    private final IntegratedToolAgentService integratedToolAgentService;
    private final AgentConfigurationProperties agentConfigurationProperties;
    private final ClientVersionsProperties clientVersionsProperties;

    @Override
    public void run(ApplicationArguments args) {
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

            InputStream resourceInputStream = resource.getInputStream();
            IntegratedToolAgentConfiguration configuration = objectMapper.readValue(resourceInputStream, IntegratedToolAgentConfiguration.class);
            String configurationId = configuration.getId();

            applyVersionFromProperties(configuration);

            integratedToolAgentService.updateConfigurationFields(configuration);
            log.info("Applied agent configuration: {} from {}", configurationId, agentConfigurationFilePath);
        } catch (Exception e) {
            String errorMessage = e.getMessage();
            log.error("Failed to load agent configuration from {}: {}", agentConfigurationFilePath, errorMessage, e);
        }
    }

    /**
     * Overrides the tool-agent version with the value sourced from configuration
     * ({@code openframe.client-versions.*}, backed by the deployment-provided version env vars).
     * Agents with no strategy (e.g. tacticalrmm) keep the version declared in their JSON file.
     */
    private void applyVersionFromProperties(IntegratedToolAgentConfiguration configuration) {
        AgentVersionOverride.forAgentId(configuration.getId())
                .ifPresent(override -> override.apply(configuration, clientVersionsProperties));
    }

    private static void applyAssetVersion(IntegratedToolAgentConfiguration configuration, String assetId, String version) {
        List<ToolAgentAsset> assets = configuration.getAssets();
        if (assets == null) {
            return;
        }
        assets.stream()
                .filter(asset -> assetId.equals(asset.getId()))
                .forEach(asset -> asset.setVersion(version));
    }

    /**
     * Strategy mapping an agent configuration id to how its version(s) are sourced from
     * {@link ClientVersionsProperties}. osquery is a nested asset of the fleetmdm agent, so its
     * version is applied on that asset rather than the top-level agent.
     */
    private enum AgentVersionOverride {

        MESHCENTRAL("meshcentral-agent") {
            @Override
            void apply(IntegratedToolAgentConfiguration configuration, ClientVersionsProperties versions) {
                configuration.setVersion(versions.getMesh());
            }
        },
        FLEETMDM("fleetmdm-agent") {
            @Override
            void apply(IntegratedToolAgentConfiguration configuration, ClientVersionsProperties versions) {
                configuration.setVersion(versions.getFleet());
                applyAssetVersion(configuration, OSQUERY_ASSET_ID, versions.getOsquery());
            }
        };

        private final String agentId;

        AgentVersionOverride(String agentId) {
            this.agentId = agentId;
        }

        abstract void apply(IntegratedToolAgentConfiguration configuration, ClientVersionsProperties versions);

        static Optional<AgentVersionOverride> forAgentId(String agentId) {
            return Arrays.stream(values())
                    .filter(override -> override.agentId.equals(agentId))
                    .findFirst();
        }
    }

}
