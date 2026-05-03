package com.openframe.management.service;

import com.openframe.data.document.toolagent.IntegratedToolAgent;
import com.openframe.data.document.version.ReleaseVersion;
import com.openframe.data.repository.version.ReleaseVersionRepository;
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

@Slf4j
@Service
@RequiredArgsConstructor
public class ReleaseVersionService {

    private final ReleaseVersionRepository releaseVersionRepository;
    private final OpenFrameClientConfigurationService openFrameClientConfigurationService;
    private final IntegratedToolAgentService integratedToolAgentService;

    @Retryable(
            retryFor = {OptimisticLockingFailureException.class, DuplicateKeyException.class},
            maxAttempts = 5,
            backoff = @Backoff(delay = 50, multiplier = 2, random = true)
    )
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

        if (currentVersion != null && currentVersion.equals(releaseVersion)) {
            log.info("Release version {} is already up to date, skipping update", releaseVersion);
            return;
        }

        log.info("Updating existing release version from {} to {}", currentVersion, releaseVersion);
        existing.setVersion(releaseVersion);

        ReleaseVersion saved = releaseVersionRepository.save(existing);
        log.info("Successfully updated release version: {} with id: {}", saved.getVersion(), saved.getId());

        propagate(releaseVersion);
    }

    private void createNewReleaseVersion(String releaseVersion) {
        log.info("Creating initial release version record for: {}", releaseVersion);
        ReleaseVersion newReleaseVersion = new ReleaseVersion();
        newReleaseVersion.setId(ReleaseVersion.DEFAULT_ID);
        newReleaseVersion.setVersion(releaseVersion);

        ReleaseVersion saved = releaseVersionRepository.save(newReleaseVersion);
        log.info("Successfully created release version: {} with id: {}", saved.getVersion(), saved.getId());

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

        releaseAgents.forEach(agent -> integratedToolAgentService.updateReleaseAgentVersion(agent.getId(), version));

        log.info("Successfully updated {} release agents", releaseAgents.size());
    }
}
