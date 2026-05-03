package com.openframe.data.service;

import com.openframe.data.document.clientconfiguration.DownloadConfiguration;
import com.openframe.data.document.clientconfiguration.PublishState;
import com.openframe.data.document.toolagent.IntegratedToolAgent;
import com.openframe.data.document.toolagent.SessionType;
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

    @RetryOnOptimisticLockingFailure
    public void markAsNonPublished(String id) {
        IntegratedToolAgent agent = getById(id);
        PublishState currentState = agent.getPublishState();
        PublishState nextState = PublishState.nonPublished(currentState);
        agent.setPublishState(nextState);
        agentRepository.save(agent);
    }

    public void markAsPublished(String id) {
        IntegratedToolAgent agent = getById(id);
        PublishState nextState = PublishState.published();
        agent.setPublishState(nextState);
        agentRepository.save(agent);
    }

    @RetryOnOptimisticLockingFailure
    public void updateConfigurationFields(IntegratedToolAgent fromConfig) {
        String fromConfigId = fromConfig.getId();
        agentRepository.findById(fromConfigId)
                .ifPresentOrElse(
                        existing -> mergeAndSave(existing, fromConfig),
                        () -> agentRepository.save(fromConfig)
        );
    }

    private void mergeAndSave(IntegratedToolAgent existing, IntegratedToolAgent fromConfig) {
        String existingId = existing.getId();
        boolean releaseAgent = existing.isReleaseVersion();
        String existingVersion = existing.getVersion();
        String fromConfigVersion = fromConfig.getVersion();

        boolean versionChanged = !releaseAgent && !Objects.equals(existingVersion, fromConfigVersion);
        boolean assetChanged = !releaseAgent && hasAssetChanges(existing, fromConfig);

        String fromConfigToolId = fromConfig.getToolId();
        boolean fromConfigReleaseVersion = fromConfig.isReleaseVersion();
        SessionType fromConfigSessionType = fromConfig.getSessionType();
        List<DownloadConfiguration> fromConfigDownloadConfigurations = fromConfig.getDownloadConfigurations();
        List<ToolAgentAsset> fromConfigAssets = fromConfig.getAssets();
        List<String> fromConfigInstallationArgs = fromConfig.getInstallationCommandArgs();
        List<String> fromConfigRunArgs = fromConfig.getRunCommandArgs();
        List<String> fromConfigAgentToolIdArgs = fromConfig.getAgentToolIdCommandArgs();
        List<String> fromConfigUninstallationArgs = fromConfig.getUninstallationCommandArgs();
        boolean fromConfigAllowVersionUpdate = fromConfig.isAllowVersionUpdate();
        boolean fromConfigAllowConfigurationUpdate = fromConfig.isAllowConfigurationUpdate();
        ToolAgentStatus fromConfigStatus = fromConfig.getStatus();

        existing.setToolId(fromConfigToolId);
        existing.setReleaseVersion(fromConfigReleaseVersion);
        if (!releaseAgent) {
            existing.setVersion(fromConfigVersion);
        }
        existing.setSessionType(fromConfigSessionType);
        existing.setDownloadConfigurations(fromConfigDownloadConfigurations);
        existing.setAssets(fromConfigAssets);
        existing.setInstallationCommandArgs(fromConfigInstallationArgs);
        existing.setRunCommandArgs(fromConfigRunArgs);
        existing.setAgentToolIdCommandArgs(fromConfigAgentToolIdArgs);
        existing.setUninstallationCommandArgs(fromConfigUninstallationArgs);
        existing.setAllowVersionUpdate(fromConfigAllowVersionUpdate);
        existing.setAllowConfigurationUpdate(fromConfigAllowConfigurationUpdate);
        existing.setStatus(fromConfigStatus);

        if (versionChanged || assetChanged) {
            existing.setPublishState(new PublishState(false, null, 0));
            log.info("Marked tool agent {} for publish: versionChanged={}, assetChanged={}",
                    existingId, versionChanged, assetChanged);
        }

        agentRepository.save(existing);
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
        agent.setPublishState(new PublishState(false, null, 0));
        agentRepository.save(agent);
        log.info("Updated release agent {} version {} -> {} and marked for publish",
                id, oldVersion, newVersion);
    }

    private boolean hasAssetChanges(IntegratedToolAgent existing, IntegratedToolAgent fromConfig) {
        List<ToolAgentAsset> existingAssets = existing.getAssets();
        List<ToolAgentAsset> newAssets = fromConfig.getAssets();

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
}
