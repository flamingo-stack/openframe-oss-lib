package com.openframe.data.service;

import com.openframe.data.document.clientconfiguration.DownloadConfiguration;
import com.openframe.data.document.clientconfiguration.OpenFrameClientConfiguration;
import com.openframe.data.document.clientconfiguration.PublishState;
import com.openframe.data.repository.clientconfiguration.OpenFrameClientConfigurationRepository;
import com.openframe.data.retry.RetryOnOptimisticLockingFailure;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Objects;
import java.util.Optional;

@Slf4j
@Service
@RequiredArgsConstructor
public class OpenFrameClientConfigurationService {

    private final OpenFrameClientConfigurationRepository repository;
    private final TenantIdProvider tenantIdProvider;

    public OpenFrameClientConfiguration get() {
        return repository.findByTenantId(tenantIdProvider.getTenantId())
                .orElseThrow(() -> new IllegalStateException("No openframe client configuration found"));
    }

    public Optional<OpenFrameClientConfiguration> findById(String id) {
        return repository.findById(id);
    }

    public OpenFrameClientConfiguration save(OpenFrameClientConfiguration config) {
        return repository.save(config);
    }

    public void markAsNonPublished(OpenFrameClientConfiguration config) {
        PublishState currentState = config.getPublishState();
        PublishState nextState = PublishState.nonPublished(currentState);
        config.setPublishState(nextState);
        save(config);
    }

    public void markAsPublished(OpenFrameClientConfiguration config) {
        PublishState nextState = PublishState.published();
        config.setPublishState(nextState);
        save(config);
    }

    @RetryOnOptimisticLockingFailure
    public void updateVersion(String newVersion) {
        OpenFrameClientConfiguration config = get();
        String oldVersion = config.getVersion();
        if (Objects.equals(oldVersion, newVersion)) {
            return;
        }
        config.setVersion(newVersion);
        config.setPublishState(PublishState.pending());
        save(config);
        log.info("Updated client configuration version {} -> {} and marked for publish", oldVersion, newVersion);
    }

    @RetryOnOptimisticLockingFailure
    public void updateConfigurationFields(OpenFrameClientConfiguration fromConfig) {
        repository.findByTenantId(tenantIdProvider.getTenantId())
                .ifPresentOrElse(
                        existing -> mergeAndSave(existing, fromConfig),
                        () -> createForTenant(fromConfig)
                );
    }

    private void createForTenant(OpenFrameClientConfiguration fromConfig) {
        // The bundled default config (agent-configurations/client-configuration.json) carries a
        // hardcoded _id ("default"). In the shared multi-tenant DB only one doc can hold that _id,
        // so a second tenant inserting it fails with E11000. Clear the id so Mongo generates a
        // unique _id per tenant; TenantStampingCallback stamps the tenantId on save.
        fromConfig.setId(null);
        save(fromConfig);
    }

    private void mergeAndSave(OpenFrameClientConfiguration existing, OpenFrameClientConfiguration fromConfig) {
        List<DownloadConfiguration> existingDownloadConfiguration = existing.getDownloadConfiguration();
        List<DownloadConfiguration> fromConfigDownloadConfiguration = fromConfig.getDownloadConfiguration();
        boolean downloadChanged = !Objects.equals(existingDownloadConfiguration, fromConfigDownloadConfiguration);

        existing.setDownloadConfiguration(fromConfigDownloadConfiguration);

        if (downloadChanged) {
            existing.setPublishState(PublishState.pending());
            log.info("Marked client configuration for publish: downloadChanged=true");
        }

        save(existing);
    }
}
