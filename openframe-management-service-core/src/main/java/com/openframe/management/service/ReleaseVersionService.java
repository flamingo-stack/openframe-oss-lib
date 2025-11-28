package com.openframe.management.service;

import com.openframe.data.document.clientconfiguration.OpenFrameClientConfiguration;
import com.openframe.data.document.toolagent.IntegratedToolAgent;
import com.openframe.data.document.version.ReleaseVersion;
import com.openframe.data.repository.version.ReleaseVersionRepository;
import com.openframe.data.service.IntegratedToolAgentService;
import com.openframe.data.service.OpenFrameClientConfigurationService;
import com.openframe.data.service.OpenFrameClientUpdatePublisher;
import com.openframe.data.service.ToolAgentUpdateUpdatePublisher;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class ReleaseVersionService {

    private static final String DEFAULT_CLIENT_CONFIG_ID = "default";

    private final ReleaseVersionRepository releaseVersionRepository;
    private final OpenFrameClientConfigurationService openFrameClientConfigurationService;
    private final OpenFrameClientUpdatePublisher openFrameClientUpdatePublisher;
    private final IntegratedToolAgentService integratedToolAgentService;
    private final ToolAgentUpdateUpdatePublisher toolAgentUpdatePublisher;

    public void process(String releaseVersion) {
        log.info("Processing release version: {}", releaseVersion);

        releaseVersionRepository.findFirstByOrderByCreatedAtAsc()
                .ifPresentOrElse(
                        existing -> updateExistingReleaseVersion(existing, releaseVersion),
                    () -> createNewReleaseVersion(releaseVersion)
        );

        // Update OpenFrameClientConfiguration and publish
        updateClientConfiguration(releaseVersion);

        // Update IntegratedToolAgents where releaseVersion is true and publish
        updateReleaseAgents(releaseVersion);
    }

    private void updateExistingReleaseVersion(ReleaseVersion existing, String releaseVersion) {
        log.info("Updating existing release version from {} to {}", existing.getVersion(), releaseVersion);
        existing.setVersion(releaseVersion);

        ReleaseVersion saved = releaseVersionRepository.save(existing);
        log.info("Successfully updated release version: {} with id: {}", saved.getVersion(), saved.getId());
    }

    private void createNewReleaseVersion(String releaseVersion) {
        log.info("Creating initial release version record for: {}", releaseVersion);
        ReleaseVersion newReleaseVersion = new ReleaseVersion();
        newReleaseVersion.setVersion(releaseVersion);
        
        ReleaseVersion saved = releaseVersionRepository.save(newReleaseVersion);
        log.info("Successfully created release version: {} with id: {}", saved.getVersion(), saved.getId());
    }

    private void updateClientConfiguration(String version) {
        log.info("Updating OpenFrameClientConfiguration to version: {}", version);
        
        openFrameClientConfigurationService.findById(DEFAULT_CLIENT_CONFIG_ID)
                .ifPresentOrElse(
                        config -> {
                            String oldVersion = config.getVersion();
                            config.setVersion(version);
                            OpenFrameClientConfiguration updatedConfig = openFrameClientConfigurationService.save(config);
                            log.info("Updated OpenFrameClientConfiguration from version {} to {}", oldVersion, version);
                            
                            openFrameClientUpdatePublisher.publish(updatedConfig);
                        },
                        () -> log.warn("OpenFrameClientConfiguration with id '{}' not found, skipping update", DEFAULT_CLIENT_CONFIG_ID)
                );
    }

    private void updateReleaseAgents(String version) {
        log.info("Updating IntegratedToolAgents with releaseVersion=true to version: {}", version);
        
        List<IntegratedToolAgent> releaseAgents = integratedToolAgentService.findByReleaseVersionTrue();
        log.info("Found {} release agents to update", releaseAgents.size());
        
        releaseAgents.forEach(agent -> {
            String oldVersion = agent.getVersion();
            agent.setVersion(version);
            IntegratedToolAgent updatedAgent = integratedToolAgentService.save(agent);
            log.info("Updated agent {} from version {} to {}", agent.getId(), oldVersion, version);
            
            toolAgentUpdatePublisher.publish(updatedAgent);
        });
        
        log.info("Successfully updated {} release agents", releaseAgents.size());
    }
}

