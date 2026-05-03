package com.openframe.management.service;

import com.openframe.data.document.toolagent.IntegratedToolAgent;
import com.openframe.data.document.version.ReleaseVersion;
import com.openframe.data.repository.version.ReleaseVersionRepository;
import com.openframe.data.retry.RetryOnOptimisticLockingFailure;
import com.openframe.data.service.IntegratedToolAgentService;
import com.openframe.data.service.OpenFrameClientConfigurationService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.dao.OptimisticLockingFailureException;
import org.springframework.retry.annotation.Backoff;
import org.springframework.retry.annotation.Retryable;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Objects;

@Slf4j
@Service
@RequiredArgsConstructor
public class ReleaseVersionService {

    private final ReleaseVersionRepository releaseVersionRepository;
    private final OpenFrameClientConfigurationService openFrameClientConfigurationService;
    private final IntegratedToolAgentService integratedToolAgentService;

    @RetryOnOptimisticLockingFailure
    public void process(String releaseVersion) {
        log.info("Processing release version: {}", releaseVersion);

        releaseVersionRepository.findById(ReleaseVersion.DEFAULT_ID)
                .ifPresentOrElse(
                        existing -> updateExistingReleaseVersion(existing, releaseVersion),
                        () -> createNewReleaseVersion(releaseVersion)
                );
    }

    private void updateExistingReleaseVersion(ReleaseVersion existing, String releaseVersion) {
        String currentVersion = existing.getVersion();

        if (isUpToDate(currentVersion, releaseVersion)) {
            log.info("Release version {} is already up to date, re-running propagate for idempotency", releaseVersion);
        } else {
            log.info("Updating existing release version from {} to {}", currentVersion, releaseVersion);
            existing.setVersion(releaseVersion);
            ReleaseVersion saved = releaseVersionRepository.save(existing);
            String savedId = saved.getId();
            String savedVersion = saved.getVersion();
            log.info("Successfully updated release version: {} with id: {}", savedVersion, savedId);
        }

        propagate(releaseVersion);
    }

    private boolean isUpToDate(String currentVersion, String releaseVersion) {
        return Objects.equals(currentVersion, releaseVersion);
    }

    private void createNewReleaseVersion(String releaseVersion) {
        log.info("Creating initial release version record for: {}", releaseVersion);
        ReleaseVersion newReleaseVersion = new ReleaseVersion();
        newReleaseVersion.setId(ReleaseVersion.DEFAULT_ID);
        newReleaseVersion.setVersion(releaseVersion);

        ReleaseVersion saved = releaseVersionRepository.save(newReleaseVersion);
        String savedId = saved.getId();
        String savedVersion = saved.getVersion();
        log.info("Successfully created release version: {} with id: {}", savedVersion, savedId);

        propagate(releaseVersion);
    }

    private void propagate(String version) {
        openFrameClientConfigurationService.updateVersionAndMarkPending(version);
        updateReleaseAgents(version);
    }

    private void updateReleaseAgents(String version) {
        log.info("Updating IntegratedToolAgents with releaseVersion=true to version: {}", version);

        List<IntegratedToolAgent> releaseAgents = integratedToolAgentService.findByReleaseVersionTrue();
        log.info("Found {} release agents to update", releaseAgents.size());

        releaseAgents.forEach(agent -> {
            String agentId = agent.getId();
            integratedToolAgentService.updateReleaseAgentVersion(agentId, version);
        });

        log.info("Successfully updated {} release agents", releaseAgents.size());
    }
}
