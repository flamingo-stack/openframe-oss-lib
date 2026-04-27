package com.openframe.data.service;

import com.openframe.data.document.clientconfiguration.PublishState;
import com.openframe.data.document.toolagent.IntegratedToolAgent;
import com.openframe.data.document.toolagent.ToolAgentAsset;
import com.openframe.data.document.toolagent.ToolAgentStatus;
import com.openframe.data.repository.toolagent.IntegratedToolAgentRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.OptimisticLockingFailureException;
import org.springframework.retry.annotation.Backoff;
import org.springframework.retry.annotation.Retryable;
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

    @Retryable(
            retryFor = OptimisticLockingFailureException.class,
            maxAttempts = 5,
            backoff = @Backoff(delay = 50, multiplier = 2, random = true)
    )
    public void markAsNonPublished(String id) {
        IntegratedToolAgent agent = getById(id);
        agent.setPublishState(PublishState.nonPublished(agent.getPublishState()));
        agentRepository.save(agent);
    }

    public void markAsPublished(String id) {
        IntegratedToolAgent agent = getById(id);
        agent.setPublishState(PublishState.published(agent.getPublishState()));
        agentRepository.save(agent);
    }

    @Retryable(
            retryFor = OptimisticLockingFailureException.class,
            maxAttempts = 5,
            backoff = @Backoff(delay = 50, multiplier = 2, random = true)
    )
    public void updateConfigurationFields(IntegratedToolAgent fromConfig) {
        Optional<IntegratedToolAgent> existingOpt = findById(fromConfig.getId());
        if (existingOpt.isEmpty()) {
            agentRepository.save(fromConfig);
            return;
        }

        IntegratedToolAgent existing = existingOpt.get();
        boolean releaseAgent = existing.isReleaseVersion();

        boolean versionChanged = !releaseAgent
                && !Objects.equals(existing.getVersion(), fromConfig.getVersion());
        boolean assetChanged = !releaseAgent && hasAssetChanges(existing, fromConfig);

        existing.setToolId(fromConfig.getToolId());
        existing.setReleaseVersion(fromConfig.isReleaseVersion());
        if (!releaseAgent) {
            existing.setVersion(fromConfig.getVersion());
        }
        existing.setSessionType(fromConfig.getSessionType());
        existing.setDownloadConfigurations(fromConfig.getDownloadConfigurations());
        existing.setAssets(fromConfig.getAssets());
        existing.setInstallationCommandArgs(fromConfig.getInstallationCommandArgs());
        existing.setRunCommandArgs(fromConfig.getRunCommandArgs());
        existing.setAgentToolIdCommandArgs(fromConfig.getAgentToolIdCommandArgs());
        existing.setUninstallationCommandArgs(fromConfig.getUninstallationCommandArgs());
        existing.setAllowVersionUpdate(fromConfig.isAllowVersionUpdate());
        existing.setAllowConfigurationUpdate(fromConfig.isAllowConfigurationUpdate());
        existing.setStatus(fromConfig.getStatus());

        if (versionChanged || assetChanged) {
            existing.setPublishState(new PublishState(false, null, 0));
            log.info("Marked tool agent {} for publish: versionChanged={}, assetChanged={}",
                    existing.getId(), versionChanged, assetChanged);
        }

        agentRepository.save(existing);
    }

    @Retryable(
            retryFor = OptimisticLockingFailureException.class,
            maxAttempts = 5,
            backoff = @Backoff(delay = 50, multiplier = 2, random = true)
    )
    public void updateReleaseAgentVersion(String id, String newVersion) {
        IntegratedToolAgent agent = getById(id);
        if (!agent.isReleaseVersion()) {
            log.warn("updateReleaseAgentVersion called for non-release agent {}, skipping", id);
            return;
        }
        if (Objects.equals(agent.getVersion(), newVersion)) {
            return;
        }
        String oldVersion = agent.getVersion();
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
            if (isNotEmpty(existingAsset.getVersion())) {
                existingVersionsById.put(existingAsset.getId(), existingAsset.getVersion());
            }
        }

        for (ToolAgentAsset newAsset : newAssets) {
            if (!isNotEmpty(newAsset.getVersion())) {
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
