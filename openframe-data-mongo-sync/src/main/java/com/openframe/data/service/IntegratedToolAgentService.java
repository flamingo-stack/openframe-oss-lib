package com.openframe.data.service;

import com.openframe.data.document.clientconfiguration.PublishState;
import com.openframe.data.document.toolagent.IntegratedToolAgent;
import com.openframe.data.document.toolagent.IntegratedToolAgentConfiguration;
import com.openframe.data.document.toolagent.ToolAgentAsset;
import com.openframe.data.document.toolagent.ToolAgentStatus;
import com.openframe.data.repository.toolagent.IntegratedToolAgentRepository;
import com.openframe.data.retry.RetryOnOptimisticLockingFailure;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;

import static io.micrometer.common.util.StringUtils.isNotEmpty;
import static org.springframework.util.CollectionUtils.isEmpty;

@Slf4j
@Service
@RequiredArgsConstructor
public class IntegratedToolAgentService {

    private final IntegratedToolAgentRepository agentRepository;

    public List<IntegratedToolAgent> getAll() {
        return agentRepository.findAll();
    }

    public List<IntegratedToolAgent> getAllEnabled() {
        return agentRepository.findByStatus(ToolAgentStatus.ENABLED);
    }

    public Optional<IntegratedToolAgent> findById(String id) {
        return agentRepository.findById(id);
    }

    public IntegratedToolAgent getById(String id) {
        return agentRepository.findById(id)
                .orElseThrow(() -> new IllegalStateException("No tool agent configuration found by id " + id));
    }

    public List<IntegratedToolAgent> findByReleaseVersionTrue() {
        return agentRepository.findByReleaseVersionTrue();
    }

    public void markAsNonPublished(IntegratedToolAgent agent) {
        PublishState currentState = agent.getPublishState();
        PublishState nextState = PublishState.nonPublished(currentState);
        agent.setPublishState(nextState);
        agentRepository.save(agent);
    }

    public void markAsPublished(IntegratedToolAgent agent) {
        PublishState nextState = PublishState.published();
        agent.setPublishState(nextState);
        agentRepository.save(agent);
    }

    @RetryOnOptimisticLockingFailure
    public void updateConfigurationFields(IntegratedToolAgentConfiguration configuration) {
        String configurationId = configuration.getId();
        agentRepository.findById(configurationId)
                .ifPresentOrElse(
                        existing -> mergeAndSave(existing, configuration),
                        () -> createFromConfiguration(configuration)
        );
    }

    private void createFromConfiguration(IntegratedToolAgentConfiguration configuration) {
        IntegratedToolAgent agent = new IntegratedToolAgent();
        applyConfiguration(agent, configuration);
        if (!configuration.isReleaseVersion()) {
            agent.setVersion(configuration.getVersion());
        }
        agentRepository.save(agent);
    }

    private void mergeAndSave(IntegratedToolAgent existing, IntegratedToolAgentConfiguration configuration) {
        String existingId = existing.getId();
        boolean releaseAgent = existing.isReleaseVersion();
        String existingVersion = existing.getVersion();
        String configurationVersion = configuration.getVersion();

        boolean versionChanged = !releaseAgent && !Objects.equals(existingVersion, configurationVersion);
        boolean assetChanged = !releaseAgent && hasAssetChanges(existing, configuration);

        applyConfiguration(existing, configuration);
        if (!releaseAgent) {
            existing.setVersion(configurationVersion);
        }

        if (versionChanged || assetChanged) {
            existing.setPublishState(PublishState.pending());
            log.info("Marked tool agent {} for publish: versionChanged={}, assetChanged={}",
                    existingId, versionChanged, assetChanged);
        }

        agentRepository.save(existing);
    }

    private void applyConfiguration(IntegratedToolAgent agent, IntegratedToolAgentConfiguration configuration) {
        agent.setId(configuration.getId());
        agent.setToolId(configuration.getToolId());
        agent.setReleaseVersion(configuration.isReleaseVersion());
        agent.setSessionType(configuration.getSessionType());
        agent.setDownloadConfigurations(configuration.getDownloadConfigurations());
        agent.setAssets(configuration.getAssets());
        agent.setInstallationCommandArgs(configuration.getInstallationCommandArgs());
        agent.setRunCommandArgs(configuration.getRunCommandArgs());
        agent.setAgentToolIdCommandArgs(configuration.getAgentToolIdCommandArgs());
        agent.setUninstallationCommandArgs(configuration.getUninstallationCommandArgs());
        agent.setStatus(configuration.getStatus());
    }

    private boolean hasAssetChanges(IntegratedToolAgent existing, IntegratedToolAgentConfiguration configuration) {
        List<ToolAgentAsset> existingAssets = existing.getAssets();
        List<ToolAgentAsset> newAssets = configuration.getAssets();

        if (isEmpty(existingAssets) || isEmpty(newAssets)) {
            return false;
        }

        Map<String, String> existingVersionsById = new HashMap<>();
        for (ToolAgentAsset existingAsset : existingAssets) {
            String existingAssetId = existingAsset.getId();
            String existingAssetVersion = existingAsset.getVersion();
            if (isNotEmpty(existingAssetVersion)) {
                existingVersionsById.put(existingAssetId, existingAssetVersion);
            }
        }

        for (ToolAgentAsset newAsset : newAssets) {
            String newAssetId = newAsset.getId();
            String newAssetVersion = newAsset.getVersion();
            if (!isNotEmpty(newAssetVersion)) {
                continue;
            }
            String existingVersion = existingVersionsById.get(newAssetId);
            if (existingVersion == null) {
                continue;
            }
            if (!existingVersion.equals(newAssetVersion)) {
                return true;
            }
        }
        return false;
    }

    @RetryOnOptimisticLockingFailure
    public void updateReleaseAgentVersion(String id, String newVersion) {
        IntegratedToolAgent agent = getById(id);
        boolean releaseAgent = agent.isReleaseVersion();
        if (!releaseAgent) {
            log.warn("updateReleaseAgentVersion called for non-release agent {}, skipping", id);
            return;
        }
        String oldVersion = agent.getVersion();
        if (Objects.equals(oldVersion, newVersion)) {
            return;
        }
        agent.setVersion(newVersion);
        agent.setPublishState(PublishState.pending());
        agentRepository.save(agent);
        log.info("Updated release agent {} version {} -> {} and marked for publish",
                id, oldVersion, newVersion);
    }
}
