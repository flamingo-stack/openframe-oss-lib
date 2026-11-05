package com.openframe.management.service;

import com.openframe.audit.AuditCapture;
import com.openframe.audit.AuditRecorder;
import com.openframe.data.document.toolagent.IntegratedToolAgent;
import com.openframe.data.document.version.ReleaseVersion;
import com.openframe.data.repository.version.ReleaseVersionRepository;
import com.openframe.data.retry.RetryOnOptimisticLockingFailure;
import com.openframe.data.service.IntegratedToolAgentService;
import com.openframe.data.service.OpenFrameClientConfigurationService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;
import java.util.Objects;

import static com.openframe.data.document.audit.AuditAction.DEVICE_CLIENT_UPDATE;
import static com.openframe.data.document.audit.AuditAction.DEVICE_TOOL_AGENT_UPDATE;
import static com.openframe.data.document.audit.AuditTargetType.DEVICE;

@Slf4j
@Service
@RequiredArgsConstructor
public class ClientVersionService {

    private final ReleaseVersionRepository releaseVersionRepository;
    private final OpenFrameClientConfigurationService openFrameClientConfigurationService;
    private final IntegratedToolAgentService integratedToolAgentService;
    private final AuditCapture auditCapture;
    private final AuditRecorder auditRecorder;

    @RetryOnOptimisticLockingFailure
    public void process(String releaseVersion) {
        log.info("Processing release version: {}", releaseVersion);

        releaseVersionRepository.findFirstBy()
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
        newReleaseVersion.setVersion(releaseVersion);

        ReleaseVersion saved = releaseVersionRepository.save(newReleaseVersion);
        String savedId = saved.getId();
        String savedVersion = saved.getVersion();
        log.info("Successfully created release version: {} with id: {}", savedVersion, savedId);

        propagate(releaseVersion);
    }

    private void propagate(String version) {
        auditCapture.runWhenChanged(DEVICE_CLIENT_UPDATE, DEVICE, null, Map.of("version", version),
                () -> openFrameClientConfigurationService.updateVersion(version, auditRecorder.currentEventId()));
        updateReleaseAgents(version);
    }

    private void updateReleaseAgents(String version) {
        log.info("Updating IntegratedToolAgents with releaseVersion=true to version: {}", version);

        List<IntegratedToolAgent> releaseAgents = integratedToolAgentService.findByReleaseVersionTrue();
        log.info("Found {} release agents to update", releaseAgents.size());

        releaseAgents.forEach(agent -> auditCapture.runWhenChanged(DEVICE_TOOL_AGENT_UPDATE, DEVICE, null,
                Map.of("toolAgent", agent.getKey(), "version", version),
                () -> integratedToolAgentService.updateReleaseAgentVersion(agent.getId(), version,
                        auditRecorder.currentEventId())));

        log.info("Successfully updated {} release agents", releaseAgents.size());
    }
}
